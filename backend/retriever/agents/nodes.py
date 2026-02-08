"""
Agent node implementations for the LangGraph retrieval pipeline.

Each public function in this module has the signature
``(state: RetrieverState) -> dict`` and returns a partial state update
that LangGraph merges back into the shared ``RetrieverState``.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional

from langchain_core.documents import Document

from .state import AgentConfig, RetrieverState

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lazy resource helpers (keep module import-time side-effect free)
# ---------------------------------------------------------------------------

def _get_llm():
    from langchain_openai import ChatOpenAI
    from django.conf import settings

    return ChatOpenAI(
        model=getattr(settings, "LLM_MODEL", "gpt-4o-mini"),
        temperature=0,
    )


def _get_embeddings():
    from langchain_openai import OpenAIEmbeddings
    from django.conf import settings

    return OpenAIEmbeddings(
        model=getattr(settings, "EMBEDDING_MODEL", "text-embedding-ada-002"),
    )


def _get_vectorstore():
    from langchain_chroma import Chroma
    from django.conf import settings

    return Chroma(
        collection_name=getattr(
            settings, "CHROMA_COLLECTION", "Renewable_enery_with_Metadata"
        ),
        embedding_function=_get_embeddings(),
        persist_directory=getattr(settings, "CHROMA_PERSIST_DIR", None),
    )


def _get_config(state: RetrieverState) -> AgentConfig:
    """Extract the ``AgentConfig`` from state, using defaults if absent."""
    cfg = state.get("config")
    if cfg is None:
        return AgentConfig()
    if isinstance(cfg, dict):
        return AgentConfig.from_dict(cfg)
    return cfg


def _safe_parse_json(text: str) -> Dict[str, Any]:
    """Best-effort JSON parse that strips markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove opening and closing fences
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("Failed to parse LLM JSON response: %s", cleaned[:200])
        return {}


# ===================================================================
# 1. QUERY ANALYZER
# ===================================================================

def query_analyzer_node(state: RetrieverState) -> Dict[str, Any]:
    """Analyze the user query to determine optimal retrieval strategy.

    Uses an LLM to inspect the query and produce:
    - ``retrieval_method``
    - ``filters`` (metadata filters for year / topics / subtopic)
    - whether query expansion would help
    """
    from .prompts import QUERY_ANALYSIS_PROMPT

    query = state.get("query", state.get("original_query", ""))
    logger.info("query_analyzer_node: analyzing '%s'", query)

    try:
        llm = _get_llm()
        prompt = QUERY_ANALYSIS_PROMPT.format(query=query)
        response = llm.invoke(prompt)
        analysis = _safe_parse_json(response.content)

        retrieval_method = analysis.get("retrieval_method", "vector")
        filters = analysis.get("filters", {})
        needs_expansion = analysis.get("needs_expansion", False)

        config = _get_config(state)
        if needs_expansion:
            config.use_query_expansion = True

        return {
            "retrieval_method": retrieval_method,
            "filters": filters,
            "config": config,
            "metadata": {
                "query_analysis": analysis,
            },
            "agent_messages": [
                {
                    "agent": "query_analyzer",
                    "message": (
                        f"Selected method={retrieval_method}, "
                        f"filters={filters}, expansion={needs_expansion}"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["query_analyzer"],
        }
    except Exception as exc:
        logger.exception("query_analyzer_node failed")
        return {
            "retrieval_method": "vector",
            "filters": {},
            "error": f"Query analysis failed: {exc}",
            "agent_messages": [
                {
                    "agent": "query_analyzer",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["query_analyzer"],
        }


# ===================================================================
# 2. QUERY EXPANDER
# ===================================================================

def query_expander_node(state: RetrieverState) -> Dict[str, Any]:
    """Expand the query with synonym / alternative phrasings.

    Mirrors the notebook's query-expansion approach: ask the LLM for at
    least 3 reworded versions and store them in ``expanded_queries``.
    """
    from .prompts import QUERY_EXPANSION_PROMPT

    query = state.get("query", state.get("original_query", ""))
    logger.info("query_expander_node: expanding '%s'", query)

    try:
        llm = _get_llm()
        prompt = QUERY_EXPANSION_PROMPT.format(query=query)
        response = llm.invoke(prompt)

        expanded = [
            q.strip().lstrip("0123456789.-) ")
            for q in response.content.strip().split("\n")
            if q.strip()
        ]

        # Always include the original query
        if query not in expanded:
            expanded.insert(0, query)

        return {
            "expanded_queries": expanded,
            "agent_messages": [
                {
                    "agent": "query_expander",
                    "message": f"Generated {len(expanded)} query variants",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["query_expander"],
        }
    except Exception as exc:
        logger.exception("query_expander_node failed")
        return {
            "expanded_queries": [query],
            "error": f"Query expansion failed: {exc}",
            "agent_messages": [
                {
                    "agent": "query_expander",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["query_expander"],
        }


# ===================================================================
# 3. SELF-QUERY CONSTRUCTOR
# ===================================================================

def self_query_constructor_node(state: RetrieverState) -> Dict[str, Any]:
    """Construct structured metadata filters from natural language.

    Uses the LangChain ``SelfQueryRetriever`` pattern: an LLM extracts
    metadata filters (year, topics, subtopic) from the query, then
    retrieves with those filters applied.
    """
    from langchain.chains.query_constructor.base import AttributeInfo
    from langchain.retrievers.self_query.base import SelfQueryRetriever

    query = state.get("query", state.get("original_query", ""))
    config = _get_config(state)
    logger.info("self_query_constructor_node: '%s'", query)

    try:
        vectorstore = _get_vectorstore()
        llm = _get_llm()

        metadata_field_info = [
            AttributeInfo(
                name="year",
                description=(
                    "The year the document was created or published"
                ),
                type="integer",
            ),
            AttributeInfo(
                name="topics",
                description=(
                    "The main topic or category of the document, such as "
                    "renewable energy, solar power, etc."
                ),
                type="string",
            ),
            AttributeInfo(
                name="subtopic",
                description=(
                    "A more specific subcategory of the main topic, "
                    "if applicable."
                ),
                type="string",
            ),
        ]

        document_content_description = (
            "Brief overview of various aspects related to Renewable Energy "
            "and different types of it like Wind, solar, hydroelectric, "
            "geothermal energies, etc."
        )

        self_query_retriever = SelfQueryRetriever.from_llm(
            llm,
            vectorstore,
            document_content_description,
            metadata_field_info,
            enable_limit=True,
            verbose=True,
        )

        docs = self_query_retriever.invoke(query)
        docs = docs[: config.top_k] if docs else []

        return {
            "documents": docs,
            "agent_messages": [
                {
                    "agent": "self_query_constructor",
                    "message": (
                        f"Self-query retrieval returned {len(docs)} documents"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["self_query_constructor"],
        }
    except Exception as exc:
        logger.exception("self_query_constructor_node failed")
        return {
            "documents": [],
            "error": f"Self-query construction failed: {exc}",
            "agent_messages": [
                {
                    "agent": "self_query_constructor",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["self_query_constructor"],
        }


# ===================================================================
# 4. VECTOR RETRIEVER
# ===================================================================

def vector_retriever_node(state: RetrieverState) -> Dict[str, Any]:
    """Perform vector similarity search against ChromaDB.

    If ``expanded_queries`` are present, searches each variant and
    deduplicates the results.
    """
    config = _get_config(state)
    queries = state.get("expanded_queries") or [
        state.get("query", state.get("original_query", ""))
    ]
    filters = state.get("filters", {})
    logger.info("vector_retriever_node: %d query variant(s)", len(queries))

    try:
        vectorstore = _get_vectorstore()

        # Build optional Chroma ``where`` filter.
        chroma_where = _build_chroma_where(filters)

        seen_contents: set = set()
        all_docs: List[Document] = []

        for q in queries:
            search_kwargs: Dict[str, Any] = {"k": config.top_k}
            if chroma_where:
                search_kwargs["filter"] = chroma_where
            results = vectorstore.similarity_search(q, **search_kwargs)
            for doc in results:
                content_key = doc.page_content.strip()
                if content_key not in seen_contents:
                    seen_contents.add(content_key)
                    all_docs.append(doc)

        return {
            "documents": all_docs,
            "agent_messages": [
                {
                    "agent": "vector_retriever",
                    "message": (
                        f"Retrieved {len(all_docs)} unique documents "
                        f"from {len(queries)} queries"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["vector_retriever"],
        }
    except Exception as exc:
        logger.exception("vector_retriever_node failed")
        return {
            "documents": [],
            "error": f"Vector retrieval failed: {exc}",
            "agent_messages": [
                {
                    "agent": "vector_retriever",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["vector_retriever"],
        }


# ===================================================================
# 5. BM25 RETRIEVER
# ===================================================================

def bm25_retriever_node(state: RetrieverState) -> Dict[str, Any]:
    """Perform BM25 keyword-based retrieval.

    Loads all documents from the ChromaDB collection into a
    ``BM25Retriever`` and runs the query.
    """
    from langchain_community.retrievers import BM25Retriever

    config = _get_config(state)
    query = state.get("query", state.get("original_query", ""))
    logger.info("bm25_retriever_node: '%s'", query)

    try:
        vectorstore = _get_vectorstore()

        # Fetch all documents from the collection to build BM25 index.
        collection_data = vectorstore.get()
        corpus_docs: List[Document] = []
        for idx, content in enumerate(collection_data.get("documents", [])):
            meta = {}
            if collection_data.get("metadatas"):
                meta = collection_data["metadatas"][idx] or {}
            corpus_docs.append(Document(page_content=content, metadata=meta))

        if not corpus_docs:
            return {
                "documents": [],
                "agent_messages": [
                    {
                        "agent": "bm25_retriever",
                        "message": "No documents in collection for BM25",
                        "timestamp": time.time(),
                    }
                ],
                "execution_trace": ["bm25_retriever"],
            }

        bm25 = BM25Retriever.from_documents(corpus_docs, k=config.top_k)
        docs = bm25.invoke(query)

        return {
            "documents": docs,
            "agent_messages": [
                {
                    "agent": "bm25_retriever",
                    "message": f"BM25 returned {len(docs)} documents",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["bm25_retriever"],
        }
    except Exception as exc:
        logger.exception("bm25_retriever_node failed")
        return {
            "documents": [],
            "error": f"BM25 retrieval failed: {exc}",
            "agent_messages": [
                {
                    "agent": "bm25_retriever",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["bm25_retriever"],
        }


# ===================================================================
# 6. HYBRID MERGER
# ===================================================================

def hybrid_merger_node(state: RetrieverState) -> Dict[str, Any]:
    """Merge results from vector + BM25 using EnsembleRetriever logic.

    Follows the notebook approach: weights ``[0.5, 0.5]`` for equal
    contribution from keyword and semantic retrieval.
    """
    from langchain_community.retrievers import BM25Retriever
    from langchain.retrievers import EnsembleRetriever

    config = _get_config(state)
    query = state.get("query", state.get("original_query", ""))
    logger.info("hybrid_merger_node: '%s'", query)

    try:
        vectorstore = _get_vectorstore()

        # Build the vector retriever.
        vector_retriever = vectorstore.as_retriever(
            search_kwargs={"k": config.top_k},
        )

        # Build the BM25 retriever from the full collection.
        collection_data = vectorstore.get()
        corpus_docs: List[Document] = []
        for idx, content in enumerate(collection_data.get("documents", [])):
            meta = {}
            if collection_data.get("metadatas"):
                meta = collection_data["metadatas"][idx] or {}
            corpus_docs.append(Document(page_content=content, metadata=meta))

        if not corpus_docs:
            return {
                "documents": [],
                "agent_messages": [
                    {
                        "agent": "hybrid_merger",
                        "message": "No corpus documents for hybrid search",
                        "timestamp": time.time(),
                    }
                ],
                "execution_trace": ["hybrid_merger"],
            }

        bm25_retriever = BM25Retriever.from_documents(
            corpus_docs, k=config.top_k
        )

        ensemble = EnsembleRetriever(
            retrievers=[bm25_retriever, vector_retriever],
            weights=[0.5, 0.5],
        )

        docs = ensemble.invoke(query)

        return {
            "documents": docs,
            "agent_messages": [
                {
                    "agent": "hybrid_merger",
                    "message": (
                        f"Hybrid (BM25+vector 0.5/0.5) returned "
                        f"{len(docs)} documents"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["hybrid_merger"],
        }
    except Exception as exc:
        logger.exception("hybrid_merger_node failed")
        return {
            "documents": [],
            "error": f"Hybrid merge failed: {exc}",
            "agent_messages": [
                {
                    "agent": "hybrid_merger",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["hybrid_merger"],
        }


# ===================================================================
# 7. HYPOTHETICAL QUESTION RETRIEVER
# ===================================================================

def hypothetical_question_node(state: RetrieverState) -> Dict[str, Any]:
    """Generate hypothetical questions for each document and retrieve
    parent chunks whose hypothetical questions best match the query.

    Mirrors the notebook: for each document in the collection, generate
    3 hypothetical questions, embed them, then use the user query to
    find the closest hypothetical-question document and return its
    parent chunk.
    """
    from langchain_chroma import Chroma
    from .prompts import HYPOTHETICAL_QUESTIONS_PROMPT

    config = _get_config(state)
    query = state.get("query", state.get("original_query", ""))
    logger.info("hypothetical_question_node: '%s'", query)

    try:
        vectorstore = _get_vectorstore()
        llm = _get_llm()
        embeddings = _get_embeddings()

        # Fetch source documents from the main collection.
        collection_data = vectorstore.get()
        source_docs: List[Document] = []
        for idx, content in enumerate(collection_data.get("documents", [])):
            meta = {}
            if collection_data.get("metadatas"):
                meta = collection_data["metadatas"][idx] or {}
            doc_id = ""
            if collection_data.get("ids"):
                doc_id = collection_data["ids"][idx]
            source_docs.append(
                Document(
                    page_content=content,
                    metadata={**meta, "_id": doc_id},
                )
            )

        if not source_docs:
            return {
                "documents": [],
                "agent_messages": [
                    {
                        "agent": "hypothetical_question_retriever",
                        "message": "No source documents for HQ generation",
                        "timestamp": time.time(),
                    }
                ],
                "execution_trace": ["hypothetical_question_retriever"],
            }

        # Generate hypothetical questions for each source document.
        hq_docs: List[Document] = []
        for doc in source_docs:
            try:
                prompt = HYPOTHETICAL_QUESTIONS_PROMPT.format(
                    doc=doc.page_content
                )
                response = llm.invoke(prompt)
                questions = response.content.strip()
            except Exception:
                questions = ""

            hq_docs.append(
                Document(
                    page_content=questions,
                    metadata={
                        "parent_chunk_id": doc.metadata.get("_id", ""),
                        "parent_chunk": doc.page_content,
                    },
                )
            )

        # Build an in-memory Chroma store for hypothetical questions.
        hq_vectorstore = Chroma(
            collection_name="hypothetical_questions_temp",
            embedding_function=embeddings,
        )
        hq_vectorstore.add_documents(documents=hq_docs)

        hq_retriever = hq_vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": config.top_k},
        )

        # Retrieve the best-matching hypothetical-question documents.
        matched_hq = hq_retriever.invoke(query)

        # Map back to parent chunks.
        result_docs: List[Document] = []
        for hq_doc in matched_hq:
            parent_content = hq_doc.metadata.get("parent_chunk", "")
            parent_id = hq_doc.metadata.get("parent_chunk_id", "")
            if parent_content:
                result_docs.append(
                    Document(
                        page_content=parent_content,
                        metadata={
                            "source": "hypothetical_questions",
                            "parent_chunk_id": parent_id,
                            "hypothetical_questions": hq_doc.page_content,
                        },
                    )
                )

        return {
            "documents": result_docs,
            "agent_messages": [
                {
                    "agent": "hypothetical_question_retriever",
                    "message": (
                        f"HQ retrieval returned {len(result_docs)} "
                        f"parent chunks"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["hypothetical_question_retriever"],
        }
    except Exception as exc:
        logger.exception("hypothetical_question_node failed")
        return {
            "documents": [],
            "error": f"Hypothetical question retrieval failed: {exc}",
            "agent_messages": [
                {
                    "agent": "hypothetical_question_retriever",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["hypothetical_question_retriever"],
        }


# ===================================================================
# 8. RERANKER
# ===================================================================

def reranker_node(state: RetrieverState) -> Dict[str, Any]:
    """Cross-encoder reranking using ``ms-marco-MiniLM-L-6-v2``.

    Takes the accumulated ``documents`` from state and reranks them.
    """
    from langchain_community.cross_encoders import HuggingFaceCrossEncoder
    from langchain.retrievers.document_compressors import CrossEncoderReranker

    config = _get_config(state)
    query = state.get("query", state.get("original_query", ""))
    docs = state.get("documents", [])
    logger.info("reranker_node: reranking %d documents", len(docs))

    if not docs:
        return {
            "reranked_documents": [],
            "agent_messages": [
                {
                    "agent": "reranker",
                    "message": "No documents to rerank",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["reranker"],
        }

    try:
        cross_encoder = HuggingFaceCrossEncoder(
            model_name="cross-encoder/ms-marco-MiniLM-L-6-v2"
        )

        # Score each document against the query.
        pairs = [[query, doc.page_content] for doc in docs]
        scores = cross_encoder.score(pairs)

        scored_docs = list(zip(docs, scores))
        scored_docs.sort(key=lambda x: float(x[1]), reverse=True)

        top_docs = [
            doc for doc, _ in scored_docs[: config.reranker_top_n]
        ]

        return {
            "reranked_documents": top_docs,
            "agent_messages": [
                {
                    "agent": "reranker",
                    "message": (
                        f"Reranked to top {len(top_docs)} documents "
                        f"(scores: {[round(float(s), 3) for _, s in scored_docs[:config.reranker_top_n]]})"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["reranker"],
        }
    except Exception as exc:
        logger.exception("reranker_node failed")
        return {
            "reranked_documents": docs[: config.reranker_top_n],
            "error": f"Reranking failed: {exc}",
            "agent_messages": [
                {
                    "agent": "reranker",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["reranker"],
        }


# ===================================================================
# 9. COMPRESSOR
# ===================================================================

def compressor_node(state: RetrieverState) -> Dict[str, Any]:
    """LLM-based context compression using ``LLMChainExtractor``.

    Compresses the best available documents to only the portions
    relevant to the query.
    """
    from langchain.retrievers.document_compressors import LLMChainExtractor

    query = state.get("query", state.get("original_query", ""))
    # Use reranked docs if available, otherwise raw docs.
    docs = state.get("reranked_documents") or state.get("documents", [])
    logger.info("compressor_node: compressing %d documents", len(docs))

    if not docs:
        return {
            "compressed_documents": [],
            "agent_messages": [
                {
                    "agent": "compressor",
                    "message": "No documents to compress",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["compressor"],
        }

    try:
        llm = _get_llm()
        compressor = LLMChainExtractor.from_llm(llm)

        compressed: List[Document] = []
        for doc in docs:
            try:
                result = compressor.compress_documents([doc], query)
                compressed.extend(result)
            except Exception as inner_exc:
                logger.warning(
                    "Compression failed for a document: %s", inner_exc
                )
                # Keep the original if compression fails.
                compressed.append(doc)

        return {
            "compressed_documents": compressed,
            "agent_messages": [
                {
                    "agent": "compressor",
                    "message": (
                        f"Compressed {len(docs)} docs to "
                        f"{len(compressed)} passages"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["compressor"],
        }
    except Exception as exc:
        logger.exception("compressor_node failed")
        return {
            "compressed_documents": docs,
            "error": f"Compression failed: {exc}",
            "agent_messages": [
                {
                    "agent": "compressor",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["compressor"],
        }


# ===================================================================
# 10. ANSWER GENERATOR
# ===================================================================

def answer_generator_node(state: RetrieverState) -> Dict[str, Any]:
    """Generate the final natural-language answer from retrieved documents.

    Uses the best document set available (compressed > reranked > raw).
    """
    from .prompts import ANSWER_GENERATION_PROMPT

    query = state.get("query", state.get("original_query", ""))

    # Priority: compressed > reranked > raw.
    docs = (
        state.get("compressed_documents")
        or state.get("reranked_documents")
        or state.get("documents", [])
    )
    logger.info(
        "answer_generator_node: generating answer from %d documents",
        len(docs),
    )

    if not docs:
        return {
            "answer": (
                "I could not find any relevant documents to answer your "
                "question. Please try rephrasing your query."
            ),
            "final_documents": [],
            "agent_messages": [
                {
                    "agent": "answer_generator",
                    "message": "No documents available for answer generation",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["answer_generator"],
        }

    try:
        llm = _get_llm()
        context = "\n\n---\n\n".join(
            f"[Document {i + 1}]\n{doc.page_content}"
            for i, doc in enumerate(docs)
        )
        prompt = ANSWER_GENERATION_PROMPT.format(
            context=context, query=query
        )
        response = llm.invoke(prompt)

        return {
            "answer": response.content,
            "final_documents": docs,
            "agent_messages": [
                {
                    "agent": "answer_generator",
                    "message": (
                        f"Generated answer using {len(docs)} documents"
                    ),
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["answer_generator"],
        }
    except Exception as exc:
        logger.exception("answer_generator_node failed")
        return {
            "answer": f"An error occurred while generating the answer: {exc}",
            "final_documents": docs,
            "error": f"Answer generation failed: {exc}",
            "agent_messages": [
                {
                    "agent": "answer_generator",
                    "message": f"Error: {exc}",
                    "timestamp": time.time(),
                }
            ],
            "execution_trace": ["answer_generator"],
        }


# ===================================================================
# 11. SUPERVISOR
# ===================================================================

def supervisor_node(state: RetrieverState) -> Dict[str, Any]:
    """Orchestrate the agent flow based on query analysis results.

    The supervisor inspects the current state (retrieval_method, config
    flags, what has already executed) and sets the ``retrieval_method``
    field that downstream conditional edges read to route the graph.
    """
    config = _get_config(state)
    retrieval_method = state.get("retrieval_method", "vector")
    trace = state.get("execution_trace", [])
    logger.info(
        "supervisor_node: method=%s, trace=%s",
        retrieval_method,
        trace,
    )

    # Determine the next action based on what has already happened.
    next_action = retrieval_method

    # If query expansion is requested and hasn't happened yet, route there.
    if config.use_query_expansion and "query_expander" not in trace:
        next_action = "expand"

    # If hypothetical questions requested, override method.
    if config.use_hypothetical_questions:
        next_action = "hypothetical_questions"

    return {
        "retrieval_method": next_action,
        "agent_messages": [
            {
                "agent": "supervisor",
                "message": f"Routing to: {next_action}",
                "timestamp": time.time(),
            }
        ],
        "execution_trace": ["supervisor"],
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_chroma_where(
    filters: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Convert a flat filter dict to a Chroma ``where`` clause."""
    if not filters:
        return None

    clauses = []
    if "year" in filters and filters["year"] is not None:
        clauses.append({"year": {"$eq": int(filters["year"])}})
    if "topics" in filters and filters["topics"]:
        clauses.append({"topics": {"$eq": filters["topics"]}})
    if "subtopic" in filters and filters["subtopic"]:
        clauses.append({"subtopic": {"$eq": filters["subtopic"]}})

    if not clauses:
        return None
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}
