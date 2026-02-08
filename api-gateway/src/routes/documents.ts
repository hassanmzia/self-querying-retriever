import { Router, Request, Response, NextFunction } from 'express';
import { forwardResponse, proxyRequest } from '../services/proxy';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';

const router = Router();

// ============================================================
// Document Routes
// ============================================================

/**
 * GET /api/documents
 * List all documents with optional pagination and filtering.
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing documents', {
      requestId: req.requestId,
      query: req.query,
    });

    await forwardResponse(req, res, '/api/documents/', {
      params: {
        page: (req.query.page as string) || '1',
        page_size: (req.query.page_size as string) || '20',
        collection: (req.query.collection as string) || '',
        search: (req.query.search as string) || '',
        sort: (req.query.sort as string) || '-created_at',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents
 * Upload a single document.
 * Accepts JSON body with content/metadata or multipart form data with file.
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contentType = req.get('content-type') || '';

    logger.info('Uploading document', {
      requestId: req.requestId,
      contentType,
      title: req.body?.title,
    });

    if (contentType.includes('multipart/form-data')) {
      // For file uploads, proxy the raw request directly
      await forwardResponse(req, res, '/api/documents/', {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
      });
    } else {
      // JSON body upload
      if (!req.body?.content && !req.body?.title) {
        throw new AppError(
          'Document must include at least a title or content',
          400,
          'INVALID_DOCUMENT'
        );
      }

      const backendRes = await proxyRequest(req, '/api/documents/', {
        method: 'POST',
        data: req.body,
      });

      res.status(backendRes.status).json({
        success: backendRes.status >= 200 && backendRes.status < 300,
        data: backendRes.data,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/documents/:id
 * Get a specific document by ID.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.debug('Fetching document', {
      requestId: req.requestId,
      documentId: id,
    });

    await forwardResponse(req, res, `/api/documents/${id}/`);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/documents/:id
 * Update an existing document.
 */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.body || Object.keys(req.body).length === 0) {
      throw new AppError('Update data is required', 400, 'EMPTY_UPDATE');
    }

    logger.info('Updating document', {
      requestId: req.requestId,
      documentId: id,
      fields: Object.keys(req.body),
    });

    const backendRes = await proxyRequest(req, `/api/documents/${id}/`, {
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
 * DELETE /api/documents/:id
 * Delete a document.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.info('Deleting document', {
      requestId: req.requestId,
      documentId: id,
    });

    const backendRes = await proxyRequest(req, `/api/documents/${id}/`, {
      method: 'DELETE',
    });

    if (backendRes.status === 204) {
      res.status(204).send();
    } else {
      res.status(backendRes.status).json({
        success: backendRes.status >= 200 && backendRes.status < 300,
        data: backendRes.data,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/documents/bulk
 * Bulk upload multiple documents at once.
 */
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      throw new AppError(
        'Request body must include a non-empty "documents" array',
        400,
        'INVALID_BULK_UPLOAD'
      );
    }

    logger.info('Bulk uploading documents', {
      requestId: req.requestId,
      count: documents.length,
    });

    const backendRes = await proxyRequest(req, '/api/documents/bulk/', {
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

// ============================================================
// Collection Routes (mounted under /api/documents parent)
// These are also available via /api/collections in index.ts
// ============================================================

/**
 * GET /api/collections
 * List all document collections.
 */
router.get('/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Listing collections', { requestId: req.requestId });

    await forwardResponse(req, res, '/api/collections/', {
      params: {
        page: (req.query.page as string) || '1',
        page_size: (req.query.page_size as string) || '50',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/collections
 * Create a new document collection.
 */
router.post('/collections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.body?.name || typeof req.body.name !== 'string') {
      throw new AppError('Collection name is required', 400, 'INVALID_COLLECTION');
    }

    logger.info('Creating collection', {
      requestId: req.requestId,
      name: req.body.name,
    });

    const backendRes = await proxyRequest(req, '/api/collections/', {
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
 * GET /api/collections/:id
 * Get collection details including document count and metadata.
 */
router.get('/collections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    logger.debug('Fetching collection details', {
      requestId: req.requestId,
      collectionId: id,
    });

    await forwardResponse(req, res, `/api/collections/${id}/`);
  } catch (error) {
    next(error);
  }
});

export default router;
