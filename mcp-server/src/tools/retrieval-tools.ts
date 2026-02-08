/**
 * MCP Tools for document retrieval operations.
 *
 * Each tool is registered on the MCP Server instance and delegates to
 * the Django backend REST API via the shared Axios client.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../utils/api-client.js";
import logger from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types returned by the Django backend
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

interface DocumentDetail {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  collection: string;
}

interface Collection {
  id: string;
  name: string;
  document_count: number;
  metadata: Record<string, unknown>;
}

interface RetrievalMethod {
  name: string;
  description: string;
  supported_params: string[];
}

interface QueryExpansion {
  original_query: string;
  expanded_queries: string[];
}

interface AgentPipelineResult {
  answer: string;
  sources: SearchResult[];
  method_used: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerRetrievalTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // search_documents
  // -------------------------------------------------------------------------
  server.tool(
    "search_documents",
    "Search documents using vector, BM25, hybrid, or self-query retrieval methods. Returns ranked results with relevance scores.",
    {
      query: z.string().describe("The search query text"),
      method: z
        .enum(["vector", "bm25", "hybrid", "self-query"])
        .default("hybrid")
        .describe("Retrieval method to use"),
      filters: z
        .record(z.unknown())
        .optional()
        .describe("Metadata filters to apply (key-value pairs)"),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(5)
        .describe("Number of results to return"),
      collection: z
        .string()
        .optional()
        .describe("Target collection name (uses default if omitted)"),
    },
    async ({ query, method, filters, top_k, collection }) => {
      try {
        logger.info("search_documents called", { query, method, top_k });

        const response = await apiPost<{ results: SearchResult[] }>(
          "/api/v1/retriever/search/",
          {
            query,
            method,
            filters: filters ?? {},
            top_k,
            ...(collection ? { collection } : {}),
          },
        );

        const results = response.data.results ?? [];

        const formatted = results
          .map(
            (r, i) =>
              `[${i + 1}] (score: ${r.score.toFixed(4)}) ${r.content}\n    Metadata: ${JSON.stringify(r.metadata)}`,
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text:
                results.length > 0
                  ? `Found ${results.length} results for "${query}" using ${method}:\n\n${formatted}`
                  : `No results found for "${query}" using ${method}.`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("search_documents failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error searching documents: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // get_document
  // -------------------------------------------------------------------------
  server.tool(
    "get_document",
    "Retrieve a single document by its unique identifier, including full content and metadata.",
    {
      document_id: z.string().describe("Unique document identifier"),
      collection: z
        .string()
        .optional()
        .describe("Collection the document belongs to"),
    },
    async ({ document_id, collection }) => {
      try {
        logger.info("get_document called", { document_id });

        const params: Record<string, unknown> = {};
        if (collection) params.collection = collection;

        const response = await apiGet<DocumentDetail>(
          `/api/v1/documents/${document_id}/`,
          params,
        );

        const doc = response.data;

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Document: ${doc.id}`,
                `Collection: ${doc.collection}`,
                `Metadata: ${JSON.stringify(doc.metadata, null, 2)}`,
                `---`,
                doc.content,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("get_document failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error retrieving document: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // list_collections
  // -------------------------------------------------------------------------
  server.tool(
    "list_collections",
    "List all available document collections with their document counts and metadata.",
    {},
    async () => {
      try {
        logger.info("list_collections called");

        const response = await apiGet<{ collections: Collection[] }>(
          "/api/v1/documents/collections/",
        );

        const collections = response.data.collections ?? [];

        const formatted = collections
          .map(
            (c) =>
              `- ${c.name} (${c.document_count} docs) [id: ${c.id}]`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text:
                collections.length > 0
                  ? `Available collections:\n\n${formatted}`
                  : "No collections found.",
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("list_collections failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error listing collections: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // create_collection
  // -------------------------------------------------------------------------
  server.tool(
    "create_collection",
    "Create a new document collection for organising and retrieving documents.",
    {
      name: z.string().describe("Name for the new collection"),
      description: z
        .string()
        .optional()
        .describe("Human-readable description of the collection"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Arbitrary metadata to attach to the collection"),
    },
    async ({ name, description, metadata }) => {
      try {
        logger.info("create_collection called", { name });

        const response = await apiPost<Collection>(
          "/api/v1/documents/collections/",
          {
            name,
            description: description ?? "",
            metadata: metadata ?? {},
          },
        );

        const col = response.data;

        return {
          content: [
            {
              type: "text" as const,
              text: `Collection created successfully:\n  Name: ${col.name}\n  ID: ${col.id}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("create_collection failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error creating collection: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // add_document
  // -------------------------------------------------------------------------
  server.tool(
    "add_document",
    "Add a new document to a collection. The document will be chunked, embedded, and indexed automatically.",
    {
      collection: z.string().describe("Target collection name or ID"),
      content: z.string().describe("Full text content of the document"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Metadata key-value pairs (e.g. source, author, date)"),
      document_id: z
        .string()
        .optional()
        .describe("Optional custom document ID (auto-generated if omitted)"),
    },
    async ({ collection, content, metadata, document_id }) => {
      try {
        logger.info("add_document called", {
          collection,
          contentLength: content.length,
        });

        const response = await apiPost<{ id: string; status: string }>(
          "/api/v1/documents/",
          {
            collection,
            content,
            metadata: metadata ?? {},
            ...(document_id ? { id: document_id } : {}),
          },
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Document added successfully:\n  ID: ${response.data.id}\n  Collection: ${collection}\n  Status: ${response.data.status}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("add_document failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error adding document: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // query_with_agents
  // -------------------------------------------------------------------------
  server.tool(
    "query_with_agents",
    "Run a full agent-pipeline query using the LangGraph supervisor workflow. Coordinates multiple specialised agents for optimal retrieval and answer generation.",
    {
      query: z.string().describe("The user question or query"),
      collection: z
        .string()
        .optional()
        .describe("Target collection (uses default if omitted)"),
      include_sources: z
        .boolean()
        .default(true)
        .describe("Whether to include source documents in the response"),
    },
    async ({ query, collection, include_sources }) => {
      try {
        logger.info("query_with_agents called", { query });

        const response = await apiPost<AgentPipelineResult>(
          "/api/v1/retriever/agent-query/",
          {
            query,
            ...(collection ? { collection } : {}),
            include_sources,
          },
        );

        const result = response.data;

        const parts = [
          `Answer:\n${result.answer}`,
          `\nMethod used: ${result.method_used}`,
          `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
        ];

        if (include_sources && result.sources?.length > 0) {
          parts.push("\nSources:");
          result.sources.forEach((s, i) => {
            parts.push(
              `  [${i + 1}] (score: ${s.score.toFixed(4)}) ${s.content.slice(0, 200)}...`,
            );
          });
        }

        return {
          content: [{ type: "text" as const, text: parts.join("\n") }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("query_with_agents failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error running agent query: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // get_retrieval_methods
  // -------------------------------------------------------------------------
  server.tool(
    "get_retrieval_methods",
    "List all available retrieval methods with their descriptions and supported parameters.",
    {},
    async () => {
      try {
        logger.info("get_retrieval_methods called");

        const response = await apiGet<{ methods: RetrievalMethod[] }>(
          "/api/v1/retriever/methods/",
        );

        const methods = response.data.methods ?? [];

        const formatted = methods
          .map(
            (m) =>
              `- ${m.name}: ${m.description}\n  Params: ${m.supported_params.join(", ")}`,
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text:
                methods.length > 0
                  ? `Available retrieval methods:\n\n${formatted}`
                  : "No retrieval methods reported by the backend.",
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("get_retrieval_methods failed", { error: message });
        return {
          content: [
            { type: "text" as const, text: `Error fetching retrieval methods: ${message}` },
          ],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // expand_query
  // -------------------------------------------------------------------------
  server.tool(
    "expand_query",
    "Expand a search query into multiple alternative phrasings to improve recall.",
    {
      query: z.string().describe("Original query to expand"),
      num_expansions: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(3)
        .describe("Number of alternative queries to generate"),
    },
    async ({ query, num_expansions }) => {
      try {
        logger.info("expand_query called", { query, num_expansions });

        const response = await apiPost<QueryExpansion>(
          "/api/v1/retriever/expand-query/",
          { query, num_expansions },
        );

        const expansion = response.data;

        const lines = [
          `Original: ${expansion.original_query}`,
          "",
          "Expanded queries:",
          ...expansion.expanded_queries.map((q, i) => `  ${i + 1}. ${q}`),
        ];

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("expand_query failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error expanding query: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // rerank_results
  // -------------------------------------------------------------------------
  server.tool(
    "rerank_results",
    "Re-rank a set of search results using a cross-encoder model for improved relevance ordering.",
    {
      query: z.string().describe("Original search query"),
      results: z
        .array(
          z.object({
            id: z.string(),
            content: z.string(),
            score: z.number(),
            metadata: z.record(z.unknown()).optional(),
          }),
        )
        .describe("Array of search result objects to re-rank"),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(5)
        .describe("Number of results to keep after re-ranking"),
    },
    async ({ query, results, top_k }) => {
      try {
        logger.info("rerank_results called", {
          query,
          numResults: results.length,
          top_k,
        });

        const response = await apiPost<{ results: SearchResult[] }>(
          "/api/v1/retriever/rerank/",
          { query, results, top_k },
        );

        const reranked = response.data.results ?? [];

        const formatted = reranked
          .map(
            (r, i) =>
              `[${i + 1}] (score: ${r.score.toFixed(4)}) ${r.content.slice(0, 200)}...`,
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text:
                reranked.length > 0
                  ? `Re-ranked results (top ${top_k}):\n\n${formatted}`
                  : "No results after re-ranking.",
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("rerank_results failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error re-ranking results: ${message}` }],
          isError: true,
        };
      }
    },
  );

  logger.info("Retrieval tools registered (9 tools)");
}
