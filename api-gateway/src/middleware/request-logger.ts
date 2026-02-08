import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * Augment Express Request to carry a correlation ID.
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request/response logging middleware.
 * Assigns a unique request ID to each request, logs the incoming request,
 * and logs the outgoing response with timing information.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Assign a unique request ID (accept from upstream if present)
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Set the request ID on the response headers
  res.setHeader('X-Request-ID', requestId);

  // Log the incoming request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentLength: req.get('content-length'),
    contentType: req.get('content-type'),
  });

  // Capture the original end method to intercept response completion
  const originalEnd = res.end;
  let responseBody: string | undefined;

  // Override res.end to capture response details
  const wrappedEnd = function (this: Response, ...args: any[]): Response {
    const chunk = args[0];

    // Capture small response bodies for logging in development
    if (chunk && process.env.NODE_ENV === 'development') {
      try {
        const body = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
        if (body.length < 1000) {
          responseBody = body;
        }
      } catch {
        // Ignore encoding errors
      }
    }

    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const statusCode = res.statusCode;

    // Determine log level based on status code
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    const logData: Record<string, unknown> = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    };

    // Include response body snippet in development for error responses
    if (process.env.NODE_ENV === 'development' && statusCode >= 400 && responseBody) {
      try {
        logData.responseBody = JSON.parse(responseBody);
      } catch {
        logData.responseBody = responseBody.substring(0, 200);
      }
    }

    logger.log(logLevel, 'Request completed', logData);

    // Call original end with all original arguments
    return originalEnd.apply(this, args as any);
  };
  res.end = wrappedEnd as any;

  next();
}

export default requestLogger;
