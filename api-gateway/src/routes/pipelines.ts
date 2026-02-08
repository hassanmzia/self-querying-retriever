import { Router, Request, Response, NextFunction } from 'express';
import { proxyRequest } from '../services/proxy';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';

const router = Router();

/**
 * Map a backend RetrievalPipeline object to the frontend Pipeline interface.
 *
 * Backend shape:  { id, name, description, pipeline_config, is_active, created_at }
 * Frontend shape: { id, name, config: PipelineConfig, status, executions_count, avg_execution_time_ms, created_at, updated_at }
 */
function toFrontendPipeline(p: any): any {
  const cfg = p.pipeline_config || {};
  return {
    id: p.id,
    name: p.name,
    config: {
      id: p.id,
      name: p.name,
      description: p.description || '',
      stages: cfg.stages || [],
      default_retrieval_method: cfg.retrieval_method || 'hybrid',
      default_collection_id: cfg.collection_name || '',
      created_at: p.created_at || '',
      updated_at: p.updated_at || p.created_at || '',
      is_active: p.is_active !== undefined ? p.is_active : true,
    },
    status: p.is_active ? 'active' : 'inactive',
    executions_count: p.executions_count || 0,
    avg_execution_time_ms: p.avg_execution_time_ms || 0,
    created_at: p.created_at || '',
    updated_at: p.updated_at || p.created_at || '',
  };
}

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

    const backendRes = await proxyRequest(req, '/api/v1/retriever/pipelines/', {
      method: 'GET',
      params: {
        page: (req.query.page as string) || '1',
        page_size: (req.query.page_size as string) || '20',
        status: (req.query.status as string) || '',
      },
    });

    const results = backendRes.data?.results || backendRes.data || [];
    const pipelines = (Array.isArray(results) ? results : []).map(toFrontendPipeline);

    res.status(backendRes.status).json({
      data: pipelines,
      status: backendRes.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pipelines
 * Create a new pipeline. Frontend sends Partial<PipelineConfig>.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const name = body.name;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Pipeline name is required', 400, 'INVALID_PIPELINE');
    }

    // Frontend sends "stages", accept "steps" as well for flexibility
    const stages = body.stages || body.steps || [];

    // Map frontend PipelineConfig to backend RetrievalPipelineSerializer format
    const backendPayload: Record<string, unknown> = {
      name: name.trim(),
      description: body.description || `${name.trim()} pipeline`,
      pipeline_config: {
        retrieval_method: body.default_retrieval_method || 'hybrid',
        collection_name: body.default_collection_id || 'renewable_energy',
        stages,
      },
      is_active: body.is_active !== undefined ? body.is_active : true,
    };

    logger.info('Creating pipeline', {
      requestId: req.requestId,
      name,
      stageCount: stages.length,
    });

    const backendRes = await proxyRequest(req, '/api/v1/retriever/pipelines/', {
      method: 'POST',
      data: backendPayload,
    });

    res.status(backendRes.status).json({
      data: toFrontendPipeline(backendRes.data),
      status: backendRes.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/pipelines/:id
 * Get pipeline details.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.debug('Fetching pipeline details', {
      requestId: req.requestId,
      pipelineId: id,
    });

    const backendRes = await proxyRequest(req, `/api/v1/retriever/pipelines/${id}/`, {
      method: 'GET',
    });

    res.status(backendRes.status).json({
      data: toFrontendPipeline(backendRes.data),
      status: backendRes.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/pipelines/:id
 * Update an existing pipeline configuration.
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (Object.keys(body).length === 0) {
      throw new AppError('Update data is required', 400, 'EMPTY_UPDATE');
    }

    // Map frontend fields to backend format
    const stages = body.stages || body.steps;
    const backendPayload: Record<string, unknown> = {};
    if (body.name) backendPayload.name = body.name;
    if (body.description !== undefined) backendPayload.description = body.description;
    if (body.is_active !== undefined) backendPayload.is_active = body.is_active;

    if (stages || body.default_retrieval_method || body.default_collection_id) {
      backendPayload.pipeline_config = {
        retrieval_method: body.default_retrieval_method || 'hybrid',
        collection_name: body.default_collection_id || 'renewable_energy',
        stages: stages || [],
      };
    }

    logger.info('Updating pipeline', {
      requestId: req.requestId,
      pipelineId: id,
      fields: Object.keys(backendPayload),
    });

    const backendRes = await proxyRequest(req, `/api/v1/retriever/pipelines/${id}/`, {
      method: 'PUT',
      data: backendPayload,
    });

    res.status(backendRes.status).json({
      data: toFrontendPipeline(backendRes.data),
      status: backendRes.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/pipelines/:id/execute
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
      data: backendRes.data,
      status: backendRes.status,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
