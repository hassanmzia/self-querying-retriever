"""
Graph visualization utilities for the multi-agent retrieval pipeline.

Provides helpers to render the LangGraph ``StateGraph`` as a Mermaid
diagram, a human-readable description, and a structured data format
suitable for front-end rendering.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Mermaid diagram
# ---------------------------------------------------------------------------

def generate_mermaid_diagram(graph: Optional[Any] = None) -> str:
    """Return a Mermaid-syntax diagram of the agent workflow.

    If a compiled LangGraph ``CompiledStateGraph`` is passed, this
    function delegates to the built-in ``.get_graph().draw_mermaid()``
    method. Otherwise it returns a hand-crafted diagram that matches the
    graph defined in ``graph.py``.

    Args:
        graph: An optional compiled LangGraph graph instance.

    Returns:
        A string containing Mermaid markdown.
    """
    if graph is not None:
        try:
            return graph.get_graph().draw_mermaid()
        except Exception as exc:
            logger.warning(
                "Failed to draw mermaid from compiled graph, "
                "falling back to static diagram: %s",
                exc,
            )

    # Static fallback that mirrors the graph topology from graph.py.
    return _STATIC_MERMAID


_STATIC_MERMAID = """\
graph TD
    START([__start__]) --> query_analyzer[Query Analyzer]
    query_analyzer --> supervisor[Supervisor]

    supervisor -->|expand| query_expander[Query Expander]
    supervisor -->|vector| vector_retriever[Vector Retriever]
    supervisor -->|bm25| bm25_retriever[BM25 Retriever]
    supervisor -->|hybrid| hybrid_merger[Hybrid Merger]
    supervisor -->|self_query| self_query_constructor[Self-Query Constructor]
    supervisor -->|hypothetical_questions| hypothetical_question_retriever[HQ Retriever]

    query_expander --> vector_retriever

    vector_retriever --> post_retrieval{Post-Retrieval?}
    bm25_retriever --> post_retrieval
    hybrid_merger --> post_retrieval
    self_query_constructor --> post_retrieval
    hypothetical_question_retriever --> post_retrieval

    post_retrieval -->|reranking| reranker[Reranker]
    post_retrieval -->|no reranking| compression_check{Compression?}

    reranker --> compression_check

    compression_check -->|compression| compressor[Compressor]
    compression_check -->|no compression| answer_generator[Answer Generator]

    compressor --> answer_generator

    answer_generator --> END([__end__])

    classDef agent fill:#155e75,stroke:#0891b2,stroke-width:2px,color:#e2e8f0
    classDef decision fill:#854d0e,stroke:#ca8a04,stroke-width:2px,color:#fef9c3
    classDef terminal fill:#166534,stroke:#22c55e,stroke-width:2px,color:#dcfce7

    class query_analyzer,supervisor,query_expander,vector_retriever,bm25_retriever,hybrid_merger,self_query_constructor,hypothetical_question_retriever,reranker,compressor,answer_generator agent
    class post_retrieval,compression_check decision
    class START,END terminal
"""


# ---------------------------------------------------------------------------
# 2. Human-readable description
# ---------------------------------------------------------------------------

def generate_graph_description() -> str:
    """Return a human-readable description of the agent workflow.

    The description covers every node, the routing logic, and the
    conditional edges so that developers and users can understand the
    pipeline without reading source code.
    """
    return """\
Multi-Agent Retrieval Pipeline
==============================

This pipeline orchestrates multiple retrieval strategies for a renewable
energy knowledge base, using LangGraph to coordinate agent nodes.

Nodes
-----
1. **Query Analyzer**
   Receives the raw user query and uses an LLM to determine the optimal
   retrieval strategy (vector / BM25 / hybrid / self-query / hypothetical
   questions).  It also extracts metadata filters (year, topics, subtopic)
   and decides whether query expansion is beneficial.

2. **Supervisor**
   Reads the analysis produced by the Query Analyzer and routes execution
   to the appropriate retrieval node.  If query expansion was requested,
   it routes to the Query Expander first.

3. **Query Expander**
   Uses an LLM to generate at least 3 alternative phrasings or synonym
   expansions of the original query.  After expansion, flow continues
   to the Vector Retriever.

4. **Self-Query Constructor**
   Leverages LangChain's SelfQueryRetriever to translate the natural-
   language query into a structured query with metadata filters, then
   retrieves from ChromaDB accordingly.

5. **Vector Retriever**
   Performs standard vector similarity search against ChromaDB.  If
   expanded queries are available, it searches each variant and
   deduplicates results.

6. **BM25 Retriever**
   Builds a BM25 (keyword) index over the document collection and
   retrieves using TF-IDF-style scoring.

7. **Hybrid Merger**
   Combines BM25 and vector retrieval using an EnsembleRetriever with
   equal weights (0.5 / 0.5), merging keyword and semantic signals.

8. **Hypothetical Question Retriever**
   For each source document, generates 3 hypothetical questions it could
   answer, embeds them, and retrieves the hypothetical-question documents
   most similar to the user query -- then maps back to parent chunks.

9. **Reranker** (optional)
   Uses the cross-encoder model ``ms-marco-MiniLM-L-6-v2`` to rerank
   the retrieved documents for higher precision.

10. **Compressor** (optional)
    Applies LLMChainExtractor to compress document passages to only the
    content relevant to the query.

11. **Answer Generator**
    Takes the best available document set (compressed > reranked > raw)
    and prompts an LLM to produce a final natural-language answer.

Routing Logic
-------------
- START -> Query Analyzer -> Supervisor
- Supervisor routes to ONE retrieval node based on the analysis.
- If query expansion is enabled, Supervisor routes to Query Expander
  first, which then continues to Vector Retriever.
- After retrieval, a conditional edge checks ``use_reranking``:
  - True  -> Reranker -> check compression
  - False -> check compression directly
- Compression check inspects ``use_compression``:
  - True  -> Compressor -> Answer Generator
  - False -> Answer Generator directly
- Answer Generator -> END
"""


# ---------------------------------------------------------------------------
# 3. Structured flow data
# ---------------------------------------------------------------------------

def get_agent_flow_diagram() -> Dict[str, Any]:
    """Return the agent workflow as structured data for front-end rendering.

    The returned dictionary contains:
    - ``nodes``: list of node descriptors with id, label, type.
    - ``edges``: list of edge descriptors with source, target, label,
      and whether the edge is conditional.
    - ``mermaid``: the Mermaid diagram string.
    - ``description``: the human-readable description.
    """
    nodes: List[Dict[str, str]] = [
        {"id": "__start__", "label": "Start", "type": "terminal"},
        {"id": "query_analyzer", "label": "Query Analyzer", "type": "agent"},
        {"id": "supervisor", "label": "Supervisor", "type": "agent"},
        {"id": "query_expander", "label": "Query Expander", "type": "agent"},
        {
            "id": "self_query_constructor",
            "label": "Self-Query Constructor",
            "type": "agent",
        },
        {
            "id": "vector_retriever",
            "label": "Vector Retriever",
            "type": "agent",
        },
        {"id": "bm25_retriever", "label": "BM25 Retriever", "type": "agent"},
        {"id": "hybrid_merger", "label": "Hybrid Merger", "type": "agent"},
        {
            "id": "hypothetical_question_retriever",
            "label": "HQ Retriever",
            "type": "agent",
        },
        {"id": "reranker", "label": "Reranker", "type": "agent"},
        {"id": "compressor", "label": "Compressor", "type": "agent"},
        {
            "id": "answer_generator",
            "label": "Answer Generator",
            "type": "agent",
        },
        {"id": "__end__", "label": "End", "type": "terminal"},
    ]

    edges: List[Dict[str, Any]] = [
        {
            "source": "__start__",
            "target": "query_analyzer",
            "label": "",
            "conditional": False,
        },
        {
            "source": "query_analyzer",
            "target": "supervisor",
            "label": "",
            "conditional": False,
        },
        # Supervisor conditional routing
        {
            "source": "supervisor",
            "target": "query_expander",
            "label": "expand",
            "conditional": True,
        },
        {
            "source": "supervisor",
            "target": "vector_retriever",
            "label": "vector",
            "conditional": True,
        },
        {
            "source": "supervisor",
            "target": "bm25_retriever",
            "label": "bm25",
            "conditional": True,
        },
        {
            "source": "supervisor",
            "target": "hybrid_merger",
            "label": "hybrid",
            "conditional": True,
        },
        {
            "source": "supervisor",
            "target": "self_query_constructor",
            "label": "self_query",
            "conditional": True,
        },
        {
            "source": "supervisor",
            "target": "hypothetical_question_retriever",
            "label": "hypothetical_questions",
            "conditional": True,
        },
        # Query expander always feeds into vector retriever
        {
            "source": "query_expander",
            "target": "vector_retriever",
            "label": "",
            "conditional": False,
        },
        # Post-retrieval conditional edges
        {
            "source": "vector_retriever",
            "target": "reranker",
            "label": "reranking",
            "conditional": True,
        },
        {
            "source": "vector_retriever",
            "target": "answer_generator",
            "label": "no reranking, no compression",
            "conditional": True,
        },
        {
            "source": "bm25_retriever",
            "target": "reranker",
            "label": "reranking",
            "conditional": True,
        },
        {
            "source": "bm25_retriever",
            "target": "answer_generator",
            "label": "no reranking, no compression",
            "conditional": True,
        },
        {
            "source": "hybrid_merger",
            "target": "reranker",
            "label": "reranking",
            "conditional": True,
        },
        {
            "source": "hybrid_merger",
            "target": "answer_generator",
            "label": "no reranking, no compression",
            "conditional": True,
        },
        {
            "source": "self_query_constructor",
            "target": "reranker",
            "label": "reranking",
            "conditional": True,
        },
        {
            "source": "self_query_constructor",
            "target": "answer_generator",
            "label": "no reranking, no compression",
            "conditional": True,
        },
        {
            "source": "hypothetical_question_retriever",
            "target": "reranker",
            "label": "reranking",
            "conditional": True,
        },
        {
            "source": "hypothetical_question_retriever",
            "target": "answer_generator",
            "label": "no reranking, no compression",
            "conditional": True,
        },
        # Reranker -> compression check
        {
            "source": "reranker",
            "target": "compressor",
            "label": "compression",
            "conditional": True,
        },
        {
            "source": "reranker",
            "target": "answer_generator",
            "label": "no compression",
            "conditional": True,
        },
        # Compressor always leads to answer
        {
            "source": "compressor",
            "target": "answer_generator",
            "label": "",
            "conditional": False,
        },
        # Final
        {
            "source": "answer_generator",
            "target": "__end__",
            "label": "",
            "conditional": False,
        },
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "mermaid": generate_mermaid_diagram(),
        "description": generate_graph_description(),
    }
