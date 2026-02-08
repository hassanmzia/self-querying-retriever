"""
Analytics models for tracking query performance and system metrics.
"""

import uuid

from django.db import models


class QueryAnalytics(models.Model):
    """
    Per-query analytics record capturing quality signals and user feedback.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    query = models.OneToOneField(
        "retriever.Query",
        on_delete=models.CASCADE,
        related_name="analytics",
    )
    retrieval_method = models.CharField(max_length=50, db_index=True)
    response_quality_score = models.FloatField(
        null=True,
        blank=True,
        help_text="Automated quality score (0.0-1.0).",
    )
    user_feedback = models.IntegerField(
        null=True,
        blank=True,
        help_text="User feedback rating (1-5 stars).",
    )
    feedback_text = models.TextField(
        blank=True,
        default="",
        help_text="Optional free-text feedback from the user.",
    )
    results_count = models.PositiveIntegerField(default=0)
    execution_time_ms = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Query analytics"
        indexes = [
            models.Index(fields=["retrieval_method", "created_at"]),
        ]

    def __str__(self):
        return f"Analytics for query {self.query_id}"


class SystemMetrics(models.Model):
    """
    Point-in-time snapshot of system health metrics.

    Typically populated by a periodic Celery beat task.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    active_queries = models.PositiveIntegerField(
        default=0,
        help_text="Number of queries currently being processed.",
    )
    avg_latency_ms = models.FloatField(
        null=True,
        blank=True,
        help_text="Rolling average query latency in milliseconds.",
    )
    error_rate = models.FloatField(
        default=0.0,
        help_text="Percentage of queries that resulted in errors (0.0-100.0).",
    )
    total_documents = models.PositiveIntegerField(default=0)
    total_queries_24h = models.PositiveIntegerField(default=0)
    chromadb_status = models.CharField(max_length=20, default="unknown")
    redis_status = models.CharField(max_length=20, default="unknown")

    class Meta:
        ordering = ["-timestamp"]
        verbose_name_plural = "System metrics"

    def __str__(self):
        return f"Metrics @ {self.timestamp.isoformat()}"
