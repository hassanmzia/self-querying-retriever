"""
Serializers for the analytics application.
"""

from rest_framework import serializers

from .models import QueryAnalytics, SystemMetrics


class QueryAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for per-query analytics."""

    query_text = serializers.CharField(source="query.query_text", read_only=True)

    class Meta:
        model = QueryAnalytics
        fields = [
            "id",
            "query",
            "query_text",
            "retrieval_method",
            "response_quality_score",
            "user_feedback",
            "feedback_text",
            "results_count",
            "execution_time_ms",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UserFeedbackSerializer(serializers.Serializer):
    """Validates user feedback submissions."""

    query_id = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    feedback_text = serializers.CharField(required=False, default="")


class SystemMetricsSerializer(serializers.ModelSerializer):
    """Serializer for system metrics snapshots."""

    class Meta:
        model = SystemMetrics
        fields = [
            "id",
            "timestamp",
            "active_queries",
            "avg_latency_ms",
            "error_rate",
            "total_documents",
            "total_queries_24h",
            "chromadb_status",
            "redis_status",
        ]


class DashboardStatsSerializer(serializers.Serializer):
    """Aggregated dashboard statistics."""

    total_queries = serializers.IntegerField()
    avg_latency_ms = serializers.FloatField()
    total_documents = serializers.IntegerField()
    popular_methods = serializers.ListField()
    recent_error_rate = serializers.FloatField()
    queries_today = serializers.IntegerField()


class MethodComparisonSerializer(serializers.Serializer):
    """Comparison of retrieval method performance."""

    method = serializers.CharField()
    query_count = serializers.IntegerField()
    avg_execution_time_ms = serializers.FloatField()
    avg_quality_score = serializers.FloatField(allow_null=True)
    avg_user_rating = serializers.FloatField(allow_null=True)


class QueryTrendPointSerializer(serializers.Serializer):
    """A single data point in a query-trends time series."""

    date = serializers.DateField()
    count = serializers.IntegerField()
    avg_latency_ms = serializers.FloatField(allow_null=True)
