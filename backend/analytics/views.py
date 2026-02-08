"""
Analytics API views.

Provides dashboard stats, query trends, retrieval method comparison,
user feedback submission, and CSV/JSON analytics export.
"""

import csv
import io
import logging
from datetime import timedelta

from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from retriever.models import Document, Query

from .models import QueryAnalytics, SystemMetrics
from .serializers import (
    DashboardStatsSerializer,
    MethodComparisonSerializer,
    QueryAnalyticsSerializer,
    QueryTrendPointSerializer,
    SystemMetricsSerializer,
    UserFeedbackSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# QueryAnalytics CRUD
# ---------------------------------------------------------------------------


class QueryAnalyticsViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for per-query analytics records."""

    queryset = QueryAnalytics.objects.select_related("query").all()
    serializer_class = QueryAnalyticsSerializer
    filterset_fields = ["retrieval_method"]
    ordering_fields = ["created_at", "execution_time_ms", "user_feedback"]


# ---------------------------------------------------------------------------
# System metrics
# ---------------------------------------------------------------------------


class SystemMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for system metric snapshots."""

    queryset = SystemMetrics.objects.all()
    serializer_class = SystemMetricsSerializer


# ---------------------------------------------------------------------------
# Dashboard statistics
# ---------------------------------------------------------------------------


class DashboardStatsView(APIView):
    """
    ``GET /api/v1/analytics/dashboard/``

    Returns aggregated statistics for the analytics dashboard: total
    queries, average latency, popular methods, etc.
    """

    def get(self, request):
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total_queries = Query.objects.count()
        queries_today = Query.objects.filter(created_at__gte=today_start).count()

        avg_latency = Query.objects.aggregate(avg=Avg("execution_time_ms"))["avg"]

        total_documents = Document.objects.count()

        popular_methods = list(
            Query.objects.values("retrieval_method")
            .annotate(count=Count("id"))
            .order_by("-count")[:5]
        )

        # Error rate from the last 24 hours.
        last_24h = now - timedelta(hours=24)
        recent_total = Query.objects.filter(created_at__gte=last_24h).count()
        recent_errors = Query.objects.filter(
            created_at__gte=last_24h, execution_time_ms__isnull=True
        ).count()
        error_rate = (
            round((recent_errors / recent_total) * 100, 2) if recent_total else 0.0
        )

        data = {
            "total_queries": total_queries,
            "avg_latency_ms": round(avg_latency, 2) if avg_latency else 0.0,
            "total_documents": total_documents,
            "popular_methods": popular_methods,
            "recent_error_rate": error_rate,
            "queries_today": queries_today,
        }
        serializer = DashboardStatsSerializer(data)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Query trends (time series)
# ---------------------------------------------------------------------------


class QueryTrendsView(APIView):
    """
    ``GET /api/v1/analytics/trends/?days=30``

    Returns a time-series of daily query counts and average latency.
    """

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        since = timezone.now() - timedelta(days=days)

        trends = (
            Query.objects.filter(created_at__gte=since)
            .annotate(date=TruncDate("created_at"))
            .values("date")
            .annotate(
                count=Count("id"),
                avg_latency_ms=Avg("execution_time_ms"),
            )
            .order_by("date")
        )

        data = []
        for row in trends:
            data.append(
                {
                    "date": row["date"],
                    "count": row["count"],
                    "avg_latency_ms": (
                        round(row["avg_latency_ms"], 2)
                        if row["avg_latency_ms"]
                        else None
                    ),
                }
            )

        serializer = QueryTrendPointSerializer(data, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Retrieval method comparison
# ---------------------------------------------------------------------------


class MethodComparisonView(APIView):
    """
    ``GET /api/v1/analytics/methods/``

    Compare retrieval methods by execution time, quality score, and
    user feedback.
    """

    def get(self, request):
        method_stats = (
            Query.objects.values("retrieval_method")
            .annotate(
                query_count=Count("id"),
                avg_execution_time_ms=Avg("execution_time_ms"),
            )
            .order_by("-query_count")
        )

        results = []
        for row in method_stats:
            method = row["retrieval_method"]

            # Quality and feedback from the analytics table.
            analytics_agg = QueryAnalytics.objects.filter(
                retrieval_method=method
            ).aggregate(
                avg_quality=Avg("response_quality_score"),
                avg_rating=Avg("user_feedback"),
            )

            results.append(
                {
                    "method": method,
                    "query_count": row["query_count"],
                    "avg_execution_time_ms": (
                        round(row["avg_execution_time_ms"], 2)
                        if row["avg_execution_time_ms"]
                        else 0.0
                    ),
                    "avg_quality_score": (
                        round(analytics_agg["avg_quality"], 3)
                        if analytics_agg["avg_quality"]
                        else None
                    ),
                    "avg_user_rating": (
                        round(analytics_agg["avg_rating"], 2)
                        if analytics_agg["avg_rating"]
                        else None
                    ),
                }
            )

        serializer = MethodComparisonSerializer(results, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# User feedback
# ---------------------------------------------------------------------------


class UserFeedbackView(APIView):
    """
    ``POST /api/v1/analytics/feedback/``

    Submit user feedback (rating + optional text) for a query.
    """

    def post(self, request):
        serializer = UserFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            query = Query.objects.get(id=data["query_id"])
        except Query.DoesNotExist:
            return Response(
                {"error": "Query not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        analytics, created = QueryAnalytics.objects.get_or_create(
            query=query,
            defaults={
                "retrieval_method": query.retrieval_method,
                "results_count": query.results_count,
                "execution_time_ms": query.execution_time_ms,
            },
        )
        analytics.user_feedback = data["rating"]
        analytics.feedback_text = data.get("feedback_text", "")
        analytics.save(update_fields=["user_feedback", "feedback_text"])

        return Response(
            {"status": "ok", "query_id": str(query.id), "rating": data["rating"]}
        )


# ---------------------------------------------------------------------------
# Export analytics (CSV / JSON)
# ---------------------------------------------------------------------------


class ExportAnalyticsView(APIView):
    """
    ``GET /api/v1/analytics/export/?format=csv&days=30``

    Export analytics data as CSV or JSON.
    """

    def get(self, request):
        export_format = request.query_params.get("format", "json").lower()
        days = int(request.query_params.get("days", 30))
        since = timezone.now() - timedelta(days=days)

        queries = Query.objects.filter(created_at__gte=since).order_by("-created_at")

        rows = []
        for q in queries:
            analytics = getattr(q, "analytics", None)
            rows.append(
                {
                    "query_id": str(q.id),
                    "query_text": q.query_text,
                    "retrieval_method": q.retrieval_method,
                    "results_count": q.results_count,
                    "execution_time_ms": q.execution_time_ms,
                    "user_feedback": (
                        analytics.user_feedback if analytics else None
                    ),
                    "quality_score": (
                        analytics.response_quality_score if analytics else None
                    ),
                    "created_at": q.created_at.isoformat(),
                }
            )

        if export_format == "csv":
            return self._export_csv(rows)

        return Response({"count": len(rows), "data": rows})

    @staticmethod
    def _export_csv(rows):
        """Build and return a CSV HTTP response."""
        if not rows:
            return HttpResponse("No data available.", content_type="text/plain")

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = "attachment; filename=analytics_export.csv"
        return response
