"""
Celery tasks for the retriever application.

All heavy-lifting (document indexing, pipeline execution, hypothetical
question generation, etc.) is performed asynchronously.
"""

import logging
import time

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def process_document_upload(self, document_ids: list[str], collection_name: str):
    """
    Index a batch of documents into ChromaDB.

    Args:
        document_ids: List of Document UUID strings to index.
        collection_name: Target ChromaDB collection name.
    """
    from .models import Document, Collection
    from .services.vector_store import ChromaDBService

    logger.info(
        "Indexing %d documents into collection '%s'.",
        len(document_ids),
        collection_name,
    )

    try:
        chroma_service = ChromaDBService()
        documents = Document.objects.filter(id__in=document_ids).select_related(
            "structured_metadata"
        )

        texts = []
        metadatas = []
        ids = []

        for doc in documents:
            texts.append(doc.content)
            meta = doc.metadata_json.copy() if doc.metadata_json else {}
            if hasattr(doc, "structured_metadata"):
                sm = doc.structured_metadata
                meta["year"] = sm.year
                meta["topics"] = sm.topics
                meta["subtopic"] = sm.subtopic
            metadatas.append(meta)
            ids.append(str(doc.id))

        chroma_service.add_documents(
            collection_name=collection_name,
            texts=texts,
            metadatas=metadatas,
            ids=ids,
        )

        # Update collection document count.
        collection, _ = Collection.objects.get_or_create(
            name=collection_name,
            defaults={"embedding_model": settings.OPENAI_EMBEDDING_MODEL},
        )
        collection.document_count = Document.objects.filter(
            collection_name=collection_name
        ).count()
        collection.save(update_fields=["document_count"])

        logger.info("Successfully indexed %d documents.", len(document_ids))

    except Exception as exc:
        logger.exception("Document indexing failed.")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=10)
def run_query_pipeline(self, query_id: str | None, request_data: dict):
    """
    Execute the full retrieval pipeline asynchronously.

    Stores results on the Query record when complete.

    Args:
        query_id: UUID string of the existing Query record (or None to create one).
        request_data: Dict matching QueryRequestSerializer fields.
    """
    from .models import Query, QueryResult, Document, AgentExecution
    from .services.retrievers import get_retriever
    from .services.augmentation import (
        CrossEncoderRerankerService,
        ContextCompressionService,
        QueryExpansionService,
    )

    start = time.time()

    try:
        if query_id:
            query_obj = Query.objects.get(id=query_id)
        else:
            query_obj = Query.objects.create(
                query_text=request_data["query"],
                retrieval_method=request_data.get("retrieval_method", "hybrid"),
                filters_applied=request_data.get("filters", {}),
            )

        # Create an agent execution record.
        agent_exec = AgentExecution.objects.create(
            query=query_obj,
            agent_name="async_retrieval_agent",
            status="running",
            input_data=request_data,
        )

        query_text = request_data["query"]
        method = request_data.get("retrieval_method", "hybrid")
        filters = request_data.get("filters", {})
        top_k = request_data.get("top_k", settings.DEFAULT_TOP_K)
        collection_name = request_data.get("collection_name", "renewable_energy")

        # Query expansion.
        if request_data.get("use_query_expansion"):
            expander = QueryExpansionService()
            query_text = expander.expand(query_text)

        # Core retrieval.
        retriever = get_retriever(method)
        raw_results = retriever.retrieve(
            query=query_text,
            top_k=top_k,
            collection_name=collection_name,
            filters=filters,
        )

        # Reranking.
        if request_data.get("use_reranking"):
            reranker = CrossEncoderRerankerService()
            raw_results = reranker.rerank(query_text, raw_results, top_k=top_k)

        # Compression.
        if request_data.get("use_compression"):
            compressor = ContextCompressionService()
            raw_results = compressor.compress(query_text, raw_results)

        # Persist results.
        for idx, doc_result in enumerate(raw_results):
            doc_id = doc_result.get("document_id")
            doc_obj = None
            if doc_id:
                try:
                    doc_obj = Document.objects.get(id=doc_id)
                except Document.DoesNotExist:
                    continue

            if doc_obj:
                QueryResult.objects.create(
                    query=query_obj,
                    document=doc_obj,
                    rank=idx + 1,
                    score=doc_result.get("score"),
                    retrieval_method=method,
                    is_reranked=request_data.get("use_reranking", False),
                    compressed_content=doc_result.get("compressed_content", ""),
                )

        elapsed_ms = (time.time() - start) * 1000
        query_obj.execution_time_ms = elapsed_ms
        query_obj.results_count = len(raw_results)
        query_obj.save(update_fields=["execution_time_ms", "results_count"])

        agent_exec.status = "completed"
        agent_exec.execution_time_ms = elapsed_ms
        agent_exec.output_data = {"results_count": len(raw_results)}
        agent_exec.save(
            update_fields=["status", "execution_time_ms", "output_data"]
        )

        logger.info("Async pipeline completed for query %s in %.1f ms.", query_id, elapsed_ms)

    except Exception as exc:
        logger.exception("Async pipeline failed for query %s.", query_id)
        if "agent_exec" in locals():
            agent_exec.status = "failed"
            agent_exec.error_message = str(exc)
            agent_exec.save(update_fields=["status", "error_message"])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=15)
def generate_hypothetical_questions(self, document_id: str):
    """
    Generate hypothetical questions for a document to improve retrieval.

    The questions are stored in the document's metadata and indexed in
    ChromaDB as separate entries pointing back to the parent document.

    Args:
        document_id: UUID string of the Document.
    """
    from .models import Document
    from .services.vector_store import ChromaDBService

    try:
        doc = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        logger.warning("Document %s not found, skipping HQ generation.", document_id)
        return

    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=settings.OPENAI_CHAT_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.7,
        )

        prompt = (
            "Generate 5 diverse hypothetical questions that a user might ask "
            "which would be answered by the following document. Return only "
            "the questions, one per line.\n\n"
            f"Document title: {doc.title}\n\n"
            f"Document content:\n{doc.content[:3000]}"
        )

        response = llm.invoke(prompt)
        questions = [
            q.strip()
            for q in response.content.strip().split("\n")
            if q.strip()
        ]

        # Store in metadata.
        meta = doc.metadata_json or {}
        meta["hypothetical_questions"] = questions
        doc.metadata_json = meta
        doc.save(update_fields=["metadata_json"])

        # Index questions as separate ChromaDB entries.
        chroma_service = ChromaDBService()
        texts = questions
        metadatas = [
            {"parent_document_id": str(doc.id), "type": "hypothetical_question"}
        ] * len(questions)
        ids = [f"{doc.id}_hq_{i}" for i in range(len(questions))]

        chroma_service.add_documents(
            collection_name=doc.collection_name,
            texts=texts,
            metadatas=metadatas,
            ids=ids,
        )

        logger.info(
            "Generated %d hypothetical questions for document %s.",
            len(questions),
            document_id,
        )

    except Exception as exc:
        logger.exception("HQ generation failed for document %s.", document_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1)
def reindex_collection(self, collection_name: str):
    """
    Drop and rebuild the ChromaDB index for an entire collection.

    Args:
        collection_name: Name of the collection to reindex.
    """
    from .models import Document
    from .services.vector_store import ChromaDBService

    logger.info("Reindexing collection '%s'.", collection_name)

    try:
        chroma_service = ChromaDBService()

        # Delete existing collection.
        chroma_service.delete_collection(collection_name)

        # Re-create and populate.
        documents = Document.objects.filter(
            collection_name=collection_name
        ).select_related("structured_metadata")

        batch_size = 100
        total = documents.count()
        processed = 0

        for offset in range(0, total, batch_size):
            batch = documents[offset : offset + batch_size]
            texts = []
            metadatas = []
            ids = []

            for doc in batch:
                texts.append(doc.content)
                meta = doc.metadata_json.copy() if doc.metadata_json else {}
                if hasattr(doc, "structured_metadata"):
                    sm = doc.structured_metadata
                    meta["year"] = sm.year
                    meta["topics"] = sm.topics
                    meta["subtopic"] = sm.subtopic
                metadatas.append(meta)
                ids.append(str(doc.id))

            chroma_service.add_documents(
                collection_name=collection_name,
                texts=texts,
                metadatas=metadatas,
                ids=ids,
            )
            processed += len(batch)
            logger.info("Reindexed %d / %d documents.", processed, total)

        logger.info("Reindex complete for collection '%s'.", collection_name)

    except Exception as exc:
        logger.exception("Reindex failed for collection '%s'.", collection_name)
        raise self.retry(exc=exc)


@shared_task
def cleanup_old_queries(days: int = 30):
    """
    Delete query records older than the specified number of days.

    Args:
        days: Age threshold in days.
    """
    from django.utils import timezone
    from datetime import timedelta
    from .models import Query

    cutoff = timezone.now() - timedelta(days=days)
    deleted_count, _ = Query.objects.filter(created_at__lt=cutoff).delete()
    logger.info("Cleaned up %d queries older than %d days.", deleted_count, days)
