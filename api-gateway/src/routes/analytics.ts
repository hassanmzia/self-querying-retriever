import { Router, Request, Response, NextFunction } from 'express';
import { forwardResponse, proxyRequest } from '../services/proxy';
import logger from '../utils/logger';
import { AppError } from '../middleware/error-handler';

const router = Router();

/**
 * GET /api/v1/analytics/dashboard
 * Get dashboard statistics: total queries, documents, collections,
 * average processing time, recent activity, and top methods.
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Fetching dashboard stats', { requestId: req.requestId });

    await forwardResponse(req, res, '/api/v1/analytics/dashboard/');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/trends
 * Get query trends over time.
 * Query parameters: period (day|week|month), date_from, date_to
 */
router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Fetching query trends', {
      requestId: req.requestId,
      period: req.query.period,
    });

    await forwardResponse(req, res, '/api/v1/analytics/trends/', {
      params: {
        period: (req.query.period as string) || 'day',
        date_from: (req.query.date_from as string) || '',
        date_to: (req.query.date_to as string) || '',
        method: (req.query.method as string) || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/methods
 * Compare performance and usage across retrieval methods.
 */
router.get('/methods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.debug('Fetching method comparison', { requestId: req.requestId });

    await forwardResponse(req, res, '/api/v1/analytics/methods/', {
      params: {
        date_from: (req.query.date_from as string) || '',
        date_to: (req.query.date_to as string) || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/analytics/export
 * Export analytics data in CSV or JSON format.
 * Query parameters: format (csv|json), type (queries|documents|analytics),
 * date_from, date_to
 */
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'json';
    const exportType = (req.query.type as string) || 'queries';

    if (!['csv', 'json'].includes(format)) {
      throw new AppError(
        'Export format must be "csv" or "json"',
        400,
        'INVALID_EXPORT_FORMAT'
      );
    }

    if (!['queries', 'documents', 'analytics'].includes(exportType)) {
      throw new AppError(
        'Export type must be "queries", "documents", or "analytics"',
        400,
        'INVALID_EXPORT_TYPE'
      );
    }

    logger.info('Exporting analytics data', {
      requestId: req.requestId,
      format,
      type: exportType,
    });

    const backendRes = await proxyRequest(req, '/api/v1/analytics/export/', {
      params: {
        format,
        type: exportType,
        date_from: (req.query.date_from as string) || '',
        date_to: (req.query.date_to as string) || '',
      },
      responseType: format === 'csv' ? 'arraybuffer' : 'json',
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exportType}_export_${new Date().toISOString().split('T')[0]}.csv"`
      );
      res.status(backendRes.status).send(backendRes.data);
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

export default router;
