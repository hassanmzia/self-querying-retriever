"""
Views for the retriever application.

Provides CRUD for documents, collections and pipelines, as well as the main
query endpoint that orchestrates the LangGraph-based retrieval agent.
"""

import logging
import time
import uuid

from django.conf import settings
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    AgentExecution,
    Collection,
    Document,
    DocumentMetadata,
    Query,
    QueryResult,
    RetrievalPipeline,
)
from .serializers import (
    AgentExecutionSerializer,
    BulkDocumentUploadSerializer,
    CollectionSerializer,
    DocumentListSerializer,
    DocumentSerializer,
    DocumentUploadSerializer,
    PipelineConfigSerializer,
    QueryListSerializer,
    QueryRequestSerializer,
    QueryResponseSerializer,
    QuerySerializer,
    RetrievalPipelineSerializer,
)
from .tasks import process_document_upload, run_query_pipeline

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Document CRUD
# ---------------------------------------------------------------------------


class DocumentViewSet(viewsets.ModelViewSet):
    """
    CRUD operations on documents.

    Extra actions:
    - ``POST /bulk_upload/`` -- upload many documents at once.
    - ``POST /search/``      -- lightweight search by title / content.
    """

    queryset = Document.objects.select_related("structured_metadata").all()
    serializer_class = DocumentSerializer
    filterset_fields = ["collection_name"]
    search_fields = ["title", "content"]
    ordering_fields = ["created_at", "title"]

    def get_queryset(self):
        qs = super().get_queryset()
        # Resolve collection UUID to name (frontend sends UUID as collection_name).
        coll = self.request.query_params.get("collection_name", "")
        if coll and len(coll) == 36 and "-" in coll:
            try:
                col_obj = Collection.objects.get(id=coll)
                qs = qs.filter(collection_name=col_obj.name)
                # Remove from further django-filter processing since we handled it.
                self.request.query_params._mutable = True
                self.request.query_params.pop("collection_name", None)
                self.request.query_params._mutable = False
            except (Collection.DoesNotExist, ValueError):
                pass
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return DocumentListSerializer
        return DocumentSerializer

    @action(detail=False, methods=["post"], url_path="bulk-upload")
    def bulk_upload(self, request):
        """Accept a list of documents and queue them for async indexing."""
        serializer = BulkDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        documents_data = serializer.validated_data["documents"]
        collection_name = serializer.validated_data.get(
            "collection_name", "renewable_energy"
        )
        created_ids = []

        for doc_data in documents_data:
            doc = Document.objects.create(
                title=doc_data["title"],
                content=doc_data["content"],
                source=doc_data.get("source", ""),
                collection_name=doc_data.get("collection_name", collection_name),
                metadata_json=doc_data.get("metadata", {}),
            )
            DocumentMetadata.objects.create(
                document=doc,
                year=doc_data.get("year"),
                topics=doc_data.get("topics", []),
                subtopic=doc_data.get("subtopic", ""),
            )
            created_ids.append(str(doc.id))

        # Fire async indexing task for the whole batch.
        process_document_upload.delay(created_ids, collection_name)

        return Response(
            {"status": "queued", "document_ids": created_ids},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["post"])
    def search(self, request):
        """Simple Postgres full-text search on title and content."""
        query_text = request.data.get("query", "")
        if not query_text:
            return Response(
                {"error": "query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        qs = Document.objects.filter(
            title__icontains=query_text
        ) | Document.objects.filter(content__icontains=query_text)
        qs = qs[:20]
        serializer = DocumentSerializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Create the document and optionally queue vector indexing."""
        doc = serializer.save()
        # Create metadata record from metadata_json if present.
        meta = doc.metadata_json or {}
        DocumentMetadata.objects.get_or_create(
            document=doc,
            defaults={
                "year": meta.get("year"),
                "topics": meta.get("topics", []),
                "subtopic": meta.get("subtopic", ""),
            },
        )
        process_document_upload.delay([str(doc.id)], doc.collection_name)


# ---------------------------------------------------------------------------
# Collection CRUD
# ---------------------------------------------------------------------------


class CollectionViewSet(viewsets.ModelViewSet):
    """CRUD for vector-store collections with a stats action."""

    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    lookup_field = "name"

    def get_object(self):
        """Look up collection by UUID first, then fall back to name."""
        lookup = self.kwargs.get(self.lookup_field, "")
        # Try UUID lookup first (frontend sends UUIDs).
        if len(lookup) == 36 and "-" in lookup:
            try:
                obj = Collection.objects.get(id=lookup)
                self.check_object_permissions(self.request, obj)
                return obj
            except (Collection.DoesNotExist, ValueError):
                pass
        # Fall back to default name-based lookup.
        return super().get_object()

    @action(detail=True, methods=["get"])
    def stats(self, request, name=None):
        """Return document count and metadata distribution for a collection."""
        collection = self.get_object()
        docs = Document.objects.filter(collection_name=collection.name)
        year_distribution = (
            DocumentMetadata.objects.filter(document__collection_name=collection.name)
            .values("year")
            .annotate(count=Count("id"))
            .order_by("year")
        )
        return Response(
            {
                "collection": collection.name,
                "document_count": docs.count(),
                "year_distribution": list(year_distribution),
            }
        )


# ---------------------------------------------------------------------------
# Query history
# ---------------------------------------------------------------------------


class QueryViewSet(viewsets.ModelViewSet):
    """
    List / retrieve query history.  Creating a query is done through
    ``QueryAPIView`` below which orchestrates the full pipeline.
    """

    queryset = Query.objects.prefetch_related("results__document").all()
    filterset_fields = ["retrieval_method"]
    ordering_fields = ["created_at", "execution_time_ms"]

    def get_serializer_class(self):
        if self.action == "list":
            return QueryListSerializer
        return QuerySerializer

    @action(detail=True, methods=["get"])
    def results(self, request, pk=None):
        """Return just the results for a specific query."""
        query = self.get_object()
        results = query.results.select_related("document").all()
        from .serializers import QueryResultSerializer

        return Response(QueryResultSerializer(results, many=True).data)


# ---------------------------------------------------------------------------
# Main query endpoint (triggers the retrieval agent pipeline)
# ---------------------------------------------------------------------------


class QueryAPIView(APIView):
    """
    ``POST /api/v1/retriever/query/``

    Main entry point for running a query through the LangGraph retrieval
    agent.  Accepts the query string, chosen retrieval method, optional
    filters and augmentation flags, then returns scored results.
    """

    def post(self, request):
        serializer = QueryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        start = time.time()

        # Persist the query record.
        query_obj = Query.objects.create(
            user=request.user if request.user.is_authenticated else None,
            query_text=data["query"],
            retrieval_method=data.get("retrieval_method", "hybrid"),
            filters_applied=data.get("filters", {}),
        )

        try:
            # Attempt synchronous execution for low-latency.  If the service
            # layer is not yet available (e.g. ChromaDB down), fall back to
            # async Celery task.
            result_payload = self._execute_pipeline(query_obj, data)
            elapsed_ms = (time.time() - start) * 1000
            query_obj.execution_time_ms = elapsed_ms
            query_obj.results_count = len(result_payload.get("results", []))
            query_obj.save(update_fields=["execution_time_ms", "results_count"])

            response_data = {
                "query_id": str(query_obj.id),
                "query": data["query"],
                "results": result_payload.get("results", []),
                "pipeline_used": data.get("retrieval_method", "hybrid"),
                "execution_time_ms": elapsed_ms,
                "agent_trace": result_payload.get("agent_trace", {}),
                "expanded_query": result_payload.get("expanded_query", ""),
            }
            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as exc:
            logger.exception("Pipeline execution failed, falling back to async.")
            # Queue for background processing.
            run_query_pipeline.delay(str(query_obj.id), data)
            return Response(
                {
                    "query_id": str(query_obj.id),
                    "status": "processing",
                    "message": (
                        "Query is being processed asynchronously. "
                        "Poll the query endpoint for results."
                    ),
                    "error_detail": str(exc),
                },
                status=status.HTTP_202_ACCEPTED,
            )

    # ------------------------------------------------------------------

    def _execute_pipeline(self, query_obj, data):
        """
        Run the retrieval pipeline synchronously.

        Imports are deferred so Django can start even if ML libs are missing.
        """
        from .services.retrievers import get_retriever
        from .services.augmentation import (
            CrossEncoderRerankerService,
            ContextCompressionService,
            QueryExpansionService,
        )

        query_text = data["query"]
        method = data.get("retrieval_method", "hybrid")
        filters = data.get("filters", {})
        top_k = data.get("top_k", settings.DEFAULT_TOP_K)
        collection_name = data.get("collection_name", "renewable_energy")

        # Resolve collection UUID to name if needed (frontend sends UUID as collection_id)
        if collection_name and len(collection_name) == 36 and "-" in collection_name:
            try:
                col = Collection.objects.get(id=collection_name)
                collection_name = col.name
            except (Collection.DoesNotExist, ValueError):
                pass  # Not a valid UUID or not found — use as-is

        expanded_query = ""

        # Optional query expansion.
        if data.get("use_query_expansion"):
            expander = QueryExpansionService()
            query_text = expander.expand(query_text)
            expanded_query = query_text

        # Core retrieval.
        retriever = get_retriever(method)
        raw_results = retriever.retrieve(
            query=query_text,
            top_k=top_k,
            collection_name=collection_name,
            filters=filters,
        )

        # Optional reranking.
        if data.get("use_reranking"):
            reranker = CrossEncoderRerankerService()
            raw_results = reranker.rerank(query_text, raw_results, top_k=top_k)

        # Optional compression.
        if data.get("use_compression"):
            compressor = ContextCompressionService()
            raw_results = compressor.compress(query_text, raw_results)

        # Persist individual results.
        result_items = []
        for idx, doc_result in enumerate(raw_results):
            doc_id = doc_result.get("document_id", "")
            # Strip _chunk_N suffix if present (ChromaDB stores chunk IDs).
            if "_chunk_" in doc_id:
                doc_id = doc_id.split("_chunk_")[0]
            doc_obj = None
            if doc_id:
                try:
                    doc_obj = Document.objects.get(id=doc_id)
                except (Document.DoesNotExist, Exception):
                    pass

            if doc_obj:
                QueryResult.objects.create(
                    query=query_obj,
                    document=doc_obj,
                    rank=idx + 1,
                    score=doc_result.get("score"),
                    retrieval_method=method,
                    is_reranked=data.get("use_reranking", False),
                    compressed_content=doc_result.get("compressed_content", ""),
                )

            result_items.append(
                {
                    "document_id": doc_id or str(uuid.uuid4()),
                    "title": doc_result.get("title", ""),
                    "content": doc_result.get("content", ""),
                    "score": doc_result.get("score"),
                    "metadata": doc_result.get("metadata", {}),
                    "retrieval_method": method,
                    "is_reranked": data.get("use_reranking", False),
                    "compressed_content": doc_result.get("compressed_content", ""),
                }
            )

        # Build agent trace.
        agent_trace = {
            "method": method,
            "use_reranking": data.get("use_reranking", False),
            "use_compression": data.get("use_compression", False),
            "use_query_expansion": data.get("use_query_expansion", False),
            "filters": filters,
            "top_k": top_k,
        }

        return {
            "results": result_items,
            "agent_trace": agent_trace,
            "expanded_query": expanded_query,
        }


# ---------------------------------------------------------------------------
# Retrieval pipeline CRUD + execute
# ---------------------------------------------------------------------------


class RetrievalPipelineViewSet(viewsets.ModelViewSet):
    """CRUD for saved retrieval pipeline configurations."""

    queryset = RetrievalPipeline.objects.all()
    serializer_class = RetrievalPipelineSerializer

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        """Execute the saved pipeline with a given query."""
        pipeline = self.get_object()
        query_text = request.data.get("query")
        if not query_text:
            return Response(
                {"error": "query is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = pipeline.pipeline_config
        request_data = {
            "query": query_text,
            "retrieval_method": config.get("retrieval_method", "hybrid"),
            "filters": config.get("filters", {}),
            "use_reranking": config.get("use_reranking", False),
            "use_compression": config.get("use_compression", False),
            "use_query_expansion": config.get("use_query_expansion", False),
            "top_k": config.get("top_k", 5),
            "collection_name": config.get("collection_name", "renewable_energy"),
        }

        # Delegate to the main query view logic.
        view = QueryAPIView()
        view.request = request
        fake_request = type(request)
        # Build a minimal request-like object.
        from rest_framework.request import Request
        from django.test import RequestFactory

        factory = RequestFactory()
        inner_request = factory.post(
            "/api/v1/retriever/query/",
            data=request_data,
            content_type="application/json",
        )
        drf_request = Request(inner_request)
        drf_request._full_data = request_data

        return view.post(drf_request)


# ---------------------------------------------------------------------------
# Agent execution history
# ---------------------------------------------------------------------------


class AgentExecutionViewSet(viewsets.ReadOnlyModelViewSet):
    """List and detail views for agent execution records."""

    queryset = AgentExecution.objects.select_related("query").all()
    serializer_class = AgentExecutionSerializer
    filterset_fields = ["status", "agent_name"]
    ordering_fields = ["created_at", "execution_time_ms"]

    @action(detail=False, methods=["get"])
    def graph(self, request):
        """Return the agent workflow graph for visualization."""
        from .agents.visualization import get_agent_flow_diagram

        data = get_agent_flow_diagram()

        return Response({
            "data": {"definition": data["mermaid"]},
            "status": 200,
        })

    @action(detail=True, methods=["post"])
    def replay(self, request, pk=None):
        """Re-run an agent execution with the same parameters."""
        execution = self.get_object()
        if not execution.query:
            return Response(
                {"error": "No associated query to replay."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        input_data = execution.input_data or {}
        request_data = {
            "query": execution.query.query_text,
            "retrieval_method": input_data.get(
                "retrieval_method", execution.query.retrieval_method
            ),
            "filters": input_data.get("filters", {}),
            "use_reranking": input_data.get("use_reranking", False),
            "use_compression": input_data.get("use_compression", False),
            "use_query_expansion": input_data.get("use_query_expansion", False),
            "top_k": input_data.get("top_k", 5),
        }
        run_query_pipeline.delay(None, request_data)
        return Response(
            {"status": "queued", "message": "Replay has been queued."},
            status=status.HTTP_202_ACCEPTED,
        )


# ---------------------------------------------------------------------------
# Agent list (static definitions for the frontend agent cards)
# ---------------------------------------------------------------------------

_AGENT_TYPE_MAP = {
    "query_analyzer": "router",
    "supervisor": "router",
    "query_expander": "augmenter",
    "self_query_constructor": "retriever",
    "vector_retriever": "retriever",
    "bm25_retriever": "retriever",
    "hybrid_merger": "retriever",
    "hypothetical_question_retriever": "retriever",
    "reranker": "ranker",
    "compressor": "augmenter",
    "answer_generator": "synthesizer",
}

_AGENT_CAPABILITIES = {
    "query_analyzer": ["query analysis", "strategy selection"],
    "supervisor": ["routing", "orchestration"],
    "query_expander": ["query expansion", "synonym generation"],
    "self_query_constructor": ["metadata filtering", "structured query"],
    "vector_retriever": ["semantic search", "embedding similarity"],
    "bm25_retriever": ["keyword search", "TF-IDF"],
    "hybrid_merger": ["ensemble retrieval", "score fusion"],
    "hypothetical_question_retriever": ["hypothetical questions", "HyDE"],
    "reranker": ["cross-encoder reranking", "precision improvement"],
    "compressor": ["context compression", "relevance extraction"],
    "answer_generator": ["answer synthesis", "response generation"],
}


class AgentListView(APIView):
    """Return static agent definitions for the frontend agent cards."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from .agents.visualization import get_agent_flow_diagram

        data = get_agent_flow_diagram()
        agents = []
        for node in data["nodes"]:
            if node["type"] == "terminal":
                continue
            node_id = node["id"]
            agents.append({
                "id": node_id,
                "name": node["label"],
                "description": f"{node['label']} agent in the retrieval pipeline",
                "type": _AGENT_TYPE_MAP.get(node_id, "retriever"),
                "status": "idle",
                "capabilities": _AGENT_CAPABILITIES.get(node_id, [node["type"]]),
            })

        return Response({"data": agents, "status": 200})


# ---------------------------------------------------------------------------
# Agent graph visualization
# ---------------------------------------------------------------------------


class AgentGraphView(APIView):
    """Return the agent workflow graph for visualization."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from .agents.visualization import get_agent_flow_diagram

        data = get_agent_flow_diagram()

        return Response({
            "data": {"definition": data["mermaid"]},
            "status": 200,
        })


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class HealthCheckView(APIView):
    """Simple health-check endpoint."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        health = {"status": "healthy", "timestamp": timezone.now().isoformat()}

        # Check database.
        try:
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            health["database"] = "ok"
        except Exception as exc:
            health["database"] = f"error: {exc}"
            health["status"] = "degraded"

        # Check Redis.
        try:
            from django.core.cache import cache

            cache.set("_health", "ok", 5)
            health["redis"] = "ok" if cache.get("_health") == "ok" else "error"
        except Exception as exc:
            health["redis"] = f"error: {exc}"
            health["status"] = "degraded"

        # Check ChromaDB.
        try:
            import chromadb

            client = chromadb.HttpClient(
                host=settings.CHROMA_HOST, port=settings.CHROMA_PORT
            )
            client.heartbeat()
            health["chromadb"] = "ok"
        except Exception as exc:
            health["chromadb"] = f"error: {exc}"
            health["status"] = "degraded"

        status_code = (
            status.HTTP_200_OK
            if health["status"] == "healthy"
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(health, status=status_code)


# ---------------------------------------------------------------------------
# Analytics view
# ---------------------------------------------------------------------------


class AnalyticsView(APIView):
    """Aggregated query analytics for the retriever system."""

    def get(self, request):
        total_queries = Query.objects.count()
        avg_execution = Query.objects.aggregate(avg=Avg("execution_time_ms"))["avg"]

        method_counts = (
            Query.objects.values("retrieval_method")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        recent_queries = Query.objects.order_by("-created_at")[:10]
        recent_data = QueryListSerializer(recent_queries, many=True).data

        return Response(
            {
                "total_queries": total_queries,
                "avg_execution_time_ms": round(avg_execution, 2) if avg_execution else 0,
                "popular_methods": list(method_counts),
                "recent_queries": recent_data,
            }
        )
