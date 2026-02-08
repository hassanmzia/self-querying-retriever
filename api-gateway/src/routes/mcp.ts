import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { MCPToolExecutionRequest } from '../types';

const router = Router();

/**
 * Helper to make requests to the MCP server.
 */
async function mcpRequest(
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
  requestId?: string
) {
  const url = `${config.mcpServerUrl}${path}`;

  logger.debug('MCP server request', { method, url, requestId });

  try {
    const response = await axios({
      method,
      url,
      data,
      timeout: config.proxyTimeout,
      headers: {
        'Content-Type': 'application/json',
        ...(requestId ? { 'X-Request-ID': requestId } : {}),
      },
      validateStatus: () => true,
    });

    return response;
  } catch (error: any) {
    logger.error('MCP server request failed', {
      url,
      error: error.message,
      code: error.code,
      requestId,
    });
    throw error;
  }
}

/**
 * GET /api/mcp/tools
 * List all available MCP tools.
 */
router.get('/tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing MCP tools', { requestId: req.requestId });

    const mcpRes = await mcpRequest('GET', '/tools', undefined, req.requestId);

    res.status(mcpRes.status).json({
      success: mcpRes.status >= 200 && mcpRes.status < 300,
      data: mcpRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'MCP server is unavailable',
        timestamp: new Date().toISOString(),
      });
    } else {
      next(error);
    }
  }
});

/**
 * POST /api/mcp/tools/:toolName
 * Execute a specific MCP tool by name.
 */
router.post('/tools/:toolName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toolName } = req.params;
    const body: MCPToolExecutionRequest = req.body;

    if (!toolName || toolName.trim() === '') {
      throw new AppError('Tool name is required', 400, 'MISSING_TOOL_NAME');
    }

    logger.info('Executing MCP tool', {
      requestId: req.requestId,
      toolName,
      hasArguments: body.arguments ? Object.keys(body.arguments).length > 0 : false,
    });

    const mcpRes = await mcpRequest(
      'POST',
      `/tools/${encodeURIComponent(toolName)}`,
      {
        arguments: body.arguments || {},
      },
      req.requestId
    );

    res.status(mcpRes.status).json({
      success: mcpRes.status >= 200 && mcpRes.status < 300,
      data: mcpRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'MCP server is unavailable',
        timestamp: new Date().toISOString(),
      });
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/mcp/resources
 * List all available MCP resources.
 */
router.get('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing MCP resources', { requestId: req.requestId });

    const mcpRes = await mcpRequest('GET', '/resources', undefined, req.requestId);

    res.status(mcpRes.status).json({
      success: mcpRes.status >= 200 && mcpRes.status < 300,
      data: mcpRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'MCP server is unavailable',
        timestamp: new Date().toISOString(),
      });
    } else {
      next(error);
    }
  }
});

/**
 * GET /api/mcp/resources/:uri
 * Get a specific MCP resource by URI.
 * The URI parameter is URL-encoded in the path.
 */
router.get('/resources/:uri', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uri } = req.params;

    if (!uri || uri.trim() === '') {
      throw new AppError('Resource URI is required', 400, 'MISSING_RESOURCE_URI');
    }

    const decodedUri = decodeURIComponent(uri);

    logger.debug('Fetching MCP resource', {
      requestId: req.requestId,
      uri: decodedUri,
    });

    const mcpRes = await mcpRequest(
      'GET',
      `/resources/${encodeURIComponent(decodedUri)}`,
      undefined,
      req.requestId
    );

    res.status(mcpRes.status).json({
      success: mcpRes.status >= 200 && mcpRes.status < 300,
      data: mcpRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'MCP server is unavailable',
        timestamp: new Date().toISOString(),
      });
    } else {
      next(error);
    }
  }
});

export default router;
