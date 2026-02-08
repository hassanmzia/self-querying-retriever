"""
Retriever implementations for the Self-Querying Retriever application.

Each retriever class implements a ``retrieve()`` method that returns a
standardised list of result dicts::

    [
        {
            "document_id": str,
            "title": str,
            "content": str,
            "score": float | None,
            "metadata": dict,
        },
        ...
    ]
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------


class BaseRetriever(ABC):
    """Abstract base for all retriever implementations."""

    @abstractmethod
    def retrieve(
        self,
        query: str,
        top_k: int = 5,
        collection_name: str = "renewable_energy",
        filters: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Execute retrieval and return scored documents."""
        ...

    @staticmethod
    def _chroma_results_to_dicts(raw: list[dict]) -> list[dict[str, Any]]:
        """Convert ChromaDB result dicts to the standard format."""
        results = []
        for item in raw:
            # Convert cosine distance to similarity score (1 - distance).
            distance = item.get("distance")
            score = round(1.0 - distance, 4) if distance is not None else None

            # Extract the real document UUID from metadata (stored by the
            # Celery indexing task) rather than using the ChromaDB chunk ID
            # which has a _chunk_N suffix.
            metadata = item.get("metadata") or {}
            chroma_id = item.get("id", "")
            doc_id = metadata.get("document_id") or chroma_id.split("_chunk_")[0] or chroma_id

            results.append(
                {
                    "document_id": doc_id,
                    "title": metadata.get("title", ""),
                    "content": item.get("document", ""),
                    "score": score,
                    "metadata": metadata,
                }
            )
        return results


# ---------------------------------------------------------------------------
# 1. Basic vector retrieval (no metadata filtering)
# ---------------------------------------------------------------------------


class VanillaRetriever(BaseRetriever):
    """
    Straightforward cosine-similarity search over ChromaDB embeddings.

    No metadata filters are applied; ranking relies solely on the
    vector distance.
    """

    def retrieve(self, query, top_k=5, collection_name="renewable_energy", filters=None):
        from .vector_store import ChromaDBService

        chroma = ChromaDBService()
        raw = chroma.search(
            collection_name=collection_name,
            query_text=query,
            top_k=top_k,
        )
        return self._chroma_results_to_dicts(raw)


# ---------------------------------------------------------------------------
# 2. Self-querying retriever with metadata filtering
# ---------------------------------------------------------------------------


class SelfQueryRetriever(BaseRetriever):
    """
    Uses an LLM to decompose the user query into a semantic query **and**
    structured metadata filters (year, topics, subtopic) that are passed
    to ChromaDB's ``where`` clause.
    """

    # Metadata field descriptions used by the LLM query constructor.
    METADATA_FIELDS = [
        {
            "name": "year",
            "description": "The publication year of the document (2023-2025).",
            "type": "integer",
        },
        {
            "name": "topics",
            "description": (
                "Comma-separated renewable energy topics "
                "(e.g. solar, wind, hydrogen, geothermal)."
            ),
            "type": "string",
        },
        {
            "name": "subtopic",
            "description": "Specific subtopic within the broader topic area.",
            "type": "string",
        },
    ]

    def retrieve(self, query, top_k=5, collection_name="renewable_energy", filters=None):
        from langchain_openai import ChatOpenAI

        # If the caller already supplied explicit filters, use them directly.
        where_clause = self._build_where(filters) if filters else self._llm_parse_filters(query)

        from .vector_store import ChromaDBService

        chroma = ChromaDBService()
        raw = chroma.search(
            collection_name=collection_name,
            query_text=query,
            top_k=top_k,
            where=where_clause if where_clause else None,
        )
        return self._chroma_results_to_dicts(raw)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _llm_parse_filters(self, query: str) -> dict | None:
        """Ask the LLM to extract metadata filters from the query."""
        try:
            from langchain_openai import ChatOpenAI
            import json

            llm = ChatOpenAI(
                model=settings.OPENAI_CHAT_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=0.0,
            )

            field_desc = "\n".join(
                f"- {f['name']} ({f['type']}): {f['description']}"
                for f in self.METADATA_FIELDS
            )

            prompt = (
                "You are a metadata filter extractor.  Given the user query, "
                "extract any metadata filters that should be applied.  Return "
                "ONLY valid JSON with filter keys/values.  If no filters are "
                "applicable, return an empty JSON object {{}}.\n\n"
                f"Available metadata fields:\n{field_desc}\n\n"
                f"User query: {query}\n\n"
                "JSON filters:"
            )
            response = llm.invoke(prompt)
            raw_text = response.content.strip()
            # Strip markdown fences if present.
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(raw_text)
            return self._build_where(parsed) if parsed else None
        except Exception as exc:
            logger.warning("LLM filter extraction failed: %s", exc)
            return None

    @staticmethod
    def _build_where(filters: dict) -> dict | None:
        """
        Convert a flat filter dict into a ChromaDB ``where`` clause.

        Supports:
        - ``year`` (int) -> ``{"year": {"$eq": value}}``
        - ``topics`` (str) -> ``{"topics": {"$contains": value}}``
        - ``subtopic`` (str) -> ``{"subtopic": {"$eq": value}}``
        """
        if not filters:
            return None

        conditions = []
        if "year" in filters and filters["year"] is not None:
            conditions.append({"year": {"$eq": int(filters["year"])}})
        if "topics" in filters and filters["topics"]:
            topic_val = filters["topics"]
            if isinstance(topic_val, list):
                topic_val = ", ".join(topic_val)
            conditions.append({"topics": {"$contains": topic_val}})
        if "subtopic" in filters and filters["subtopic"]:
            conditions.append({"subtopic": {"$eq": filters["subtopic"]}})

        if not conditions:
            return None
        if len(conditions) == 1:
            return conditions[0]
        return {"$and": conditions}


# ---------------------------------------------------------------------------
# 3. Hypothetical question retriever
# ---------------------------------------------------------------------------


class HypotheticalQuestionRetriever(BaseRetriever):
    """
    Generates a hypothetical answer or question, then uses it as the
    search query to improve recall (HyDE-style).
    """

    def retrieve(self, query, top_k=5, collection_name="renewable_energy", filters=None):
        hypothetical = self._generate_hypothetical(query)

        from .vector_store import ChromaDBService

        chroma = ChromaDBService()
        where_clause = SelfQueryRetriever._build_where(filters) if filters else None
        raw = chroma.search(
            collection_name=collection_name,
            query_text=hypothetical,
            top_k=top_k,
            where=where_clause,
        )
        return self._chroma_results_to_dicts(raw)

    @staticmethod
    def _generate_hypothetical(query: str) -> str:
        """Use an LLM to generate a hypothetical document passage."""
        try:
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                model=settings.OPENAI_CHAT_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=0.7,
            )
            prompt = (
                "Write a short factual paragraph that would be the ideal "
                "answer to the following question about renewable energy.  "
                "Be specific and include relevant technical details.\n\n"
                f"Question: {query}\n\nAnswer:"
            )
            response = llm.invoke(prompt)
            return response.content.strip()
        except Exception as exc:
            logger.warning("Hypothetical generation failed (%s), using original query.", exc)
            return query


# ---------------------------------------------------------------------------
# 4. BM25 keyword retriever
# ---------------------------------------------------------------------------


class BM25KeywordRetriever(BaseRetriever):
    """
    Performs BM25 keyword-based retrieval over the PostgreSQL document
    corpus.  Does **not** use vector embeddings.
    """

    def retrieve(self, query, top_k=5, collection_name="renewable_energy", filters=None):
        from retriever.models import Document

        import numpy as np
        from rank_bm25 import BM25Okapi

        docs = list(
            Document.objects.filter(collection_name=collection_name).values(
                "id", "title", "content", "metadata_json"
            )
        )

        if not docs:
            return []

        # Tokenise corpus.
        corpus = [doc["content"].lower().split() for doc in docs]
        bm25 = BM25Okapi(corpus)

        query_tokens = query.lower().split()
        scores = bm25.get_scores(query_tokens)

        # Rank and take top_k.
        ranked_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in ranked_indices:
            doc = docs[idx]
            results.append(
                {
                    "document_id": str(doc["id"]),
                    "title": doc.get("title", ""),
                    "content": doc["content"],
                    "score": round(float(scores[idx]), 4),
                    "metadata": doc.get("metadata_json", {}),
                }
            )
        return results


# ---------------------------------------------------------------------------
# 5. Hybrid search (BM25 + vector ensemble)
# ---------------------------------------------------------------------------


class HybridSearchRetriever(BaseRetriever):
    """
    Ensemble retriever that combines BM25 keyword scores with vector
    similarity scores using reciprocal rank fusion (RRF).
    """

    def __init__(self, vector_weight: float = 0.5, bm25_weight: float = 0.5):
        self.vector_weight = vector_weight
        self.bm25_weight = bm25_weight

    def retrieve(self, query, top_k=5, collection_name="renewable_energy", filters=None):
        # Fetch results from both retrievers (over-fetch for better fusion).
        fetch_k = top_k * 3

        vector_results = VanillaRetriever().retrieve(
            query=query,
            top_k=fetch_k,
            collection_name=collection_name,
            filters=filters,
        )
        bm25_results = BM25KeywordRetriever().retrieve(
            query=query,
            top_k=fetch_k,
            collection_name=collection_name,
            filters=filters,
        )

        # Reciprocal Rank Fusion.
        rrf_scores: dict[str, float] = {}
        doc_map: dict[str, dict] = {}
        k = 60  # RRF constant.

        for rank, doc in enumerate(vector_results):
            doc_id = doc["document_id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + self.vector_weight / (
                k + rank + 1
            )
            doc_map[doc_id] = doc

        for rank, doc in enumerate(bm25_results):
            doc_id = doc["document_id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + self.bm25_weight / (
                k + rank + 1
            )
            if doc_id not in doc_map:
                doc_map[doc_id] = doc

        # Sort by fused score.
        sorted_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)[:top_k]

        results = []
        for doc_id in sorted_ids:
            doc = doc_map[doc_id]
            doc["score"] = round(rrf_scores[doc_id], 6)
            results.append(doc)

        return results


# ---------------------------------------------------------------------------
# Factory function
# ---------------------------------------------------------------------------

_RETRIEVER_MAP = {
    "vanilla": VanillaRetriever,
    "self_query": SelfQueryRetriever,
    "hypothetical": HypotheticalQuestionRetriever,
    "bm25": BM25KeywordRetriever,
    "hybrid": HybridSearchRetriever,
}


def get_retriever(method: str) -> BaseRetriever:
    """
    Return an instantiated retriever for the given method name.

    Args:
        method: One of ``vanilla``, ``self_query``, ``hypothetical``,
                ``bm25``, ``hybrid``.

    Returns:
        A ``BaseRetriever`` subclass instance.

    Raises:
        ValueError: If the method is not recognised.
    """
    cls = _RETRIEVER_MAP.get(method)
    if cls is None:
        raise ValueError(
            f"Unknown retrieval method '{method}'. "
            f"Choose from: {', '.join(_RETRIEVER_MAP.keys())}"
        )
    return cls()
