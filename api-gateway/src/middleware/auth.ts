import { Request, Response, NextFunction } from 'express';
import config from '../config';
import logger from '../utils/logger';

/**
 * API Key authentication middleware.
 * Checks for a valid API key in the configured header.
 * If no API keys are configured, authentication is bypassed (development mode).
 *
 * Placeholder: JWT-based authentication can replace or supplement API key auth
 * by decoding and verifying a Bearer token from the Authorization header.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health check endpoint
  if (req.path === '/health' || req.path === '/health/') {
    next();
    return;
  }

  // If no API keys configured, bypass authentication (development mode)
  if (config.apiKeys.length === 0) {
    logger.debug('No API keys configured - authentication bypassed');
    next();
    return;
  }

  const apiKey = req.headers[config.apiKeyHeader] as string | undefined;

  if (!apiKey) {
    logger.warn('Request missing API key', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(401).json({
      success: false,
      error: 'Authentication required. Provide a valid API key.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!config.apiKeys.includes(apiKey)) {
    logger.warn('Invalid API key used', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      keyPrefix: apiKey.substring(0, 8) + '...',
    });
    res.status(403).json({
      success: false,
      error: 'Invalid API key.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  logger.debug('API key authenticated', { path: req.path });
  next();
}

/**
 * Placeholder for JWT authentication middleware.
 * When implemented, this will:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify the JWT signature against a secret/public key
 * 3. Decode and attach user information to req.user
 * 4. Check token expiration
 */
export function jwtAuth(_req: Request, res: Response, next: NextFunction): void {
  // TODO: Implement JWT authentication
  // const authHeader = req.headers.authorization;
  // if (!authHeader || !authHeader.startsWith('Bearer ')) {
  //   return res.status(401).json({ error: 'Bearer token required' });
  // }
  // const token = authHeader.split(' ')[1];
  // try {
  //   const decoded = jwt.verify(token, config.jwtSecret);
  //   (req as any).user = decoded;
  //   next();
  // } catch (err) {
  //   return res.status(401).json({ error: 'Invalid or expired token' });
  // }

  // For now, pass through
  next();
}

/**
 * Optional auth - does not reject unauthenticated requests
 * but attaches auth info if present.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers[config.apiKeyHeader] as string | undefined;

  if (apiKey && config.apiKeys.includes(apiKey)) {
    (req as any).authenticated = true;
  } else {
    (req as any).authenticated = false;
  }

  next();
}

export default apiKeyAuth;
