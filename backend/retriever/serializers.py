"""
Django REST Framework serializers for the retriever application.

Includes model serializers for persistence as well as request/response
serializers for the query API.
"""

from rest_framework import serializers

from .models import (
    AgentExecution,
    Collection,
    Document,
    DocumentMetadata,
    Query,
    QueryResult,
    RetrievalPipeline,
)


# ---------------------------------------------------------------------------
# Model serializers
# ---------------------------------------------------------------------------


class DocumentMetadataSerializer(serializers.ModelSerializer):
    """Serializer for structured document metadata."""

    class Meta:
        model = DocumentMetadata
        fields = ["year", "topics", "subtopic", "custom_metadata"]


class DocumentSerializer(serializers.ModelSerializer):
    """Full document representation including structured metadata."""

    structured_metadata = DocumentMetadataSerializer(read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "content",
            "metadata_json",
            "source",
            "collection_name",
            "structured_metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DocumentListSerializer(serializers.ModelSerializer):
    """Lightweight document list representation (no full content)."""

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "source",
            "collection_name",
            "created_at",
        ]


class CollectionSerializer(serializers.ModelSerializer):
    """Serializer for vector-store collections."""

    class Meta:
        model = Collection
        fields = [
            "id",
            "name",
            "description",
            "document_count",
            "embedding_model",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class QueryResultSerializer(serializers.ModelSerializer):
    """Serializer for individual query result entries."""

    document = DocumentListSerializer(read_only=True)

    class Meta:
        model = QueryResult
        fields = [
            "rank",
            "score",
            "retrieval_method",
            "is_reranked",
            "compressed_content",
            "document",
        ]


class QuerySerializer(serializers.ModelSerializer):
    """Serializer for recorded queries."""

    results = QueryResultSerializer(many=True, read_only=True)

    class Meta:
        model = Query
        fields = [
            "id",
            "user",
            "query_text",
            "retrieval_method",
            "filters_applied",
            "results_count",
            "execution_time_ms",
            "results",
            "created_at",
        ]
        read_only_fields = ["id", "results_count", "execution_time_ms", "created_at"]


class QueryListSerializer(serializers.ModelSerializer):
    """Lightweight query list representation."""

    class Meta:
        model = Query
        fields = [
            "id",
            "query_text",
            "retrieval_method",
            "results_count",
            "execution_time_ms",
            "created_at",
        ]


class RetrievalPipelineSerializer(serializers.ModelSerializer):
    """Serializer for retrieval pipeline configurations."""

    class Meta:
        model = RetrievalPipeline
        fields = [
            "id",
            "name",
            "description",
            "pipeline_config",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AgentExecutionSerializer(serializers.ModelSerializer):
    """Serializer for agent execution records."""

    class Meta:
        model = AgentExecution
        fields = [
            "id",
            "query",
            "agent_name",
            "state",
            "input_data",
            "output_data",
            "execution_time_ms",
            "status",
            "error_message",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ---------------------------------------------------------------------------
# Request / response serializers (not tied to a model)
# ---------------------------------------------------------------------------


class QueryRequestSerializer(serializers.Serializer):
    """Validates incoming query requests from the frontend."""

    query = serializers.CharField(
        max_length=2000,
        help_text="The natural-language query string.",
    )
    retrieval_method = serializers.ChoiceField(
        choices=[
            "vanilla",
            "self_query",
            "hypothetical",
            "bm25",
            "hybrid",
            "reranked",
            "compressed",
            "expanded",
        ],
        default="hybrid",
        required=False,
    )
    filters = serializers.DictField(
        child=serializers.JSONField(),
        required=False,
        default=dict,
        help_text="Optional metadata filters, e.g. {\"year\": 2024, \"topics\": [\"solar\"]}.",
    )
    use_reranking = serializers.BooleanField(default=False, required=False)
    use_compression = serializers.BooleanField(default=False, required=False)
    use_query_expansion = serializers.BooleanField(default=False, required=False)
    top_k = serializers.IntegerField(default=5, min_value=1, max_value=50, required=False)
    collection_name = serializers.CharField(
        max_length=255,
        default="renewable_energy",
        required=False,
    )


class QueryResultItemSerializer(serializers.Serializer):
    """A single result item within a query response."""

    document_id = serializers.UUIDField()
    title = serializers.CharField()
    content = serializers.CharField()
    score = serializers.FloatField(allow_null=True)
    metadata = serializers.DictField()
    retrieval_method = serializers.CharField()
    is_reranked = serializers.BooleanField()
    compressed_content = serializers.CharField(allow_blank=True, default="")


class QueryResponseSerializer(serializers.Serializer):
    """Structured response returned to the frontend after a query."""

    query_id = serializers.UUIDField()
    query = serializers.CharField()
    results = QueryResultItemSerializer(many=True)
    pipeline_used = serializers.CharField()
    execution_time_ms = serializers.FloatField()
    agent_trace = serializers.DictField(default=dict)
    expanded_query = serializers.CharField(allow_blank=True, default="")


class DocumentUploadSerializer(serializers.Serializer):
    """Validates a single document upload payload."""

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


class BulkDocumentUploadSerializer(serializers.Serializer):
    """Validates a bulk document upload payload."""

    documents = DocumentUploadSerializer(many=True)
    collection_name = serializers.CharField(
        max_length=255, required=False, default="renewable_energy"
    )


class PipelineConfigSerializer(serializers.Serializer):
    """Validates a pipeline configuration payload."""

    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default="")
    retrieval_method = serializers.ChoiceField(
        choices=[
            "vanilla",
            "self_query",
            "hypothetical",
            "bm25",
            "hybrid",
        ],
    )
    use_reranking = serializers.BooleanField(default=False)
    use_compression = serializers.BooleanField(default=False)
    use_query_expansion = serializers.BooleanField(default=False)
    top_k = serializers.IntegerField(default=5, min_value=1, max_value=50)
    collection_name = serializers.CharField(
        max_length=255, required=False, default="renewable_energy"
    )
    filters = serializers.DictField(required=False, default=dict)


class AgentStateSerializer(serializers.Serializer):
    """Represents the serialised state of a LangGraph agent node."""

    node_name = serializers.CharField()
    input_data = serializers.DictField()
    output_data = serializers.DictField()
    execution_time_ms = serializers.FloatField()
    status = serializers.ChoiceField(
        choices=["pending", "running", "completed", "failed"],
    )
    error = serializers.CharField(allow_blank=True, default="")
