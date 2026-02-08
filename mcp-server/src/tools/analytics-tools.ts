/**
 * MCP Tools for analytics and monitoring operations.
 *
 * Provides insight into query history, retrieval performance,
 * method comparisons, and dashboard-level statistics.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../utils/api-client.js";
import logger from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueryHistoryEntry {
  id: string;
  query: string;
  method: string;
  timestamp: string;
  result_count: number;
  latency_ms: number;
}

interface PerformanceMetrics {
  total_queries: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  avg_result_count: number;
  method_breakdown: Record<string, { count: number; avg_latency_ms: number }>;
  period: string;
}

interface MethodComparison {
  query: string;
  comparisons: Array<{
    method: string;
    latency_ms: number;
    result_count: number;
    avg_score: number;
    top_result_preview: string;
  }>;
}

interface DashboardStats {
  total_documents: number;
  total_collections: number;
  total_queries_today: number;
  total_queries_all_time: number;
  avg_latency_ms: number;
  most_used_method: string;
  storage_size_mb: number;
  active_agents: number;
  system_health: string;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerAnalyticsTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // get_query_history
  // -------------------------------------------------------------------------
  server.tool(
    "get_query_history",
    "Retrieve recent search queries with their methods, result counts, and latency information.",
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum number of history entries to return"),
      method: z
        .enum(["vector", "bm25", "hybrid", "self-query"])
        .optional()
        .describe("Filter history by retrieval method"),
      since: z
        .string()
        .optional()
        .describe("ISO-8601 timestamp; only return queries after this time"),
    },
    async ({ limit, method, since }) => {
      try {
        logger.info("get_query_history called", { limit, method, since });

        const params: Record<string, unknown> = { limit };
        if (method) params.method = method;
        if (since) params.since = since;

        const response = await apiGet<{ queries: QueryHistoryEntry[] }>(
          "/api/v1/analytics/query-history/",
          params,
        );

        const queries = response.data.queries ?? [];

        const formatted = queries
          .map(
            (q) =>
              `[${q.timestamp}] "${q.query}" (${q.method}) -> ${q.result_count} results in ${q.latency_ms}ms`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text:
                queries.length > 0
                  ? `Query history (${queries.length} entries):\n\n${formatted}`
                  : "No query history found for the given filters.",
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("get_query_history failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error fetching query history: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // get_performance_metrics
  // -------------------------------------------------------------------------
  server.tool(
    "get_performance_metrics",
    "Get aggregated retrieval performance statistics including latency percentiles and per-method breakdowns.",
    {
      period: z
        .enum(["1h", "24h", "7d", "30d"])
        .default("24h")
        .describe("Time period to aggregate over"),
    },
    async ({ period }) => {
      try {
        logger.info("get_performance_metrics called", { period });

        const response = await apiGet<PerformanceMetrics>(
          "/api/v1/analytics/performance/",
          { period },
        );

        const m = response.data;

        const methodLines = Object.entries(m.method_breakdown)
          .map(
            ([name, stats]) =>
              `  ${name}: ${stats.count} queries, avg ${stats.avg_latency_ms.toFixed(1)}ms`,
          )
          .join("\n");

        const text = [
          `Performance metrics (${m.period}):`,
          `  Total queries: ${m.total_queries}`,
          `  Avg latency:   ${m.avg_latency_ms.toFixed(1)}ms`,
          `  P95 latency:   ${m.p95_latency_ms.toFixed(1)}ms`,
          `  P99 latency:   ${m.p99_latency_ms.toFixed(1)}ms`,
          `  Avg results:   ${m.avg_result_count.toFixed(1)}`,
          ``,
          `Method breakdown:`,
          methodLines,
        ].join("\n");

        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("get_performance_metrics failed", { error: message });
        return {
          content: [
            { type: "text" as const, text: `Error fetching performance metrics: ${message}` },
          ],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // compare_methods
  // -------------------------------------------------------------------------
  server.tool(
    "compare_methods",
    "Compare retrieval method effectiveness by running the same query across multiple methods and returning side-by-side metrics.",
    {
      query: z.string().describe("Query to run against each method"),
      methods: z
        .array(z.enum(["vector", "bm25", "hybrid", "self-query"]))
        .default(["vector", "bm25", "hybrid"])
        .describe("Methods to compare"),
      top_k: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of results per method"),
    },
    async ({ query, methods, top_k }) => {
      try {
        logger.info("compare_methods called", { query, methods, top_k });

        const response = await apiPost<MethodComparison>(
          "/api/v1/analytics/compare-methods/",
          { query, methods, top_k },
        );

        const comparison = response.data;

        const table = comparison.comparisons
          .map(
            (c) =>
              `${c.method}:\n` +
              `  Latency:   ${c.latency_ms}ms\n` +
              `  Results:   ${c.result_count}\n` +
              `  Avg score: ${c.avg_score.toFixed(4)}\n` +
              `  Top hit:   ${c.top_result_preview}`,
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Method comparison for "${comparison.query}":\n\n${table}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("compare_methods failed", { error: message });
        return {
          content: [{ type: "text" as const, text: `Error comparing methods: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // get_dashboard_stats
  // -------------------------------------------------------------------------
  server.tool(
    "get_dashboard_stats",
    "Get high-level dashboard statistics: document counts, query volumes, system health, and resource usage.",
    {},
    async () => {
      try {
        logger.info("get_dashboard_stats called");

        const response = await apiGet<DashboardStats>(
          "/api/v1/analytics/dashboard/",
        );

        const s = response.data;

        const text = [
          "Dashboard Statistics",
          "====================",
          `Documents:          ${s.total_documents}`,
          `Collections:        ${s.total_collections}`,
          `Queries today:      ${s.total_queries_today}`,
          `Queries all-time:   ${s.total_queries_all_time}`,
          `Avg latency:        ${s.avg_latency_ms.toFixed(1)}ms`,
          `Most used method:   ${s.most_used_method}`,
          `Storage:            ${s.storage_size_mb.toFixed(1)} MB`,
          `Active agents:      ${s.active_agents}`,
          `System health:      ${s.system_health}`,
        ].join("\n");

        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("get_dashboard_stats failed", { error: message });
        return {
          content: [
            { type: "text" as const, text: `Error fetching dashboard stats: ${message}` },
          ],
          isError: true,
        };
      }
    },
  );

  logger.info("Analytics tools registered (4 tools)");
}
