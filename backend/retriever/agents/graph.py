"""
Main LangGraph graph definition for the multi-agent retrieval pipeline.

Constructs a ``StateGraph`` with the following topology:

    START -> query_analyzer -> supervisor
    supervisor --(conditional)--> query_expander | vector_retriever
                                | bm25_retriever | hybrid_merger
                                | self_query_constructor
                                | hypothetical_question_retriever
    query_expander --> vector_retriever
    [all retrievers] --(conditional)--> reranker | compressor | answer_generator
    reranker --(conditional)--> compressor | answer_generator
    compressor --> answer_generator
    answer_generator --> END
"""

from __future__ import annotations

import io
import logging
from typing import Any, Dict, Optional

from langgraph.graph import END, START, StateGraph

from .nodes import (
    answer_generator_node,
    bm25_retriever_node,
    compressor_node,
    hybrid_merger_node,
    hypothetical_question_node,
    query_analyzer_node,
    query_expander_node,
    reranker_node,
    self_query_constructor_node,
    supervisor_node,
    vector_retriever_node,
)
from .state import AgentConfig, RetrieverState
from .visualization import generate_mermaid_diagram

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Conditional edge functions
# ---------------------------------------------------------------------------

def _route_from_supervisor(state: RetrieverState) -> str:
    """Decide which retrieval node to visit after the supervisor."""
    method = state.get("retrieval_method", "vector")
    valid_routes = {
        "expand",
        "vector",
        "bm25",
        "hybrid",
        "self_query",
        "hypothetical_questions",
    }
    if method not in valid_routes:
        logger.warning(
            "Unknown retrieval_method '%s', defaulting to 'vector'", method
        )
        return "vector"
    return method


def _route_after_retrieval(state: RetrieverState) -> str:
    """Decide what happens after a retrieval node finishes.

    Checks ``config.use_reranking`` and ``config.use_compression`` to
    determine the next hop.
    """
    config = _extract_config(state)
    if config.use_reranking:
        return "reranker"
    if config.use_compression:
        return "compressor"
    return "answer_generator"


def _route_after_reranker(state: RetrieverState) -> str:
    """Decide what happens after the reranker node finishes."""
    config = _extract_config(state)
    if config.use_compression:
        return "compressor"
    return "answer_generator"


def _extract_config(state: RetrieverState) -> AgentConfig:
    """Safely extract an ``AgentConfig`` from state."""
    cfg = state.get("config")
    if cfg is None:
        return AgentConfig()
    if isinstance(cfg, dict):
        return AgentConfig.from_dict(cfg)
    return cfg


# ---------------------------------------------------------------------------
# Graph builder
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    """Construct and return the (uncompiled) ``StateGraph``.

    Call ``.compile()`` on the returned graph to obtain a runnable.
    """
    graph = StateGraph(RetrieverState)

    # -- Register nodes -------------------------------------------------
    graph.add_node("query_analyzer", query_analyzer_node)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("query_expander", query_expander_node)
    graph.add_node("self_query_constructor", self_query_constructor_node)
    graph.add_node("vector_retriever", vector_retriever_node)
    graph.add_node("bm25_retriever", bm25_retriever_node)
    graph.add_node("hybrid_merger", hybrid_merger_node)
    graph.add_node(
        "hypothetical_question_retriever", hypothetical_question_node
    )
    graph.add_node("reranker", reranker_node)
    graph.add_node("compressor", compressor_node)
    graph.add_node("answer_generator", answer_generator_node)

    # -- Entry edge -----------------------------------------------------
    graph.add_edge(START, "query_analyzer")
    graph.add_edge("query_analyzer", "supervisor")

    # -- Supervisor conditional routing ---------------------------------
    graph.add_conditional_edges(
        "supervisor",
        _route_from_supervisor,
        {
            "expand": "query_expander",
            "vector": "vector_retriever",
            "bm25": "bm25_retriever",
            "hybrid": "hybrid_merger",
            "self_query": "self_query_constructor",
            "hypothetical_questions": "hypothetical_question_retriever",
        },
    )

    # -- Query expander always flows to vector retriever -----------------
    graph.add_edge("query_expander", "vector_retriever")

    # -- Post-retrieval conditional routing for every retriever node -----
    _retrieval_destinations = {
        "reranker": "reranker",
        "compressor": "compressor",
        "answer_generator": "answer_generator",
    }

    for retriever_name in (
        "vector_retriever",
        "bm25_retriever",
        "hybrid_merger",
        "self_query_constructor",
        "hypothetical_question_retriever",
    ):
        graph.add_conditional_edges(
            retriever_name,
            _route_after_retrieval,
            _retrieval_destinations,
        )

    # -- Post-reranker conditional routing ------------------------------
    graph.add_conditional_edges(
        "reranker",
        _route_after_reranker,
        {
            "compressor": "compressor",
            "answer_generator": "answer_generator",
        },
    )

    # -- Compressor always flows to answer generator --------------------
    graph.add_edge("compressor", "answer_generator")

    # -- Answer generator terminates the graph --------------------------
    graph.add_edge("answer_generator", END)

    return graph


# ---------------------------------------------------------------------------
# Compiled graph singleton
# ---------------------------------------------------------------------------

_compiled_graph = None


def get_compiled_graph(
    checkpointer: Optional[Any] = None,
    force_rebuild: bool = False,
) -> Any:
    """Return a compiled (runnable) version of the retrieval graph.

    The graph is built once and cached as a module-level singleton.  Pass
    ``force_rebuild=True`` to recreate it.

    Args:
        checkpointer: An optional LangGraph checkpointer (e.g.
            ``MemorySaver``) for persisting state across invocations.
        force_rebuild: If ``True``, rebuild even if cached.

    Returns:
        A compiled ``CompiledStateGraph`` ready for ``.invoke()`` or
        ``.stream()``.
    """
    global _compiled_graph

    if _compiled_graph is not None and not force_rebuild:
        return _compiled_graph

    graph = build_graph()

    compile_kwargs: Dict[str, Any] = {}
    if checkpointer is not None:
        compile_kwargs["checkpointer"] = checkpointer

    _compiled_graph = graph.compile(**compile_kwargs)
    logger.info("Retrieval graph compiled successfully")
    return _compiled_graph


# ---------------------------------------------------------------------------
# Convenience runners
# ---------------------------------------------------------------------------

def run_pipeline(
    query: str,
    config: Optional[AgentConfig] = None,
    checkpointer: Optional[Any] = None,
    callbacks: Optional[list] = None,
) -> Dict[str, Any]:
    """Run the full retrieval pipeline synchronously.

    Args:
        query: The user's natural-language question.
        config: Optional ``AgentConfig`` to override defaults.
        checkpointer: Optional LangGraph checkpointer.
        callbacks: Optional list of LangChain callback handlers.

    Returns:
        The final ``RetrieverState`` dict.
    """
    compiled = get_compiled_graph(checkpointer=checkpointer)

    initial_state: Dict[str, Any] = {
        "query": query,
        "original_query": query,
        "expanded_queries": [],
        "retrieval_method": "",
        "filters": {},
        "documents": [],
        "reranked_documents": [],
        "compressed_documents": [],
        "final_documents": [],
        "answer": "",
        "agent_messages": [],
        "metadata": {},
        "execution_trace": [],
        "error": None,
        "config": config or AgentConfig(),
    }

    invoke_config: Dict[str, Any] = {}
    if callbacks:
        invoke_config["callbacks"] = callbacks

    result = compiled.invoke(initial_state, config=invoke_config)
    return result


async def arun_pipeline(
    query: str,
    config: Optional[AgentConfig] = None,
    checkpointer: Optional[Any] = None,
    callbacks: Optional[list] = None,
) -> Dict[str, Any]:
    """Run the full retrieval pipeline asynchronously.

    Identical to ``run_pipeline`` but uses ``ainvoke`` for async Django
    views and Channels consumers.
    """
    compiled = get_compiled_graph(checkpointer=checkpointer)

    initial_state: Dict[str, Any] = {
        "query": query,
        "original_query": query,
        "expanded_queries": [],
        "retrieval_method": "",
        "filters": {},
        "documents": [],
        "reranked_documents": [],
        "compressed_documents": [],
        "final_documents": [],
        "answer": "",
        "agent_messages": [],
        "metadata": {},
        "execution_trace": [],
        "error": None,
        "config": config or AgentConfig(),
    }

    invoke_config: Dict[str, Any] = {}
    if callbacks:
        invoke_config["callbacks"] = callbacks

    result = await compiled.ainvoke(initial_state, config=invoke_config)
    return result


# ---------------------------------------------------------------------------
# Visualization helpers
# ---------------------------------------------------------------------------

def get_graph_mermaid() -> str:
    """Return the Mermaid-syntax diagram of the compiled graph.

    Attempts to use the compiled graph's built-in drawer first; falls
    back to the static diagram in ``visualization.py``.
    """
    try:
        compiled = get_compiled_graph()
        return generate_mermaid_diagram(compiled)
    except Exception:
        return generate_mermaid_diagram(None)


def get_graph_image() -> Optional[bytes]:
    """Return a PNG visualization of the compiled graph.

    Requires ``pygraphviz`` or ``grandalf`` to be installed.  Returns
    ``None`` if rendering fails.
    """
    try:
        compiled = get_compiled_graph()
        png_bytes = compiled.get_graph().draw_mermaid_png()
        return png_bytes
    except Exception as exc:
        logger.warning("get_graph_image failed: %s", exc)
        return None
