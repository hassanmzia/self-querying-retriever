"""
Models for the documents application.

Manages document collections and upload batches for bulk ingestion.
"""

import uuid

from django.db import models


class DocumentCollection(models.Model):
    """
    A logical grouping of documents, separate from the vector-store
    collection concept.  Carries additional configuration for how
    documents in this collection should be processed and indexed.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, db_index=True)
    description = models.TextField(blank=True, default="")
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Processing configuration, e.g. chunk_size, overlap, "
            "embedding_model, metadata_schema."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class UploadBatch(models.Model):
    """
    Tracks the progress of a bulk document upload / indexing job.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("partial", "Partially Completed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    collection = models.ForeignKey(
        DocumentCollection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="upload_batches",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )
    total_docs = models.PositiveIntegerField(default=0)
    processed_docs = models.PositiveIntegerField(default=0)
    errors = models.JSONField(
        default=list,
        blank=True,
        help_text="List of error messages for failed documents.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "Upload batches"

    def __str__(self):
        return f"Batch {self.id} ({self.status}): {self.processed_docs}/{self.total_docs}"

    @property
    def progress_pct(self) -> float:
        """Return completion percentage."""
        if self.total_docs == 0:
            return 0.0
        return round((self.processed_docs / self.total_docs) * 100, 1)
