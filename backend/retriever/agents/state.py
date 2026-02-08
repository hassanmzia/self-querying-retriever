"""
LangGraph state definitions for the multi-agent retrieval pipeline.

Defines the shared state schema passed between all nodes in the graph,
as well as the configuration dataclass controlling pipeline behavior.
"""

from __future__ import annotations

import operator
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from langchain_core.documents import Document
from typing_extensions import Annotated, TypedDict


# ---------------------------------------------------------------------------
# Shared graph state
# ---------------------------------------------------------------------------

class RetrieverState(TypedDict, total=False):
    """Shared state that flows through every node in the retrieval graph.

    Fields are intentionally declared with ``total=False`` so that nodes
    only need to populate the subset they are responsible for.
    """

    # ---- Query information ----
    query: str
    """The current (possibly rewritten) query used for retrieval."""

    original_query: str
    """The verbatim user query before any transformation."""

    expanded_queries: List[str]
    """Alternative phrasings / synonym expansions of the original query."""

    # ---- Retrieval configuration ----
    retrieval_method: str
    """Selected retrieval strategy (e.g. 'vector', 'bm25', 'hybrid',
    'self_query', 'hypothetical_questions')."""

    filters: Dict[str, Any]
    """Metadata filters extracted from the query (year, topics, subtopic)."""

    # ---- Document sets produced by different pipeline stages ----
    documents: Annotated[List[Document], operator.add]
    """Raw documents returned by one or more retriever nodes."""

    reranked_documents: List[Document]
    """Documents after cross-encoder reranking."""

    compressed_documents: List[Document]
    """Documents after context compression."""

    final_documents: List[Document]
    """The authoritative document set used for answer generation."""

    # ---- Output ----
    answer: str
    """The generated natural-language answer."""

    # ---- Observability / orchestration ----
    agent_messages: Annotated[List[Dict[str, Any]], operator.add]
    """Accumulated log messages from each agent node."""

    metadata: Dict[str, Any]
    """Arbitrary metadata collected during the run."""

    execution_trace: Annotated[List[str], operator.add]
    """Ordered list of node names that have executed."""

    error: Optional[str]
    """Error message if a node fails gracefully."""

    config: AgentConfig
    """Pipeline configuration object governing node behavior."""


# ---------------------------------------------------------------------------
# Pipeline configuration
# ---------------------------------------------------------------------------

@dataclass
class AgentConfig:
    """Configuration knobs for the multi-agent retrieval pipeline.

    An ``AgentConfig`` instance is stored in ``RetrieverState["config"]`` and
    read by individual nodes to decide their behavior.
    """

    retrieval_methods: List[str] = field(
        default_factory=lambda: ["vector"],
    )
    """Ordered list of retrieval strategies to attempt.
    Supported values: 'vector', 'bm25', 'hybrid', 'self_query',
    'hypothetical_questions'."""

    use_reranking: bool = True
    """Whether to apply cross-encoder reranking after retrieval."""

    use_compression: bool = False
    """Whether to apply LLM-based context compression."""

    use_query_expansion: bool = False
    """Whether to expand the query with synonyms / alternative phrasings."""

    use_hypothetical_questions: bool = False
    """Whether to generate hypothetical questions for parent-chunk retrieval."""

    top_k: int = 4
    """Number of documents to retrieve from each retriever."""

    reranker_top_n: int = 5
    """Number of documents to keep after cross-encoder reranking."""

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the config to a plain dictionary."""
        return {
            "retrieval_methods": self.retrieval_methods,
            "use_reranking": self.use_reranking,
            "use_compression": self.use_compression,
            "use_query_expansion": self.use_query_expansion,
            "use_hypothetical_questions": self.use_hypothetical_questions,
            "top_k": self.top_k,
            "reranker_top_n": self.reranker_top_n,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentConfig":
        """Deserialize from a dictionary, ignoring unknown keys."""
        known_keys = {
            "retrieval_methods",
            "use_reranking",
            "use_compression",
            "use_query_expansion",
            "use_hypothetical_questions",
            "top_k",
            "reranker_top_n",
        }
        filtered = {k: v for k, v in data.items() if k in known_keys}
        return cls(**filtered)
