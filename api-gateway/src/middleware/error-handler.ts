import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ApiResponse } from '../types';

/**
 * Custom application error class with HTTP status code support.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number = 500, code?: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code || this.deriveCode(status);
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  private deriveCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      405: 'METHOD_NOT_ALLOWED',
      408: 'REQUEST_TIMEOUT',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };
    return codeMap[status] || 'UNKNOWN_ERROR';
  }
}

/**
 * Global error handling middleware.
 * Catches all errors and returns a consistent JSON response.
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  } else if ((err as any).code === 'ECONNREFUSED') {
    status = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'Backend service is unavailable';
  } else if ((err as any).code === 'ECONNRESET' || (err as any).code === 'ETIMEDOUT') {
    status = 504;
    code = 'GATEWAY_TIMEOUT';
    message = 'Backend service timed out';
  }

  // Log the error with context
  const logData = {
    status,
    code,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };

  if (status >= 500) {
    logger.error(`Server Error: ${message}`, { ...logData, stack: err.stack });
  } else if (status >= 400) {
    logger.warn(`Client Error: ${message}`, logData);
  }

  const response: ApiResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Include error code in response
  (response as any).code = code;

  // Include details in non-production environments
  if (details && process.env.NODE_ENV !== 'production') {
    (response as any).details = details;
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    (response as any).stack = err.stack;
  }

  res.status(status).json(response);
}

/**
 * 404 Not Found handler for unmatched routes.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const error = new AppError(
    `Route not found: ${req.method} ${req.originalUrl}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
}

export default errorHandler;
