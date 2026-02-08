/**
 * Axios HTTP client pre-configured to talk to the Django backend.
 *
 * Every outbound request includes a timeout, JSON content-type header,
 * and structured request/response logging via Winston.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import config from "../config.js";
import logger from "./logger.js";

const apiClient: AxiosInstance = axios.create({
  baseURL: config.djangoBackendUrl,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// ---------------------------------------------------------------------------
// Request interceptor -- log outgoing calls
// ---------------------------------------------------------------------------
apiClient.interceptors.request.use(
  (req: InternalAxiosRequestConfig) => {
    logger.debug("API request", {
      method: req.method?.toUpperCase(),
      url: req.url,
      params: req.params,
    });
    return req;
  },
  (error: AxiosError) => {
    logger.error("API request error", { message: error.message });
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Response interceptor -- log responses & normalise errors
// ---------------------------------------------------------------------------
apiClient.interceptors.response.use(
  (res: AxiosResponse) => {
    logger.debug("API response", {
      status: res.status,
      url: res.config.url,
    });
    return res;
  },
  (error: AxiosError) => {
    if (error.response) {
      logger.error("API error response", {
        status: error.response.status,
        url: error.config?.url,
        data: error.response.data,
      });
    } else if (error.request) {
      logger.error("API no response", {
        url: error.config?.url,
        message: error.message,
      });
    } else {
      logger.error("API setup error", { message: error.message });
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  success: boolean;
}

/**
 * Generic GET request against the Django backend.
 */
export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await apiClient.get<T>(path, { params });
  return { data: response.data, status: response.status, success: true };
}

/**
 * Generic POST request against the Django backend.
 */
export async function apiPost<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await apiClient.post<T>(path, body);
  return { data: response.data, status: response.status, success: true };
}

/**
 * Generic PUT request against the Django backend.
 */
export async function apiPut<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await apiClient.put<T>(path, body);
  return { data: response.data, status: response.status, success: true };
}

/**
 * Generic DELETE request against the Django backend.
 */
export async function apiDelete<T = unknown>(
  path: string,
): Promise<ApiResponse<T>> {
  const response = await apiClient.delete<T>(path);
  return { data: response.data, status: response.status, success: true };
}

export default apiClient;
