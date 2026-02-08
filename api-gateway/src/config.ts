import dotenv from 'dotenv';

dotenv.config();

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

export interface Config {
  port: number;
  djangoBackendUrl: string;
  mcpServerUrl: string;
  corsOrigins: string[];
  rateLimit: RateLimitConfig;
  apiKeyHeader: string;
  apiKeys: string[];
  logLevel: string;
  nodeEnv: string;
  wsHeartbeatInterval: number;
  proxyTimeout: number;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3084', 10),

  djangoBackendUrl: process.env.DJANGO_BACKEND_URL || 'http://backend:8083',

  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://mcp-server:3086',

  corsOrigins: (process.env.CORS_ORIGINS || 'http://172.168.1.95:3088').split(',').map(s => s.trim()),

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    message: 'Too many requests from this IP, please try again later.',
  },

  apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key',

  apiKeys: (process.env.API_KEYS || '').split(',').filter(Boolean),

  logLevel: process.env.LOG_LEVEL || 'info',

  nodeEnv: process.env.NODE_ENV || 'development',

  wsHeartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),

  proxyTimeout: parseInt(process.env.PROXY_TIMEOUT || '120000', 10),
};

export default config;
