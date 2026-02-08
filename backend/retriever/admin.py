"""
Django admin registration for the retriever application models.
"""

from django.contrib import admin

from .models import (
    AgentExecution,
    Collection,
    Document,
    DocumentMetadata,
    Query,
    QueryResult,
    RetrievalPipeline,
)


class DocumentMetadataInline(admin.StackedInline):
    model = DocumentMetadata
    extra = 0


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ["title", "collection_name", "source", "created_at"]
    list_filter = ["collection_name", "created_at"]
    search_fields = ["title", "content"]
    inlines = [DocumentMetadataInline]
    readonly_fields = ["id", "created_at", "updated_at"]


@admin.register(DocumentMetadata)
class DocumentMetadataAdmin(admin.ModelAdmin):
    list_display = ["document", "year", "subtopic"]
    list_filter = ["year"]
    search_fields = ["document__title", "subtopic"]


@admin.register(Query)
class QueryAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "query_text_short",
        "retrieval_method",
        "results_count",
        "execution_time_ms",
        "created_at",
    ]
    list_filter = ["retrieval_method", "created_at"]
    search_fields = ["query_text"]
    readonly_fields = ["id", "created_at"]

    @admin.display(description="Query")
    def query_text_short(self, obj):
        return obj.query_text[:80] + ("..." if len(obj.query_text) > 80 else "")


@admin.register(QueryResult)
class QueryResultAdmin(admin.ModelAdmin):
    list_display = ["query", "document", "rank", "score", "is_reranked"]
    list_filter = ["is_reranked", "retrieval_method"]


@admin.register(RetrievalPipeline)
class RetrievalPipelineAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "description"]
    readonly_fields = ["id", "created_at"]


@admin.register(AgentExecution)
class AgentExecutionAdmin(admin.ModelAdmin):
    list_display = ["id", "agent_name", "status", "execution_time_ms", "created_at"]
    list_filter = ["status", "agent_name"]
    readonly_fields = ["id", "created_at"]


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ["name", "document_count", "embedding_model", "created_at"]
    search_fields = ["name"]
    readonly_fields = ["id", "created_at"]
