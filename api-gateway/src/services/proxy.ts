import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response } from 'express';
import { ClientRequest, IncomingMessage, ServerResponse } from 'http';
import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import config from '../config';
import logger from '../utils/logger';

/**
 * Create an http-proxy-middleware instance that forwards requests
 * to the Django backend.
 */
export function createBackendProxy(pathPrefix?: string): ReturnType<typeof createProxyMiddleware> {
  const proxyOptions: Options = {
    target: config.djangoBackendUrl,
    changeOrigin: true,
    pathRewrite: pathPrefix
      ? { [`^${pathPrefix}`]: pathPrefix }
      : undefined,
    timeout: config.proxyTimeout,
    proxyTimeout: config.proxyTimeout,
    onProxyReq: (proxyReq: ClientRequest, req: IncomingMessage) => {
      const expressReq = req as Request;
      // Forward the request ID for traceability
      if (expressReq.requestId) {
        proxyReq.setHeader('X-Request-ID', expressReq.requestId);
      }

      // Forward the original client IP
      const clientIp = expressReq.ip || expressReq.socket.remoteAddress;
      if (clientIp) {
        proxyReq.setHeader('X-Forwarded-For', clientIp);
      }

      logger.debug('Proxying request to backend', {
        requestId: expressReq.requestId,
        method: proxyReq.method,
        path: proxyReq.path,
        target: config.djangoBackendUrl,
      });
    },
    onProxyRes: (proxyRes: IncomingMessage, req: IncomingMessage) => {
      const expressReq = req as Request;
      logger.debug('Received response from backend', {
        requestId: expressReq.requestId,
        statusCode: proxyRes.statusCode,
      });
    },
    onError: (err: Error, req: IncomingMessage, res: ServerResponse) => {
      const expressReq = req as Request;
      logger.error('Proxy error', {
        requestId: expressReq.requestId,
        error: err.message,
        code: (err as any).code,
        target: config.djangoBackendUrl,
      });

      // Only send response if headers haven't been sent
      if (res && !res.headersSent) {
        const statusCode = (err as any).code === 'ECONNREFUSED' ? 503 : 502;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: false,
            error:
              statusCode === 503
                ? 'Backend service is unavailable'
                : 'Bad gateway - error communicating with backend',
            timestamp: new Date().toISOString(),
          })
        );
      }
    },
  };

  return createProxyMiddleware(proxyOptions);
}

/**
 * Manually proxy a request to the Django backend with full error handling.
 * Useful when you need to transform the request or response before forwarding.
 */
export async function proxyRequest(
  req: Request,
  endpoint: string,
  options: {
    method?: Method;
    data?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
    responseType?: AxiosRequestConfig['responseType'];
  } = {}
): Promise<AxiosResponse> {
  const url = `${config.djangoBackendUrl}${endpoint}`;
  const method = options.method || (req.method as Method);

  const axiosConfig: AxiosRequestConfig = {
    url,
    method,
    data: options.data !== undefined ? options.data : req.body,
    params: options.params || req.query,
    timeout: options.timeout || config.proxyTimeout,
    responseType: options.responseType || 'json',
    headers: {
      'Content-Type': req.get('content-type') || 'application/json',
      'X-Request-ID': req.requestId || '',
      'X-Forwarded-For': req.ip || '',
      ...(options.headers || {}),
    },
    // Do not throw on non-2xx to let caller handle status codes
    validateStatus: () => true,
  };

  logger.debug('Proxying request manually', {
    requestId: req.requestId,
    method,
    url,
  });

  try {
    const response = await axios(axiosConfig);

    logger.debug('Backend response received', {
      requestId: req.requestId,
      status: response.status,
      url,
    });

    return response;
  } catch (error: any) {
    logger.error('Backend request failed', {
      requestId: req.requestId,
      url,
      error: error.message,
      code: error.code,
    });
    throw error;
  }
}

/**
 * Helper to forward the backend response directly to the client.
 */
export async function forwardResponse(
  req: Request,
  res: Response,
  endpoint: string,
  options: {
    method?: Method;
    data?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<void> {
  try {
    const backendRes = await proxyRequest(req, endpoint, options);

    // Forward specific response headers from backend
    const headersToForward = ['content-type', 'content-disposition', 'x-total-count'];
    for (const header of headersToForward) {
      const value = backendRes.headers[header];
      if (value) {
        res.setHeader(header, value);
      }
    }

    res.status(backendRes.status).json(backendRes.data);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'Backend service is unavailable',
        timestamp: new Date().toISOString(),
      });
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      res.status(504).json({
        success: false,
        error: 'Backend service timed out',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(502).json({
        success: false,
        error: 'Error communicating with backend service',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default { createBackendProxy, proxyRequest, forwardResponse };
