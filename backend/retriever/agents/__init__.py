"""
Multi-agent retrieval pipeline built on LangGraph.

This package exposes the primary public API for building, running, and
visualizing the retrieval graph.

Quick-start example::

    from retriever.agents import run_pipeline, AgentConfig

    config = AgentConfig(
        retrieval_methods=["hybrid"],
        use_reranking=True,
        use_compression=False,
        use_query_expansion=True,
    )
    result = run_pipeline("How does wind energy work?", config=config)
    print(result["answer"])
"""

# -- State & configuration ------------------------------------------------
from retriever.agents.state import AgentConfig, RetrieverState

# -- Graph construction & execution ---------------------------------------
from retriever.agents.graph import (
    arun_pipeline,
    build_graph,
    get_compiled_graph,
    get_graph_image,
    get_graph_mermaid,
    run_pipeline,
)

# -- Individual node functions (for testing or custom graphs) --------------
from retriever.agents.nodes import (
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

# -- Tools ----------------------------------------------------------------
from retriever.agents.tools import (
    expand_query,
    filter_by_metadata,
    generate_hypothetical_questions,
    get_document_by_id,
    rerank_documents,
    search_documents,
)

# -- Prompt templates -----------------------------------------------------
from retriever.agents.prompts import (
    ANSWER_GENERATION_PROMPT,
    CONTEXT_COMPRESSION_PROMPT,
    HYPOTHETICAL_QUESTIONS_PROMPT,
    QUERY_ANALYSIS_PROMPT,
    QUERY_EXPANSION_PROMPT,
    SELF_QUERY_PROMPT,
    SUPERVISOR_PROMPT,
)

# -- Callbacks ------------------------------------------------------------
from retriever.agents.callbacks import (
    AgentExecutionLogger,
    LangFuseCallbackHandler,
    StreamingCallbackHandler,
)

# -- Visualization --------------------------------------------------------
from retriever.agents.visualization import (
    generate_graph_description,
    generate_mermaid_diagram,
    get_agent_flow_diagram,
)

__all__ = [
    # State
    "RetrieverState",
    "AgentConfig",
    # Graph
    "build_graph",
    "get_compiled_graph",
    "run_pipeline",
    "arun_pipeline",
    "get_graph_mermaid",
    "get_graph_image",
    # Nodes
    "query_analyzer_node",
    "query_expander_node",
    "self_query_constructor_node",
    "vector_retriever_node",
    "bm25_retriever_node",
    "hybrid_merger_node",
    "hypothetical_question_node",
    "reranker_node",
    "compressor_node",
    "answer_generator_node",
    "supervisor_node",
    # Tools
    "search_documents",
    "filter_by_metadata",
    "get_document_by_id",
    "generate_hypothetical_questions",
    "rerank_documents",
    "expand_query",
    # Prompts
    "QUERY_ANALYSIS_PROMPT",
    "QUERY_EXPANSION_PROMPT",
    "HYPOTHETICAL_QUESTIONS_PROMPT",
    "ANSWER_GENERATION_PROMPT",
    "CONTEXT_COMPRESSION_PROMPT",
    "SUPERVISOR_PROMPT",
    "SELF_QUERY_PROMPT",
    # Callbacks
    "LangFuseCallbackHandler",
    "AgentExecutionLogger",
    "StreamingCallbackHandler",
    # Visualization
    "generate_mermaid_diagram",
    "generate_graph_description",
    "get_agent_flow_diagram",
]
