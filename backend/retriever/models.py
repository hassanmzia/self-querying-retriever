"""
Domain models for the retriever application.

Covers documents, queries, query results, retrieval pipeline configurations,
agent executions, and vector-store collections.
"""

import uuid

from django.conf import settings
from django.db import models


class Collection(models.Model):
    """Represents a named collection inside the vector store."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    document_count = models.PositiveIntegerField(default=0)
    embedding_model = models.CharField(
        max_length=255,
        default="text-embedding-3-small",
        help_text="Name of the embedding model used for this collection.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.document_count} docs)"


class Document(models.Model):
    """A document stored both in PostgreSQL (metadata) and ChromaDB (vector)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=512, db_index=True)
    content = models.TextField()
    metadata_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Arbitrary metadata stored alongside the document.",
    )
    source = models.CharField(
        max_length=1024,
        blank=True,
        default="",
        help_text="Origin URL or file path.",
    )
    collection_name = models.CharField(
        max_length=255,
        default="renewable_energy",
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["collection_name", "created_at"]),
        ]

    def __str__(self):
        return self.title


class DocumentMetadata(models.Model):
    """
    Structured metadata for a document, specifically designed for the
    renewable-energy domain covered in the notebook.
    """

    document = models.OneToOneField(
        Document,
        on_delete=models.CASCADE,
        related_name="structured_metadata",
    )
    year = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Publication year (e.g. 2023-2025).",
    )
    topics = models.JSONField(
        default=list,
        blank=True,
        help_text="List of topic strings.",
    )
    subtopic = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Specific subtopic classification.",
    )
    custom_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Any additional key/value pairs.",
    )

    class Meta:
        verbose_name_plural = "Document metadata"

    def __str__(self):
        return f"Metadata for {self.document.title}"


class Query(models.Model):
    """Records every query issued against the retrieval system."""

    RETRIEVAL_METHOD_CHOICES = [
        ("vanilla", "Basic Vector Retrieval"),
        ("self_query", "Self-Querying Retriever"),
        ("hypothetical", "Hypothetical Question Retrieval"),
        ("bm25", "BM25 Keyword Retrieval"),
        ("hybrid", "Hybrid Search (BM25 + Vector)"),
        ("reranked", "Cross-Encoder Reranking"),
        ("compressed", "Context Compression"),
        ("expanded", "Query Expansion"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="queries",
    )
    query_text = models.TextField()
    retrieval_method = models.CharField(
        max_length=50,
        choices=RETRIEVAL_METHOD_CHOICES,
        default="hybrid",
    )
    filters_applied = models.JSONField(
        default=dict,
        blank=True,
        help_text="Metadata filters that were applied.",
    )
    results_count = models.PositiveIntegerField(default=0)
    execution_time_ms = models.FloatField(
        null=True,
        blank=True,
        help_text="Total wall-clock time in milliseconds.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Queries"

    def __str__(self):
        return f"Query({self.retrieval_method}): {self.query_text[:80]}"


class QueryResult(models.Model):
    """An individual result returned for a query."""

    query = models.ForeignKey(
        Query,
        on_delete=models.CASCADE,
        related_name="results",
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="query_results",
    )
    rank = models.PositiveIntegerField()
    score = models.FloatField(
        null=True,
        blank=True,
        help_text="Similarity / relevance score.",
    )
    retrieval_method = models.CharField(max_length=50, blank=True, default="")
    is_reranked = models.BooleanField(default=False)
    compressed_content = models.TextField(
        blank=True,
        default="",
        help_text="Content after context compression, if applied.",
    )

    class Meta:
        ordering = ["query", "rank"]
        unique_together = [("query", "rank")]

    def __str__(self):
        return f"Result #{self.rank} for {self.query_id}"


class RetrievalPipeline(models.Model):
    """A saved, reusable configuration for a retrieval pipeline."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True, default="")
    pipeline_config = models.JSONField(
        default=dict,
        help_text="Full JSON specification of the pipeline steps.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class AgentExecution(models.Model):
    """Tracks a single run of the LangGraph agent."""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    query = models.ForeignKey(
        Query,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="agent_executions",
    )
    agent_name = models.CharField(max_length=255, default="retrieval_agent")
    state = models.JSONField(
        default=dict,
        blank=True,
        help_text="Serialised LangGraph state at completion.",
    )
    input_data = models.JSONField(default=dict, blank=True)
    output_data = models.JSONField(default=dict, blank=True)
    execution_time_ms = models.FloatField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    error_message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AgentExecution({self.status}): {self.id}"
