import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { forwardResponse, proxyRequest } from '../services/proxy';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import { QueryRequest, QueryCompareRequest, QueryExpandRequest } from '../types';

const router = Router();

/**
 * POST /api/query
 * Submit a query to the self-querying retriever.
 * Supports both standard JSON response and streaming via WebSocket.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryData: QueryRequest = req.body;

    if (!queryData.query || typeof queryData.query !== 'string' || queryData.query.trim() === '') {
      throw new AppError('Query text is required and must be a non-empty string', 400, 'INVALID_QUERY');
    }

    const queryId = uuidv4();

    logger.info('Processing query', {
      requestId: req.requestId,
      queryId,
      query: queryData.query.substring(0, 100),
      method: queryData.method || 'self_query',
      stream: queryData.stream || false,
    });

    // If streaming is requested, inform client to use WebSocket
    if (queryData.stream) {
      res.status(200).json({
        success: true,
        data: {
          queryId,
          message: 'Use WebSocket connection at /ws to receive streaming results',
          wsMessage: {
            type: 'query',
            payload: {
              queryId,
              query: queryData.query,
              collection: queryData.collection,
              method: queryData.method,
            },
          },
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Standard non-streaming request: proxy to Django backend
    // Map frontend field names to backend field names
    const options = (queryData as any).options || {};
    const augmentations: string[] = options.augmentations || [];
    const frontendFilters = (queryData as any).filters;

    // Convert filters from array [{field, operator, value}] to dict {field: value}
    let backendFilters: Record<string, unknown> = {};
    if (Array.isArray(frontendFilters)) {
      for (const f of frontendFilters) {
        if (f && f.field && f.value !== undefined) {
          backendFilters[f.field] = f.value;
        }
      }
    } else if (frontendFilters && typeof frontendFilters === 'object') {
      backendFilters = frontendFilters;
    }

    // Map frontend RetrievalMethod enum values to backend choices
    // Frontend: "vector" | "self_query" | "bm25" | "hybrid" | "hypothetical"
    // Backend:  "vanilla" | "self_query" | "bm25" | "hybrid" | "hypothetical" | "reranked" | "compressed" | "expanded"
    const methodMap: Record<string, string> = {
      vector: 'vanilla',
      VECTOR: 'vanilla',
    };
    const rawMethod = (queryData as any).retrieval_method || (queryData as any).method || 'hybrid';
    const retrieval_method = methodMap[rawMethod] || rawMethod;

    const backendPayload = {
      query: queryData.query,
      retrieval_method,
      collection_name: (queryData as any).collection_id || (queryData as any).collection || 'renewable_energy',
      top_k: options.top_k || (queryData as any).top_k || 5,
      use_reranking: augmentations.includes('reranking') || (queryData as any).rerank || false,
      use_compression: augmentations.includes('context_compression') || false,
      use_query_expansion: augmentations.includes('query_expansion') || false,
      filters: backendFilters,
    };

    const backendRes = await proxyRequest(req, '/api/v1/retriever/query/', {
      method: 'POST',
      data: backendPayload,
    });

    // Map backend response to frontend QueryResponse format
    // Backend results: { document_id, content, metadata, score }
    // Frontend results: { id, document: { id, content, metadata, collection_id }, score, retrieval_method }
    const reverseMethodMap: Record<string, string> = { vanilla: 'vector' };
    const bd = backendRes.data || {};
    const rawResults = bd.results || [];
    const mappedMethod = reverseMethodMap[bd.pipeline_used] || bd.pipeline_used || rawMethod;
    const collectionId = (queryData as any).collection_id || backendPayload.collection_name;

    const results = rawResults.map((r: any, idx: number) => ({
      id: r.document_id || r.id || `result-${idx}`,
      document: {
        id: r.document_id || r.id || `doc-${idx}`,
        content: r.content || r.document || '',
        metadata: r.metadata || {},
        collection_id: collectionId,
      },
      score: r.score ?? 0,
      retrieval_method: mappedMethod,
      highlights: r.highlights || [],
    }));

    const frontendResponse = {
      query_id: bd.query_id,
      query: bd.query,
      results,
      total_results: results.length,
      retrieval_method: mappedMethod,
      execution_time_ms: bd.execution_time_ms || 0,
      agent_trace: bd.agent_trace,
      metadata: {
        collection_id: collectionId,
        model_used: 'text-embedding-3-small',
        tokens_used: 0,
        cached: false,
      },
    };

    res.status(backendRes.status).json({
      data: frontendResponse,
      status: backendRes.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/query/history
 * Retrieve query history with optional pagination and filtering.
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Fetching query history', {
      requestId: req.requestId,
      query: req.query,
    });

    const page = parseInt((req.query.page as string) || '1', 10);
    const pageSize = parseInt((req.query.page_size as string) || '20', 10);

    const backendRes = await proxyRequest(req, '/api/v1/retriever/queries/', {
      method: 'GET',
      params: {
        page: String(page),
        page_size: String(pageSize),
        method: (req.query.method as string) || '',
        date_from: (req.query.date_from as string) || '',
        date_to: (req.query.date_to as string) || '',
      },
    });

    // Map backend pagination to frontend PaginatedResponse<QueryHistoryItem>
    // Backend uses FrontendPagination: { data: [...], total, page, page_size, total_pages }
    // Also handle DRF default: { count, next, previous, results: [...] }
    const body = backendRes.data || {};
    const results = body.data ?? body.results ?? (Array.isArray(body) ? body : []);
    const total = body.total ?? body.count ?? (Array.isArray(results) ? results.length : 0);

    const items = (Array.isArray(results) ? results : []).map((q: any) => ({
      id: q.id,
      query: q.query_text || q.query || '',
      retrieval_method: q.retrieval_method || 'hybrid',
      collection_id: q.collection_name || q.collection_id || '',
      result_count: q.results_count ?? q.result_count ?? 0,
      execution_time_ms: q.execution_time_ms || 0,
      created_at: q.created_at || '',
      augmentations: q.augmentations || [],
    }));

    res.status(backendRes.status).json({
      data: items,
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/query/:id
 * Get a specific query result by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError('Query ID is required', 400, 'MISSING_QUERY_ID');
    }

    logger.debug('Fetching query result', {
      requestId: req.requestId,
      queryId: id,
    });

    await forwardResponse(req, res, `/api/v1/retriever/queries/${id}/`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/query/expand
 * Expand a query into multiple related queries for better retrieval.
 */
router.post('/expand', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expandData: QueryExpandRequest = req.body;

    if (!expandData.query || typeof expandData.query !== 'string') {
      throw new AppError('Query text is required for expansion', 400, 'INVALID_QUERY');
    }

    logger.info('Expanding query', {
      requestId: req.requestId,
      query: expandData.query.substring(0, 100),
      numExpansions: expandData.num_expansions,
    });

    const backendRes = await proxyRequest(req, '/api/v1/retriever/query/expand/', {
      method: 'POST',
      data: expandData,
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
 * POST /api/query/compare
 * Compare results across multiple retrieval methods.
 */
router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const compareData: QueryCompareRequest = req.body;

    if (!compareData.query || typeof compareData.query !== 'string') {
      throw new AppError('Query text is required for comparison', 400, 'INVALID_QUERY');
    }

    if (!compareData.methods || !Array.isArray(compareData.methods) || compareData.methods.length < 2) {
      throw new AppError('At least 2 retrieval methods are required for comparison', 400, 'INVALID_METHODS');
    }

    logger.info('Comparing retrieval methods', {
      requestId: req.requestId,
      query: compareData.query.substring(0, 100),
      methods: compareData.methods,
    });

    const backendRes = await proxyRequest(req, '/api/v1/retriever/query/compare/', {
      method: 'POST',
      data: compareData,
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
