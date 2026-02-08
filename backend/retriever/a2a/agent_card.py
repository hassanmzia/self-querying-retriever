"""
A2A Agent Card definitions for the Self-Querying Retriever system.

Each agent in the retrieval pipeline publishes an *Agent Card* -- a
JSON-serialisable descriptor that advertises the agent's identity,
capabilities, and network endpoint.  Other agents (or an orchestrator)
use these cards for discovery and task routing.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field, asdict
from typing import Any


# ---------------------------------------------------------------------------
# Agent Card data class
# ---------------------------------------------------------------------------

@dataclass
class AgentCard:
    """Descriptor published by every agent in the system."""

    name: str
    description: str
    version: str
    capabilities: list[str] = field(default_factory=list)
    supported_methods: list[str] = field(default_factory=list)
    endpoint: str = ""
    agent_type: str = "worker"
    status: str = "active"
    metadata: dict[str, Any] = field(default_factory=dict)

    # -- Serialisation helpers -----------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Return a plain dict suitable for JSON serialisation."""
        return asdict(self)

    def to_json_schema(self) -> dict[str, Any]:
        """Return an A2A-compliant agent card JSON object."""
        return {
            "agent": {
                "name": self.name,
                "description": self.description,
                "version": self.version,
                "type": self.agent_type,
                "status": self.status,
            },
            "capabilities": self.capabilities,
            "supported_methods": self.supported_methods,
            "endpoint": self.endpoint,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentCard":
        """Construct an AgentCard from a plain dict."""
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            version=data.get("version", "1.0.0"),
            capabilities=data.get("capabilities", []),
            supported_methods=data.get("supported_methods", []),
            endpoint=data.get("endpoint", ""),
            agent_type=data.get("agent_type", "worker"),
            status=data.get("status", "active"),
            metadata=data.get("metadata", {}),
        )


# ---------------------------------------------------------------------------
# Pre-defined agent cards for the retrieval pipeline
# ---------------------------------------------------------------------------

_BASE_URL = os.environ.get("DJANGO_BACKEND_URL", "http://backend:8083")


def _endpoint(path: str) -> str:
    return f"{_BASE_URL}{path}"


AGENT_CARDS: dict[str, AgentCard] = {
    "QueryAnalyzer": AgentCard(
        name="QueryAnalyzer",
        description=(
            "Analyses incoming user queries to determine intent, extract "
            "entities, and decide which retrieval strategy is most suitable."
        ),
        version="1.0.0",
        capabilities=[
            "query_analysis",
            "intent_detection",
            "entity_extraction",
            "method_selection",
        ],
        supported_methods=["analyze"],
        endpoint=_endpoint("/api/v1/a2a/agents/QueryAnalyzer/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "preprocessing"},
    ),
    "SelfQueryConstructor": AgentCard(
        name="SelfQueryConstructor",
        description=(
            "Converts a natural-language query into a structured self-query "
            "with metadata filters using an LLM."
        ),
        version="1.0.0",
        capabilities=[
            "self_query_construction",
            "filter_generation",
            "metadata_extraction",
        ],
        supported_methods=["construct_self_query"],
        endpoint=_endpoint("/api/v1/a2a/agents/SelfQueryConstructor/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "preprocessing"},
    ),
    "VectorRetriever": AgentCard(
        name="VectorRetriever",
        description=(
            "Performs dense vector similarity search against the ChromaDB "
            "vector store using OpenAI embeddings."
        ),
        version="1.0.0",
        capabilities=[
            "vector_search",
            "semantic_search",
            "embedding_lookup",
        ],
        supported_methods=["vector_search", "similarity_search"],
        endpoint=_endpoint("/api/v1/a2a/agents/VectorRetriever/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "retrieval", "backend": "chromadb"},
    ),
    "BM25Retriever": AgentCard(
        name="BM25Retriever",
        description=(
            "Performs sparse keyword retrieval using the BM25 (Okapi) "
            "algorithm for lexical matching."
        ),
        version="1.0.0",
        capabilities=[
            "bm25_search",
            "keyword_search",
            "lexical_matching",
        ],
        supported_methods=["bm25_search"],
        endpoint=_endpoint("/api/v1/a2a/agents/BM25Retriever/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "retrieval"},
    ),
    "Reranker": AgentCard(
        name="Reranker",
        description=(
            "Re-ranks candidate documents using a cross-encoder model to "
            "produce a more accurate relevance ordering."
        ),
        version="1.0.0",
        capabilities=[
            "reranking",
            "cross_encoder_scoring",
            "relevance_reordering",
        ],
        supported_methods=["rerank"],
        endpoint=_endpoint("/api/v1/a2a/agents/Reranker/tasks/"),
        agent_type="worker",
        metadata={
            "pipeline_stage": "postprocessing",
            "model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        },
    ),
    "Compressor": AgentCard(
        name="Compressor",
        description=(
            "Compresses retrieved documents by extracting only the most "
            "relevant passages, reducing context length for the generator."
        ),
        version="1.0.0",
        capabilities=[
            "context_compression",
            "passage_extraction",
            "redundancy_removal",
        ],
        supported_methods=["compress"],
        endpoint=_endpoint("/api/v1/a2a/agents/Compressor/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "postprocessing"},
    ),
    "QueryExpander": AgentCard(
        name="QueryExpander",
        description=(
            "Generates multiple alternative phrasings of a user query to "
            "improve recall during retrieval."
        ),
        version="1.0.0",
        capabilities=[
            "query_expansion",
            "query_reformulation",
            "synonym_generation",
        ],
        supported_methods=["expand"],
        endpoint=_endpoint("/api/v1/a2a/agents/QueryExpander/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "preprocessing"},
    ),
    "AnswerGenerator": AgentCard(
        name="AnswerGenerator",
        description=(
            "Generates a final natural-language answer from retrieved "
            "context using an LLM (GPT-4o-mini by default)."
        ),
        version="1.0.0",
        capabilities=[
            "answer_generation",
            "context_synthesis",
            "citation_generation",
        ],
        supported_methods=["generate"],
        endpoint=_endpoint("/api/v1/a2a/agents/AnswerGenerator/tasks/"),
        agent_type="worker",
        metadata={"pipeline_stage": "generation", "model": "gpt-4o-mini"},
    ),
    "Supervisor": AgentCard(
        name="Supervisor",
        description=(
            "LangGraph-based supervisor that orchestrates the full retrieval "
            "pipeline, delegating sub-tasks to specialised worker agents."
        ),
        version="1.0.0",
        capabilities=[
            "orchestration",
            "pipeline_management",
            "task_delegation",
            "error_recovery",
        ],
        supported_methods=["run_pipeline"],
        endpoint=_endpoint("/api/v1/a2a/agents/Supervisor/tasks/"),
        agent_type="supervisor",
        metadata={"pipeline_stage": "orchestration"},
    ),
}


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_all_agent_cards() -> list[AgentCard]:
    """Return every registered agent card."""
    return list(AGENT_CARDS.values())


def get_agent_card_by_name(name: str) -> AgentCard | None:
    """Look up an agent card by its name (case-sensitive)."""
    return AGENT_CARDS.get(name)


def get_discovery_document() -> dict[str, Any]:
    """
    Build the ``/.well-known/agent.json`` discovery document containing
    all agent cards in the system.
    """
    return {
        "schema_version": "1.0",
        "service": {
            "name": "Self-Querying Retriever",
            "description": (
                "AI-powered document retrieval system with multi-agent "
                "pipeline supporting vector, BM25, hybrid, and self-query "
                "retrieval methods."
            ),
            "version": "1.0.0",
        },
        "agents": [card.to_json_schema() for card in AGENT_CARDS.values()],
        "protocols": {
            "a2a_version": "1.0",
            "message_format": "json",
            "supported_transports": ["http", "websocket"],
        },
    }
