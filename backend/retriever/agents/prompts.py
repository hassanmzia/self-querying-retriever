"""
Prompt templates for the multi-agent retrieval pipeline.

Every prompt is defined as a plain string so it can be wrapped in
``ChatPromptTemplate`` or ``PromptTemplate`` at the call-site, keeping
this module free of framework coupling beyond constants.
"""

# ---------------------------------------------------------------------------
# Query analysis -- used by the supervisor / query_analyzer nodes
# ---------------------------------------------------------------------------

QUERY_ANALYSIS_PROMPT = """\
You are an expert query analyzer for a renewable energy knowledge base.

Given the user query, analyze it and produce a JSON object with the following fields:

1. "retrieval_method": one of "vector", "bm25", "hybrid", "self_query", "hypothetical_questions".
   - Use "self_query" when the query explicitly or implicitly references metadata
     (year, topic, subtopic).
   - Use "bm25" when the query contains very specific keywords or technical terms.
   - Use "hybrid" when the query mixes keyword terms with semantic intent.
   - Use "hypothetical_questions" when the query is broad or exploratory.
   - Default to "vector" for general semantic similarity searches.

2. "filters": a dict (possibly empty) with optional keys "year", "topics", "subtopic".
   - "year" must be an integer (2023, 2024, or 2025) if present.
   - "topics" must be one of: introduction, solar power, wind energy, hydroelectric,
     geothermal, biomass, energy storage, environment.
   - "subtopic" is a free-form string if detected.

3. "needs_expansion": boolean -- true when the query would benefit from synonym
   expansion or alternative phrasings.

4. "reasoning": a short explanation of your choices.

Respond ONLY with valid JSON. No markdown fences.

User query: {query}
"""

# ---------------------------------------------------------------------------
# Query expansion -- mirrors the notebook approach
# ---------------------------------------------------------------------------

QUERY_EXPANSION_PROMPT = """\
You are an expert in information retrieval systems, particularly skilled in \
enhancing queries for document search efficiency.

Perform query expansion on the received question by considering alternative \
phrasings or synonyms commonly used in document retrieval contexts.

If there are multiple ways to phrase the user's question or common synonyms \
for key terms, provide several reworded versions.

If there are acronyms or words you are not familiar with, do not try to \
rephrase them.

Return at least 3 versions of the question as a list.
Generate only a list of questions. Do not mention anything before or after \
the list.

Question:
{query}
"""

# ---------------------------------------------------------------------------
# Hypothetical question generation -- mirrors the notebook approach
# ---------------------------------------------------------------------------

HYPOTHETICAL_QUESTIONS_PROMPT = """\
Generate a list of exactly 3 hypothetical questions that the below document \
could be used to answer:

{doc}

Generate only a list of questions. Do not mention anything before or after \
the list.
"""

# ---------------------------------------------------------------------------
# Answer generation
# ---------------------------------------------------------------------------

ANSWER_GENERATION_PROMPT = """\
You are a knowledgeable assistant specializing in renewable energy.

Using ONLY the context provided below, answer the user's question.
If the context does not contain enough information to fully answer, say so \
honestly and provide what you can.

Context:
{context}

Question: {query}

Provide a clear, well-structured answer. Cite specific details from the \
context when possible.
"""

# ---------------------------------------------------------------------------
# Context compression
# ---------------------------------------------------------------------------

CONTEXT_COMPRESSION_PROMPT = """\
Given the following question and context, extract only the parts of the \
context that are directly relevant to answering the question. Remove \
irrelevant or redundant information while preserving the meaning and key \
facts.

Question: {query}

Context:
{context}

Extracted relevant content:
"""

# ---------------------------------------------------------------------------
# Supervisor routing
# ---------------------------------------------------------------------------

SUPERVISOR_PROMPT = """\
You are the supervisor agent of a multi-agent retrieval pipeline for a \
renewable energy knowledge base.

Based on the query analysis below, decide the next step in the pipeline.

Query analysis:
{analysis}

Current execution trace:
{trace}

Available nodes:
- query_expander: expand the query with synonyms / alternative phrasings
- self_query_constructor: construct metadata filters from natural language
- vector_retriever: standard vector similarity search
- bm25_retriever: keyword-based BM25 search
- hybrid_merger: ensemble of vector + BM25 results
- hypothetical_question_retriever: generate hypothetical questions and retrieve parent chunks
- reranker: cross-encoder reranking of retrieved documents
- compressor: LLM-based context compression
- answer_generator: generate the final answer

Respond with ONLY the name of the next node to execute.
If the pipeline is complete, respond with "answer_generator".
"""

# ---------------------------------------------------------------------------
# Self-query construction
# ---------------------------------------------------------------------------

SELF_QUERY_PROMPT = """\
You are a query constructor for a renewable energy document store.

The documents have the following metadata fields:
- year (integer): 2023, 2024, or 2025
- topics (string): one of introduction, solar power, wind energy, \
hydroelectric, geothermal, biomass, energy storage, environment
- subtopic (string): a more specific subcategory

Given the user query, extract:
1. "search_query": the semantic portion of the query (for vector similarity)
2. "filters": a dict of metadata filters to apply. Only include filters \
that are clearly indicated by the query.

Respond ONLY with valid JSON. No markdown fences.

User query: {query}
"""
