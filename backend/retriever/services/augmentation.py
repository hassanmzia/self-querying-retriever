"""
Post-retrieval augmentation services.

Provides three augmentation stages that can be stacked on top of any
retriever's output:

1. **CrossEncoderRerankerService** -- reranks results with
   ``ms-marco-MiniLM-L-6-v2``.
2. **ContextCompressionService** -- extracts the most relevant sentences
   from each result using an LLM (``LLMChainExtractor`` pattern).
3. **QueryExpansionService** -- rewrites / expands the query before
   retrieval for better recall.
"""

import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Cross-encoder reranking
# ---------------------------------------------------------------------------


class CrossEncoderRerankerService:
    """
    Re-scores and re-orders retrieval results using a cross-encoder model.

    Default model: ``cross-encoder/ms-marco-MiniLM-L-6-v2``.
    """

    def __init__(self, model_name: str | None = None):
        self.model_name = model_name or settings.CROSS_ENCODER_MODEL
        self._model = None

    @property
    def model(self):
        """Lazy-load the cross-encoder to keep import time low."""
        if self._model is None:
            from sentence_transformers import CrossEncoder

            logger.info("Loading cross-encoder model '%s'.", self.model_name)
            self._model = CrossEncoder(self.model_name)
        return self._model

    def rerank(
        self,
        query: str,
        results: list[dict[str, Any]],
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Re-rank a list of result dicts by cross-encoder relevance.

        Args:
            query: The original user query.
            results: List of result dicts (must contain ``content``).
            top_k: Number of results to keep after reranking.

        Returns:
            Re-ordered (and possibly trimmed) result list with updated
            ``score`` values.
        """
        if not results:
            return results

        pairs = [(query, doc["content"]) for doc in results]

        try:
            scores = self.model.predict(pairs)
        except Exception as exc:
            logger.exception("Cross-encoder reranking failed: %s", exc)
            return results[:top_k]

        # Attach scores and sort descending.
        for doc, score in zip(results, scores):
            doc["score"] = round(float(score), 4)
            doc["is_reranked"] = True

        reranked = sorted(results, key=lambda d: d["score"], reverse=True)
        return reranked[:top_k]


# ---------------------------------------------------------------------------
# 2. Context compression (LLMChainExtractor pattern)
# ---------------------------------------------------------------------------


class ContextCompressionService:
    """
    Compresses each retrieved document to only the sentences most
    relevant to the query, using an LLM as an extractor.
    """

    def compress(
        self,
        query: str,
        results: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """
        Compress content of each result to the most relevant excerpt.

        Args:
            query: The original user query.
            results: List of result dicts (must contain ``content``).

        Returns:
            The same list with ``compressed_content`` populated.
        """
        if not results:
            return results

        try:
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                model=settings.OPENAI_CHAT_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=0.0,
            )

            for doc in results:
                content = doc.get("content", "")
                if not content:
                    doc["compressed_content"] = ""
                    continue

                prompt = (
                    "Extract ONLY the sentences from the following document "
                    "that are directly relevant to the query.  Do not add any "
                    "commentary.  If nothing is relevant, respond with "
                    "'No relevant content found.'\n\n"
                    f"Query: {query}\n\n"
                    f"Document:\n{content[:4000]}\n\n"
                    "Relevant excerpt:"
                )

                try:
                    response = llm.invoke(prompt)
                    doc["compressed_content"] = response.content.strip()
                except Exception as inner_exc:
                    logger.warning(
                        "Compression failed for one document: %s", inner_exc
                    )
                    doc["compressed_content"] = content[:500]

        except Exception as exc:
            logger.exception("Context compression service error: %s", exc)
            for doc in results:
                doc.setdefault("compressed_content", doc.get("content", "")[:500])

        return results


# ---------------------------------------------------------------------------
# 3. Query expansion / prompt enhancement
# ---------------------------------------------------------------------------


class QueryExpansionService:
    """
    Rewrites or expands the user query to improve retrieval recall.

    Uses an LLM to produce a richer version of the query that captures
    alternative phrasings, synonyms and related concepts.
    """

    def expand(self, query: str) -> str:
        """
        Expand the query using an LLM.

        Args:
            query: Original user query.

        Returns:
            An expanded version of the query.  Falls back to the original
            query on error.
        """
        try:
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                model=settings.OPENAI_CHAT_MODEL,
                api_key=settings.OPENAI_API_KEY,
                temperature=0.3,
            )

            prompt = (
                "You are a search query optimizer for a renewable energy "
                "document database.  Rewrite the following query to improve "
                "search recall by adding synonyms, related terms and "
                "alternative phrasings.  Return ONLY the enhanced query, "
                "nothing else.\n\n"
                f"Original query: {query}\n\n"
                "Enhanced query:"
            )
            response = llm.invoke(prompt)
            expanded = response.content.strip()
            logger.info(
                "Query expanded: '%s' -> '%s'",
                query,
                expanded[:120],
            )
            return expanded

        except Exception as exc:
            logger.warning("Query expansion failed (%s), using original.", exc)
            return query
