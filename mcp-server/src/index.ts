/**
 * Main entry point for the Self-Querying Retriever MCP Server.
 *
 * Supports two transport modes controlled by MCP_TRANSPORT_MODE:
 *   - "stdio"  -- communicates over stdin/stdout (default for CLI clients)
 *   - "sse"    -- runs an Express HTTP server on MCP_SERVER_PORT with
 *                 Server-Sent Events transport (default for networked clients)
 *
 * In SSE mode a lightweight health-check endpoint is also exposed at
 * GET /health so container orchestrators can probe liveness.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import cors from "cors";

import config from "./config.js";
import logger from "./utils/logger.js";
import { registerRetrievalTools } from "./tools/retrieval-tools.js";
import { registerAnalyticsTools } from "./tools/analytics-tools.js";
import { registerDocumentResources } from "./resources/document-resources.js";

// ---------------------------------------------------------------------------
// Create the MCP server instance
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: config.serverName,
  version: config.serverVersion,
});

// ---------------------------------------------------------------------------
// Register all tools and resources
// ---------------------------------------------------------------------------

registerRetrievalTools(server);
registerAnalyticsTools(server);
registerDocumentResources(server);

logger.info("All MCP tools and resources registered");

// ---------------------------------------------------------------------------
// Transport: Stdio
// ---------------------------------------------------------------------------

async function startStdioTransport(): Promise<void> {
  logger.info("Starting MCP server with StdioServerTransport");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server connected via stdio");
}

// ---------------------------------------------------------------------------
// Transport: SSE over Express
// ---------------------------------------------------------------------------

async function startSSETransport(): Promise<void> {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // -- Health check --------------------------------------------------------
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      server: config.serverName,
      version: config.serverVersion,
      transport: "sse",
      timestamp: new Date().toISOString(),
      backend_url: config.djangoBackendUrl,
    });
  });

  // -- SSE connection endpoint ---------------------------------------------
  // Keep track of active transports so we can pair the POST to the right one.
  const transports: Record<string, SSEServerTransport> = {};

  app.get("/sse", async (req: Request, res: Response) => {
    logger.info("New SSE connection established", {
      remoteAddress: req.socket.remoteAddress,
    });

    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;

    res.on("close", () => {
      logger.info("SSE connection closed", { sessionId: transport.sessionId });
      delete transports[transport.sessionId];
    });

    await server.connect(transport);
  });

  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;

    if (!sessionId || !transports[sessionId]) {
      res.status(400).json({ error: "Invalid or missing sessionId" });
      return;
    }

    await transports[sessionId].handlePostMessage(req, res);
  });

  // -- Server info ---------------------------------------------------------
  app.get("/info", (_req: Request, res: Response) => {
    res.json({
      name: config.serverName,
      version: config.serverVersion,
      transport: "sse",
      tools: [
        "search_documents",
        "get_document",
        "list_collections",
        "create_collection",
        "add_document",
        "query_with_agents",
        "get_retrieval_methods",
        "expand_query",
        "rerank_results",
        "get_query_history",
        "get_performance_metrics",
        "compare_methods",
        "get_dashboard_stats",
      ],
      resources: [
        "documents://collections",
        "documents://collection/{id}",
        "documents://search/{query}",
        "documents://stats",
      ],
    });
  });

  // -- Start listening -----------------------------------------------------
  app.listen(config.mcpServerPort, () => {
    logger.info(
      `MCP SSE server listening on port ${config.mcpServerPort}`,
    );
    logger.info(
      `Health check at http://localhost:${config.mcpServerPort}/health`,
    );
    logger.info(`Django backend URL: ${config.djangoBackendUrl}`);
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info("Initialising MCP server", {
    transport: config.transportMode,
    version: config.serverVersion,
  });

  try {
    if (config.transportMode === "stdio") {
      await startStdioTransport();
    } else {
      await startSSETransport();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Fatal: failed to start MCP server", { error: message });
    process.exit(1);
  }
}

main();
