/**
 * MCP Resources for the document retrieval system.
 *
 * Resources are read-only data endpoints that an MCP client can
 * subscribe to.  Each resource has a URI template and a handler
 * that fetches data from the Django backend.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, apiPost } from "../utils/api-client.js";
import logger from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionSummary {
  id: string;
  name: string;
  document_count: number;
  description: string;
  metadata: Record<string, unknown>;
}

interface CollectionDetail extends CollectionSummary {
  created_at: string;
  updated_at: string;
  embedding_model: string;
}

interface SearchResultResource {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

interface SystemStats {
  total_documents: number;
  total_collections: number;
  total_queries: number;
  avg_latency_ms: number;
  storage_size_mb: number;
  uptime_seconds: number;
  version: string;
}

// ---------------------------------------------------------------------------
// Resource registration
// ---------------------------------------------------------------------------

export function registerDocumentResources(server: McpServer): void {
  // -------------------------------------------------------------------------
  // documents://collections
  // -------------------------------------------------------------------------
  server.resource(
    "collections-list",
    "documents://collections",
    "List of all document collections with names, sizes, and descriptions.",
    async (uri) => {
      try {
        logger.info("Resource read: documents://collections");

        const response = await apiGet<{ collections: CollectionSummary[] }>(
          "/api/v1/documents/collections/",
        );

        const collections = response.data.collections ?? [];

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(collections, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Resource collections-list failed", { error: message });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: message }),
            },
          ],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // documents://collection/{id}
  // -------------------------------------------------------------------------
  server.resource(
    "collection-detail",
    new ResourceTemplate("documents://collection/{id}", { list: undefined }),
    "Detailed information about a specific collection including document count, embedding model, and timestamps.",
    async (uri, { id }) => {
      try {
        const collectionId = String(id);
        logger.info("Resource read: documents://collection/{id}", {
          id: collectionId,
        });

        const response = await apiGet<CollectionDetail>(
          `/api/v1/documents/collections/${collectionId}/`,
        );

        const detail = response.data;

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(detail, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Resource collection-detail failed", { error: message });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: message }),
            },
          ],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // documents://search/{query}
  // -------------------------------------------------------------------------
  server.resource(
    "search-results",
    new ResourceTemplate("documents://search/{query}", { list: undefined }),
    "Search results for a given query using the default hybrid retrieval method.",
    async (uri, { query }) => {
      try {
        const queryStr = decodeURIComponent(String(query));
        logger.info("Resource read: documents://search/{query}", {
          query: queryStr,
        });

        const response = await apiPost<{ results: SearchResultResource[] }>(
          "/api/v1/retriever/search/",
          { query: queryStr, method: "hybrid", top_k: 10 },
        );

        const results = response.data.results ?? [];

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ query: queryStr, results }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Resource search-results failed", { error: message });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: message }),
            },
          ],
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // documents://stats
  // -------------------------------------------------------------------------
  server.resource(
    "system-stats",
    "documents://stats",
    "System-wide statistics: document counts, query volumes, storage usage, and uptime.",
    async (uri) => {
      try {
        logger.info("Resource read: documents://stats");

        const response = await apiGet<SystemStats>(
          "/api/v1/analytics/stats/",
        );

        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Resource system-stats failed", { error: message });
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({ error: message }),
            },
          ],
        };
      }
    },
  );

  logger.info("Document resources registered (4 resources)");
}
