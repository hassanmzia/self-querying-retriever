import { Router, Request, Response, NextFunction } from 'express';
import { forwardResponse, proxyRequest } from '../services/proxy';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';

const router = Router();

/**
 * GET /api/pipelines
 * List all pipelines with optional filtering by status.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing pipelines', {
      requestId: req.requestId,
      query: req.query,
    });

    await forwardResponse(req, res, '/api/v1/retriever/pipelines/', {
      params: {
        page: (req.query.page as string) || '1',
        page_size: (req.query.page_size as string) || '20',
        status: (req.query.status as string) || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pipelines
 * Create a new pipeline with defined steps.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, steps } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Pipeline name is required', 400, 'INVALID_PIPELINE');
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new AppError(
        'Pipeline must include at least one step',
        400,
        'INVALID_PIPELINE_STEPS'
      );
    }

    // Validate each step has required fields
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.name || !step.type) {
        throw new AppError(
          `Step at index ${i} must have "name" and "type" fields`,
          400,
          'INVALID_PIPELINE_STEP'
        );
      }
    }

    logger.info('Creating pipeline', {
      requestId: req.requestId,
      name,
      stepCount: steps.length,
    });

    const backendRes = await proxyRequest(req, '/api/v1/retriever/pipelines/', {
      method: 'POST',
      data: req.body,
    });

    res.status(backendRes.status).json({
      success: backendRes.status >= 200 && backendRes.status < 300,
      data: backendRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/retriever/pipelines/:id
 * Get pipeline details including steps and execution history.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.debug('Fetching pipeline details', {
      requestId: req.requestId,
      pipelineId: id,
    });

    await forwardResponse(req, res, `/api/v1/retriever/pipelines/${id}/`);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/retriever/pipelines/:id
 * Update an existing pipeline configuration.
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError('Update data is required', 400, 'EMPTY_UPDATE');
    }

    logger.info('Updating pipeline', {
      requestId: req.requestId,
      pipelineId: id,
      fields: Object.keys(req.body),
    });

    const backendRes = await proxyRequest(req, `/api/v1/retriever/pipelines/${id}/`, {
      method: 'PUT',
      data: req.body,
    });

    res.status(backendRes.status).json({
      success: backendRes.status >= 200 && backendRes.status < 300,
      data: backendRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/retriever/pipelines/:id/execute
 * Execute a pipeline. Accepts optional input parameters.
 */
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Executing pipeline', {
      requestId: req.requestId,
      pipelineId: id,
      hasInput: Object.keys(req.body || {}).length > 0,
    });

    const backendRes = await proxyRequest(req, `/api/v1/retriever/pipelines/${id}/execute/`, {
      method: 'POST',
      data: req.body || {},
    });

    res.status(backendRes.status).json({
      success: backendRes.status >= 200 && backendRes.status < 300,
      data: backendRes.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
