/**
 * Configuration for the MCP Server.
 *
 * Reads settings from environment variables with sensible defaults
 * for local development.
 */

import dotenv from "dotenv";

dotenv.config();

export interface ServerConfig {
  /** Base URL of the Django backend API */
  djangoBackendUrl: string;
  /** Port the MCP SSE transport listens on */
  mcpServerPort: number;
  /** Minimum log level (error, warn, info, debug) */
  logLevel: string;
  /** Transport mode: "stdio" or "sse" */
  transportMode: string;
  /** Server name advertised in the MCP protocol */
  serverName: string;
  /** Server version */
  serverVersion: string;
}

const config: ServerConfig = {
  djangoBackendUrl:
    process.env.DJANGO_BACKEND_URL ?? "http://backend:8083",
  mcpServerPort: parseInt(process.env.MCP_SERVER_PORT ?? "3086", 10),
  logLevel: process.env.LOG_LEVEL ?? "info",
  transportMode: process.env.MCP_TRANSPORT_MODE ?? "sse",
  serverName: "self-querying-retriever-mcp",
  serverVersion: "1.0.0",
};

export default config;
