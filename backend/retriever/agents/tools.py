"""
LangGraph-compatible tools for the multi-agent retrieval pipeline.

Each tool is decorated with ``@tool`` so it can be bound to a LangChain
tool-calling LLM or used programmatically inside graph nodes.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from langchain_core.documents import Document
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper -- lazy access to shared resources
# ---------------------------------------------------------------------------

def _get_vectorstore():
    """Return the application-wide ChromaDB vectorstore instance.

    Imported lazily to avoid circular imports and to allow Django settings
    to be fully configured before any Chroma client is created.
    """
    from langchain_chroma import Chroma
    from langchain_openai import OpenAIEmbeddings

    from django.conf import settings

    embeddings = OpenAIEmbeddings(
        model=getattr(settings, "EMBEDDING_MODEL", "text-embedding-ada-002"),
    )
    vectorstore = Chroma(
        collection_name=getattr(
            settings, "CHROMA_COLLECTION", "Renewable_enery_with_Metadata"
        ),
        embedding_function=embeddings,
        persist_directory=getattr(settings, "CHROMA_PERSIST_DIR", None),
    )
    return vectorstore


def _get_llm():
    """Return the default ChatOpenAI instance."""
    from langchain_openai import ChatOpenAI

    from django.conf import settings

    return ChatOpenAI(
        model=getattr(settings, "LLM_MODEL", "gpt-4o-mini"),
        temperature=0,
    )


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool
def search_documents(
    query: str,
    top_k: int = 4,
) -> List[Dict[str, Any]]:
    """Search the ChromaDB vector store using semantic similarity.

    Args:
        query: The search query string.
        top_k: Maximum number of results to return.

    Returns:
        A list of dicts with keys ``page_content`` and ``metadata``.
    """
    try:
        vectorstore = _get_vectorstore()
        docs = vectorstore.similarity_search(query, k=top_k)
        return [
            {"page_content": d.page_content, "metadata": d.metadata}
            for d in docs
        ]
    except Exception as exc:
        logger.exception("search_documents failed")
        return [{"error": str(exc)}]


@tool
def filter_by_metadata(
    query: str,
    filters: Dict[str, Any],
    top_k: int = 4,
) -> List[Dict[str, Any]]:
    """Search the vector store with metadata filters applied.

    Args:
        query: The semantic search query.
        filters: A dict of metadata key/value pairs to filter on.
            Supported keys: ``year`` (int), ``topics`` (str),
            ``subtopic`` (str).
        top_k: Maximum number of results to return.

    Returns:
        A list of dicts with keys ``page_content`` and ``metadata``.
    """
    try:
        vectorstore = _get_vectorstore()

        # Build a Chroma-compatible ``where`` clause.
        where_clause: Dict[str, Any] = {}
        if "year" in filters:
            where_clause["year"] = int(filters["year"])
        if "topics" in filters:
            where_clause["topics"] = filters["topics"]
        if "subtopic" in filters:
            where_clause["subtopic"] = filters["subtopic"]

        if not where_clause:
            docs = vectorstore.similarity_search(query, k=top_k)
        else:
            # When multiple filters are provided, Chroma expects ``$and``.
            if len(where_clause) > 1:
                chroma_where = {
                    "$and": [
                        {k: {"$eq": v}} for k, v in where_clause.items()
                    ]
                }
            else:
                key, val = next(iter(where_clause.items()))
                chroma_where = {key: {"$eq": val}}

            docs = vectorstore.similarity_search(
                query, k=top_k, filter=chroma_where
            )

        return [
            {"page_content": d.page_content, "metadata": d.metadata}
            for d in docs
        ]
    except Exception as exc:
        logger.exception("filter_by_metadata failed")
        return [{"error": str(exc)}]


@tool
def get_document_by_id(doc_id: str) -> Dict[str, Any]:
    """Retrieve a specific document from ChromaDB by its ID.

    Args:
        doc_id: The document identifier.

    Returns:
        A dict with ``page_content`` and ``metadata``, or an error dict.
    """
    try:
        vectorstore = _get_vectorstore()
        result = vectorstore.get(ids=[doc_id])
        if result and result.get("documents"):
            return {
                "page_content": result["documents"][0],
                "metadata": (
                    result["metadatas"][0] if result.get("metadatas") else {}
                ),
            }
        return {"error": f"Document '{doc_id}' not found."}
    except Exception as exc:
        logger.exception("get_document_by_id failed")
        return {"error": str(exc)}


@tool
def generate_hypothetical_questions(document_content: str) -> List[str]:
    """Generate 3 hypothetical questions a document could answer.

    This mirrors the notebook's hypothetical-question generation step.

    Args:
        document_content: The full text of the document chunk.

    Returns:
        A list of question strings.
    """
    from .prompts import HYPOTHETICAL_QUESTIONS_PROMPT

    try:
        llm = _get_llm()
        prompt = HYPOTHETICAL_QUESTIONS_PROMPT.format(doc=document_content)
        response = llm.invoke(prompt)
        questions = [
            q.strip().lstrip("0123456789.-) ")
            for q in response.content.strip().split("\n")
            if q.strip()
        ]
        return questions
    except Exception as exc:
        logger.exception("generate_hypothetical_questions failed")
        return [f"Error: {exc}"]


@tool
def rerank_documents(
    query: str,
    documents: List[Dict[str, Any]],
    top_n: int = 5,
) -> List[Dict[str, Any]]:
    """Rerank a list of documents using a cross-encoder model.

    Uses ``cross-encoder/ms-marco-MiniLM-L-6-v2`` from HuggingFace.

    Args:
        query: The query to score against.
        documents: List of dicts with at least a ``page_content`` key.
        top_n: Number of top-scoring documents to return.

    Returns:
        Reranked documents as a list of dicts with an added ``score`` field.
    """
    try:
        from langchain_community.cross_encoders import HuggingFaceCrossEncoder

        cross_encoder = HuggingFaceCrossEncoder(
            model_name="cross-encoder/ms-marco-MiniLM-L-6-v2"
        )

        pairs = [
            [query, doc.get("page_content", "")]
            for doc in documents
        ]
        scores = cross_encoder.score(pairs)

        scored = []
        for doc, score in zip(documents, scores):
            scored.append({**doc, "score": float(score)})
        scored.sort(key=lambda x: x["score"], reverse=True)

        return scored[:top_n]
    except Exception as exc:
        logger.exception("rerank_documents failed")
        return documents[:top_n]


@tool
def expand_query(query: str) -> List[str]:
    """Expand a query with alternative phrasings and synonyms.

    Uses an LLM to generate at least 3 reworded versions of the query,
    exactly following the notebook's query-expansion pattern.

    Args:
        query: The original user query.

    Returns:
        A list of expanded query strings.
    """
    from .prompts import QUERY_EXPANSION_PROMPT

    try:
        llm = _get_llm()
        prompt = QUERY_EXPANSION_PROMPT.format(query=query)
        response = llm.invoke(prompt)
        expanded = [
            q.strip().lstrip("0123456789.-) ")
            for q in response.content.strip().split("\n")
            if q.strip()
        ]
        return expanded
    except Exception as exc:
        logger.exception("expand_query failed")
        return [query]
