"""
Views for the documents application.

Handles document uploads (single and bulk), collection management,
and document preview.
"""

import logging

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from retriever.models import Document, DocumentMetadata
from retriever.tasks import process_document_upload

from .models import DocumentCollection, UploadBatch
from .serializers import (
    BulkUploadSerializer,
    DocumentCollectionSerializer,
    DocumentPreviewSerializer,
    SingleDocumentUploadSerializer,
    UploadBatchSerializer,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Collection management
# ---------------------------------------------------------------------------


class DocumentCollectionViewSet(viewsets.ModelViewSet):
    """CRUD operations for document collections."""

    queryset = DocumentCollection.objects.all()
    serializer_class = DocumentCollectionSerializer
    lookup_field = "name"

    @action(detail=True, methods=["get"])
    def batches(self, request, name=None):
        """List upload batches for a specific collection."""
        collection = self.get_object()
        batches = collection.upload_batches.all()
        serializer = UploadBatchSerializer(batches, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Upload batch tracking
# ---------------------------------------------------------------------------


class UploadBatchViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to upload batch records."""

    queryset = UploadBatch.objects.select_related("collection").all()
    serializer_class = UploadBatchSerializer
    filterset_fields = ["status"]


# ---------------------------------------------------------------------------
# Document upload endpoint
# ---------------------------------------------------------------------------


class DocumentUploadView(APIView):
    """
    ``POST /api/v1/documents/upload/``

    Upload a single document and queue it for indexing.
    """

    def post(self, request):
        serializer = SingleDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        doc = Document.objects.create(
            title=data["title"],
            content=data["content"],
            source=data.get("source", ""),
            collection_name=data.get("collection_name", "renewable_energy"),
            metadata_json=data.get("metadata", {}),
        )
        DocumentMetadata.objects.create(
            document=doc,
            year=data.get("year"),
            topics=data.get("topics", []),
            subtopic=data.get("subtopic", ""),
        )

        # Queue async indexing.
        process_document_upload.delay(
            [str(doc.id)], doc.collection_name
        )

        return Response(
            {
                "status": "queued",
                "document_id": str(doc.id),
                "message": "Document created and queued for indexing.",
            },
            status=status.HTTP_202_ACCEPTED,
        )


class BulkDocumentUploadView(APIView):
    """
    ``POST /api/v1/documents/upload/bulk/``

    Upload multiple documents at once, creating an upload-batch record
    to track progress.
    """

    def post(self, request):
        serializer = BulkUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        collection_name = data.get("collection_name", "renewable_energy")

        # Resolve (or create) the collection record.
        doc_collection, _ = DocumentCollection.objects.get_or_create(
            name=collection_name,
            defaults={"description": f"Auto-created for upload to {collection_name}"},
        )

        batch = UploadBatch.objects.create(
            collection=doc_collection,
            total_docs=len(data["documents"]),
            status="processing",
        )

        created_ids = []
        errors = []

        for idx, doc_data in enumerate(data["documents"]):
            try:
                doc = Document.objects.create(
                    title=doc_data["title"],
                    content=doc_data["content"],
                    source=doc_data.get("source", ""),
                    collection_name=doc_data.get(
                        "collection_name", collection_name
                    ),
                    metadata_json=doc_data.get("metadata", {}),
                )
                DocumentMetadata.objects.create(
                    document=doc,
                    year=doc_data.get("year"),
                    topics=doc_data.get("topics", []),
                    subtopic=doc_data.get("subtopic", ""),
                )
                created_ids.append(str(doc.id))
            except Exception as exc:
                errors.append(
                    {"index": idx, "title": doc_data.get("title", ""), "error": str(exc)}
                )

        # Update batch status.
        batch.processed_docs = len(created_ids)
        batch.errors = errors
        if errors and not created_ids:
            batch.status = "failed"
        elif errors:
            batch.status = "partial"
        else:
            batch.status = "completed"
        batch.completed_at = timezone.now()
        batch.save()

        # Queue async vector indexing for successfully created documents.
        if created_ids:
            process_document_upload.delay(created_ids, collection_name)

        return Response(
            {
                "batch_id": str(batch.id),
                "status": batch.status,
                "total": batch.total_docs,
                "created": len(created_ids),
                "errors": errors,
                "document_ids": created_ids,
            },
            status=status.HTTP_202_ACCEPTED,
        )


# ---------------------------------------------------------------------------
# Document preview
# ---------------------------------------------------------------------------


class DocumentPreviewView(APIView):
    """
    ``GET /api/v1/documents/preview/<document_id>/``

    Return a lightweight preview of a document.
    """

    def get(self, request, document_id):
        try:
            doc = Document.objects.get(id=document_id)
        except Document.DoesNotExist:
            return Response(
                {"error": "Document not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        preview_data = {
            "id": str(doc.id),
            "title": doc.title,
            "content_preview": doc.content[:500] + (
                "..." if len(doc.content) > 500 else ""
            ),
            "metadata": doc.metadata_json,
            "source": doc.source,
            "collection_name": doc.collection_name,
        }
        serializer = DocumentPreviewSerializer(preview_data)
        return Response(serializer.data)
