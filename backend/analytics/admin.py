"""
Django admin registration for the analytics application.
"""

from django.contrib import admin

from .models import QueryAnalytics, SystemMetrics


@admin.register(QueryAnalytics)
class QueryAnalyticsAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "query",
        "retrieval_method",
        "response_quality_score",
        "user_feedback",
        "execution_time_ms",
        "created_at",
    ]
    list_filter = ["retrieval_method", "user_feedback", "created_at"]
    readonly_fields = ["id", "created_at"]


@admin.register(SystemMetrics)
class SystemMetricsAdmin(admin.ModelAdmin):
    list_display = [
        "timestamp",
        "active_queries",
        "avg_latency_ms",
        "error_rate",
        "total_documents",
        "total_queries_24h",
        "chromadb_status",
        "redis_status",
    ]
    list_filter = ["chromadb_status", "redis_status"]
    readonly_fields = ["id", "timestamp"]
