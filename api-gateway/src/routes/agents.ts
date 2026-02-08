import { Router, Request, Response, NextFunction } from 'express';
import { forwardResponse, proxyRequest } from '../services/proxy';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';

const router = Router();

/**
 * GET /api/agents
 * List all available agents from the A2A (Agent-to-Agent) system.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing agents', { requestId: req.requestId });

    await forwardResponse(req, res, '/api/v1/retriever/agents/');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/graph
 * Get the LangGraph visualization in Mermaid format.
 * Returns the full graph structure with nodes and edges.
 */
router.get('/graph', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Fetching agent graph', { requestId: req.requestId });

    await forwardResponse(req, res, '/api/v1/retriever/agent-executions/graph/', {
      params: {
        format: (req.query.format as string) || 'mermaid',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/graph/image
 * Get the LangGraph visualization as a rendered image.
 * Returns PNG or SVG depending on query parameter.
 */
router.get('/graph/image', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'png';

    logger.debug('Fetching agent graph image', {
      requestId: req.requestId,
      format,
    });

    const backendRes = await proxyRequest(req, '/api/v1/retriever/agent-executions/graph/image/', {
      params: { format },
      responseType: 'arraybuffer',
    });

    const contentType = format === 'svg' ? 'image/svg+xml' : 'image/png';
    res.setHeader('Content-Type', contentType);
    res.status(backendRes.status).send(backendRes.data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/executions
 * List agent executions with optional pagination and filtering.
 */
router.get('/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing agent executions', {
      requestId: req.requestId,
      query: req.query,
    });

    await forwardResponse(req, res, '/api/v1/retriever/agent-executions/', {
      params: {
        page: (req.query.page as string) || '1',
        page_size: (req.query.page_size as string) || '20',
        status: (req.query.status as string) || '',
        agent_name: (req.query.agent_name as string) || '',
        date_from: (req.query.date_from as string) || '',
        date_to: (req.query.date_to as string) || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/executions/:id
 * Get detailed information about a specific agent execution, including steps.
 */
router.get('/executions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.debug('Fetching execution details', {
      requestId: req.requestId,
      executionId: id,
    });

    await forwardResponse(req, res, `/api/v1/retriever/agent-executions/${id}/`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/agents/:name
 * Get details about a specific agent by name.
 * Must be placed after other specific routes to avoid matching "graph" or "executions".
 */
router.get('/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;

    // Guard against matching other route segments
    if (name === 'graph' || name === 'executions') {
      next();
      return;
    }

    if (!name || name.trim() === '') {
      throw new AppError('Agent name is required', 400, 'MISSING_AGENT_NAME');
    }

    logger.debug('Fetching agent details', {
      requestId: req.requestId,
      agentName: name,
    });

    await forwardResponse(req, res, `/api/v1/retriever/agent-executions/${encodeURIComponent(name)}/`);
  } catch (error) {
    next(error);
  }
});

export default router;
