"""
Serializers for the documents application.
"""

from rest_framework import serializers

from .models import DocumentCollection, UploadBatch


class DocumentCollectionSerializer(serializers.ModelSerializer):
    """Serializer for document collections."""

    upload_count = serializers.SerializerMethodField()

    class Meta:
        model = DocumentCollection
        fields = [
            "id",
            "name",
            "description",
            "config",
            "upload_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_upload_count(self, obj) -> int:
        return obj.upload_batches.count()


class UploadBatchSerializer(serializers.ModelSerializer):
    """Serializer for upload batch records."""

    progress_pct = serializers.FloatField(read_only=True)

    class Meta:
        model = UploadBatch
        fields = [
            "id",
            "collection",
            "status",
            "total_docs",
            "processed_docs",
            "errors",
            "progress_pct",
            "created_at",
            "completed_at",
        ]
        read_only_fields = [
            "id",
            "processed_docs",
            "errors",
            "progress_pct",
            "created_at",
            "completed_at",
        ]


class SingleDocumentUploadSerializer(serializers.Serializer):
    """Validates a single document upload via the documents app."""

    title = serializers.CharField(max_length=512)
    content = serializers.CharField()
    source = serializers.CharField(max_length=1024, required=False, default="")
    collection_name = serializers.CharField(
        max_length=255, required=False, default="renewable_energy"
    )
    metadata = serializers.DictField(required=False, default=dict)
    year = serializers.IntegerField(required=False, allow_null=True)
    topics = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    subtopic = serializers.CharField(max_length=255, required=False, default="")


class BulkUploadSerializer(serializers.Serializer):
    """Validates a bulk document upload payload."""

    documents = SingleDocumentUploadSerializer(many=True)
    collection_name = serializers.CharField(
        max_length=255, required=False, default="renewable_energy"
    )


class DocumentPreviewSerializer(serializers.Serializer):
    """Read-only preview of a document."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    content_preview = serializers.CharField()
    metadata = serializers.DictField()
    source = serializers.CharField()
    collection_name = serializers.CharField()
