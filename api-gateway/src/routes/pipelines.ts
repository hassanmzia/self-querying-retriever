import { Router, Request, Response, NextFunction } from 'express';
import { proxyRequest } from '../services/proxy';
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

    const backendRes = await proxyRequest(req, '/api/v1/retriever/pipelines/', {
      method: 'GET',
      params: {
        page: (req.query.page as string) || '1',
        page_size: (req.query.page_size as string) || '20',
        status: (req.query.status as string) || '',
      },
    });

    // Map backend pipeline objects to frontend PipelineConfig format
    const results = backendRes.data?.results || backendRes.data || [];
    const pipelines = (Array.isArray(results) ? results : []).map((p: any) => {
      const config = p.pipeline_config || {};
      return {
        ...p,
        stages: config.stages || [],
        default_retrieval_method: config.retrieval_method || 'hybrid',
        default_collection_id: config.collection_name || '',
        updated_at: p.updated_at || p.created_at || '',
      };
    });

    res.status(backendRes.status).json({
      data: pipelines,
      total: backendRes.data?.count || pipelines.length,
      page: parseInt((req.query.page as string) || '1', 10),
      page_size: parseInt((req.query.page_size as string) || '20', 10),
      total_pages: Math.ceil((backendRes.data?.count || pipelines.length) / parseInt((req.query.page_size as string) || '20', 10)),
      status: backendRes.status,
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
    const body = req.body || {};
    const name = body.name;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new AppError('Pipeline name is required', 400, 'INVALID_PIPELINE');
    }

    // Frontend sends "stages", accept "steps" as well for flexibility
    const stages = body.stages || body.steps || [];

    // Map frontend PipelineConfig to backend RetrievalPipelineSerializer format
    // Backend expects: { name, description, pipeline_config: {...}, is_active }
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

    // Map backend response back to frontend PipelineConfig format
    const pipelineData = backendRes.data;
    const config = pipelineData.pipeline_config || {};
    const frontendData = {
      ...pipelineData,
      stages: config.stages || [],
      default_retrieval_method: config.retrieval_method || 'hybrid',
      default_collection_id: config.collection_name || '',
      updated_at: pipelineData.created_at || new Date().toISOString(),
    };

    res.status(backendRes.status).json({
      data: frontendData,
      status: backendRes.status,
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

    const backendRes = await proxyRequest(req, `/api/v1/retriever/pipelines/${id}/`, {
      method: 'GET',
    });

    const pipelineData = backendRes.data;
    const config = pipelineData.pipeline_config || {};
    const frontendData = {
      ...pipelineData,
      stages: config.stages || [],
      default_retrieval_method: config.retrieval_method || 'hybrid',
      default_collection_id: config.collection_name || '',
      updated_at: pipelineData.created_at || new Date().toISOString(),
    };

    res.status(backendRes.status).json({
      data: frontendData,
      status: backendRes.status,
    });
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

    // Build pipeline_config from frontend fields if stages or retrieval fields are present
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

    const pipelineData = backendRes.data;
    const config = pipelineData.pipeline_config || {};
    const frontendData = {
      ...pipelineData,
      stages: config.stages || [],
      default_retrieval_method: config.retrieval_method || 'hybrid',
      default_collection_id: config.collection_name || '',
      updated_at: pipelineData.created_at || new Date().toISOString(),
    };

    res.status(backendRes.status).json({
      data: frontendData,
      status: backendRes.status,
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
