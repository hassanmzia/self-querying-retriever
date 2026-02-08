import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import morgan from 'morgan';
import http from 'http';
import axios from 'axios';

import config from './config';
import logger from './utils/logger';
import { requestLogger } from './middleware/request-logger';
import { apiKeyAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { WebSocketManager } from './services/websocket';

// Route imports
import queryRoutes from './routes/query';
import documentRoutes from './routes/documents';
import agentRoutes from './routes/agents';
import analyticsRoutes from './routes/analytics';
import pipelineRoutes from './routes/pipelines';
import mcpRoutes from './routes/mcp';

import { HealthCheckResponse, ServiceHealth } from './types';

// ============================================================
// Express Application Setup
// ============================================================

const app = express();

// Trust proxy (for running behind nginx/load balancer)
app.set('trust proxy', 1);

// ============================================================
// Global Middleware
// ============================================================

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      config.apiKeyHeader,
      'X-Request-ID',
      'X-Correlation-ID',
      'X-Request-Time',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
    credentials: true,
    maxAge: 86400,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: config.rateLimit.message,
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

app.use(limiter);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Morgan HTTP request logging (combined with Winston)
app.use(
  morgan('short', {
    stream: {
      write: (message: string) => {
        logger.http(message.trim());
      },
    },
    skip: (req) => req.path === '/health',
  })
);

// Custom request logger (assigns request IDs, logs request/response details)
app.use(requestLogger);

// API key authentication
app.use(apiKeyAuth);

// ============================================================
// Health Check Endpoint
// ============================================================

app.get('/health', async (_req, res) => {
  const startTime = Date.now();

  // Check backend health
  let backendHealth: ServiceHealth = { status: 'unknown' };
  try {
    const backendStart = Date.now();
    const backendRes = await axios.get(`${config.djangoBackendUrl}/health/`, {
      timeout: 5000,
    });
    backendHealth = {
      status: backendRes.status === 200 ? 'up' : 'down',
      latency_ms: Date.now() - backendStart,
      last_checked: new Date().toISOString(),
    };
  } catch {
    backendHealth = {
      status: 'down',
      last_checked: new Date().toISOString(),
    };
  }

  // Check MCP server health
  let mcpHealth: ServiceHealth = { status: 'unknown' };
  try {
    const mcpStart = Date.now();
    const mcpRes = await axios.get(`${config.mcpServerUrl}/health`, {
      timeout: 5000,
    });
    mcpHealth = {
      status: mcpRes.status === 200 ? 'up' : 'down',
      latency_ms: Date.now() - mcpStart,
      last_checked: new Date().toISOString(),
    };
  } catch {
    mcpHealth = {
      status: 'down',
      last_checked: new Date().toISOString(),
    };
  }

  // WebSocket health
  const wsStats = wsManager ? wsManager.getStats() : null;
  const wsHealth: ServiceHealth = {
    status: wsManager ? 'up' : 'down',
    last_checked: new Date().toISOString(),
  };

  // Determine overall status
  const overallStatus =
    backendHealth.status === 'up'
      ? 'healthy'
      : backendHealth.status === 'down'
        ? 'degraded'
        : 'unhealthy';

  const healthResponse: HealthCheckResponse = {
    status: overallStatus,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      backend: backendHealth,
      mcp: mcpHealth,
      websocket: wsHealth,
    },
  };

  // Add WebSocket stats if available
  if (wsStats) {
    (healthResponse as any).websocket_stats = wsStats;
  }

  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(healthResponse);
});

// ============================================================
// API Routes
// ============================================================

app.use('/api/query', queryRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/mcp', mcpRoutes);

// Collection routes (also accessible directly)
app.use('/api/collections', documentRoutes);

// ============================================================
// Error Handling
// ============================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================
// HTTP Server & WebSocket
// ============================================================

const server = http.createServer(app);

let wsManager: WebSocketManager | null = null;

// Initialize WebSocket manager
wsManager = new WebSocketManager(server);

// ============================================================
// Server Startup
// ============================================================

server.listen(config.port, () => {
  logger.info(`API Gateway started`, {
    port: config.port,
    env: config.nodeEnv,
    backend: config.djangoBackendUrl,
    mcpServer: config.mcpServerUrl,
    corsOrigins: config.corsOrigins,
    rateLimit: `${config.rateLimit.max} requests per ${config.rateLimit.windowMs / 1000}s`,
  });
  logger.info(`Health check available at http://localhost:${config.port}/health`);
  logger.info(`WebSocket available at ws://localhost:${config.port}/ws`);
});

// ============================================================
// Graceful Shutdown
// ============================================================

function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close WebSocket connections
  if (wsManager) {
    wsManager.shutdown();
  }

  // Close HTTP server
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }

    logger.info('Server shut down gracefully');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

export { app, server, wsManager };
