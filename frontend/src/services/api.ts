import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import toast from "react-hot-toast";
import type {
  ApiResponse,
  PaginatedResponse,
  Collection,
  CollectionCreateRequest,
  Document,
  DocumentUploadRequest,
  DocumentUploadResponse,
  QueryRequest,
  QueryResponse,
  QueryHistoryItem,
  AgentCard,
  AgentExecution,
  Pipeline,
  PipelineConfig,
  DashboardStats,
  QueryTrend,
  MethodComparison,
  AnalyticsTimeRange,
  MCPTool,
  MCPResource,
  AppSettings,
} from "../types";

// ============================================================
// API Client Setup
// ============================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://172.168.1.95:3087";

const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add request timestamp for tracking
    config.headers.set("X-Request-Time", new Date().toISOString());

    // Add correlation ID
    const correlationId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
    config.headers.set("X-Correlation-ID", correlationId);

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<{ message?: string; detail?: string }>) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.detail ||
      error.message ||
      "An unexpected error occurred";

    const status = error.response?.status;

    if (status === 401) {
      toast.error("Authentication required. Please log in.");
    } else if (status === 403) {
      toast.error("You do not have permission to perform this action.");
    } else if (status === 404) {
      toast.error("The requested resource was not found.");
    } else if (status === 429) {
      toast.error("Too many requests. Please try again later.");
    } else if (status !== undefined && status >= 500) {
      toast.error("Server error. Please try again later.");
    } else if (error.code === "ERR_NETWORK") {
      toast.error("Network error. Please check your connection.");
    } else {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

// ============================================================
// Query API
// ============================================================

export const queryApi = {
  submit: async (request: QueryRequest): Promise<QueryResponse> => {
    const { data } = await apiClient.post<ApiResponse<QueryResponse>>(
      "/query",
      request
    );
    return data.data;
  },

  getHistory: async (
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<QueryHistoryItem>> => {
    const { data } = await apiClient.get<PaginatedResponse<QueryHistoryItem>>(
      "/query/history",
      { params: { page, page_size: pageSize } }
    );
    return data;
  },

  getResult: async (queryId: string): Promise<QueryResponse> => {
    const { data } = await apiClient.get<ApiResponse<QueryResponse>>(
      `/query/${queryId}`
    );
    return data.data;
  },

  deleteHistoryItem: async (queryId: string): Promise<void> => {
    await apiClient.delete(`/query/history/${queryId}`);
  },

  clearHistory: async (): Promise<void> => {
    await apiClient.delete("/query/history");
  },
};

// ============================================================
// Document API
// ============================================================

export const documentApi = {
  list: async (
    collectionId?: string,
    page = 1,
    pageSize = 20,
    search?: string
  ): Promise<PaginatedResponse<Document>> => {
    const { data } = await apiClient.get<PaginatedResponse<Document>>(
      "/documents",
      {
        params: {
          collection_id: collectionId,
          page,
          page_size: pageSize,
          search,
        },
      }
    );
    return data;
  },

  get: async (documentId: string): Promise<Document> => {
    const { data } = await apiClient.get<ApiResponse<Document>>(
      `/documents/${documentId}`
    );
    return data.data;
  },

  upload: async (
    request: DocumentUploadRequest
  ): Promise<DocumentUploadResponse> => {
    const formData = new FormData();

    if (request.file) {
      formData.append("file", request.file);
    }

    if (request.content) {
      formData.append("content", request.content);
    }

    formData.append("collection_id", request.collection_id);

    if (request.metadata) {
      formData.append("metadata", JSON.stringify(request.metadata));
    }

    if (request.chunk_size) {
      formData.append("chunk_size", String(request.chunk_size));
    }

    if (request.chunk_overlap) {
      formData.append("chunk_overlap", String(request.chunk_overlap));
    }

    const { data } = await apiClient.post<ApiResponse<DocumentUploadResponse>>(
      "/documents/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      }
    );
    return data.data;
  },

  delete: async (documentId: string): Promise<void> => {
    await apiClient.delete(`/documents/${documentId}`);
  },

  bulkDelete: async (documentIds: string[]): Promise<void> => {
    await apiClient.post("/documents/bulk-delete", {
      document_ids: documentIds,
    });
  },

  search: async (
    query: string,
    collectionId?: string
  ): Promise<Document[]> => {
    const { data } = await apiClient.get<ApiResponse<Document[]>>(
      "/documents/search",
      { params: { q: query, collection_id: collectionId } }
    );
    return data.data;
  },
};

// ============================================================
// Collection API
// ============================================================

export const collectionApi = {
  list: async (): Promise<Collection[]> => {
    const { data } = await apiClient.get<ApiResponse<Collection[]>>(
      "/collections"
    );
    return data.data;
  },

  get: async (collectionId: string): Promise<Collection> => {
    const { data } = await apiClient.get<ApiResponse<Collection>>(
      `/collections/${collectionId}`
    );
    return data.data;
  },

  create: async (request: CollectionCreateRequest): Promise<Collection> => {
    const { data } = await apiClient.post<ApiResponse<Collection>>(
      "/collections",
      request
    );
    return data.data;
  },

  update: async (
    collectionId: string,
    request: Partial<CollectionCreateRequest>
  ): Promise<Collection> => {
    const { data } = await apiClient.put<ApiResponse<Collection>>(
      `/collections/${collectionId}`,
      request
    );
    return data.data;
  },

  delete: async (collectionId: string): Promise<void> => {
    await apiClient.delete(`/collections/${collectionId}`);
  },

  getStats: async (
    collectionId: string
  ): Promise<{ document_count: number; total_chunks: number }> => {
    const { data } = await apiClient.get<
      ApiResponse<{ document_count: number; total_chunks: number }>
    >(`/collections/${collectionId}/stats`);
    return data.data;
  },
};

// ============================================================
// Agent API
// ============================================================

export const agentApi = {
  list: async (): Promise<AgentCard[]> => {
    const { data } = await apiClient.get<ApiResponse<AgentCard[]>>("/agents");
    return data.data;
  },

  get: async (agentId: string): Promise<AgentCard> => {
    const { data } = await apiClient.get<ApiResponse<AgentCard>>(
      `/agents/${agentId}`
    );
    return data.data;
  },

  getExecution: async (executionId: string): Promise<AgentExecution> => {
    const { data } = await apiClient.get<ApiResponse<AgentExecution>>(
      `/agents/executions/${executionId}`
    );
    return data.data;
  },

  listExecutions: async (
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResponse<AgentExecution>> => {
    const { data } = await apiClient.get<PaginatedResponse<AgentExecution>>(
      "/agents/executions",
      { params: { page, page_size: pageSize } }
    );
    return data;
  },

  getGraph: async (): Promise<{ definition: string }> => {
    const { data } = await apiClient.get<
      ApiResponse<{ definition: string }>
    >("/agents/graph");
    return data.data;
  },
};

// ============================================================
// Analytics API
// ============================================================

export const analyticsApi = {
  getDashboardStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<ApiResponse<DashboardStats>>(
      "/analytics/dashboard"
    );
    return data.data;
  },

  getQueryTrends: async (
    timeRange?: AnalyticsTimeRange
  ): Promise<QueryTrend[]> => {
    const { data } = await apiClient.get<ApiResponse<QueryTrend[]>>(
      "/analytics/trends",
      { params: timeRange }
    );
    return data.data;
  },

  getMethodComparison: async (): Promise<MethodComparison[]> => {
    const { data } = await apiClient.get<ApiResponse<MethodComparison[]>>(
      "/analytics/methods"
    );
    return data.data;
  },
};

// ============================================================
// Pipeline API
// ============================================================

export const pipelineApi = {
  list: async (): Promise<Pipeline[]> => {
    const { data } = await apiClient.get<ApiResponse<Pipeline[]>>(
      "/pipelines"
    );
    return data.data;
  },

  get: async (pipelineId: string): Promise<Pipeline> => {
    const { data } = await apiClient.get<ApiResponse<Pipeline>>(
      `/pipelines/${pipelineId}`
    );
    return data.data;
  },

  create: async (config: Partial<PipelineConfig>): Promise<Pipeline> => {
    const { data } = await apiClient.post<ApiResponse<Pipeline>>(
      "/pipelines",
      config
    );
    return data.data;
  },

  update: async (
    pipelineId: string,
    config: Partial<PipelineConfig>
  ): Promise<Pipeline> => {
    const { data } = await apiClient.put<ApiResponse<Pipeline>>(
      `/pipelines/${pipelineId}`,
      config
    );
    return data.data;
  },

  delete: async (pipelineId: string): Promise<void> => {
    await apiClient.delete(`/pipelines/${pipelineId}`);
  },

  activate: async (pipelineId: string): Promise<void> => {
    await apiClient.post(`/pipelines/${pipelineId}/activate`);
  },

  deactivate: async (pipelineId: string): Promise<void> => {
    await apiClient.post(`/pipelines/${pipelineId}/deactivate`);
  },
};

// ============================================================
// MCP API
// ============================================================

export const mcpApi = {
  listTools: async (): Promise<MCPTool[]> => {
    const { data } = await apiClient.get<ApiResponse<MCPTool[]>>("/mcp/tools");
    return data.data;
  },

  listResources: async (): Promise<MCPResource[]> => {
    const { data } = await apiClient.get<ApiResponse<MCPResource[]>>(
      "/mcp/resources"
    );
    return data.data;
  },

  invokeTool: async (
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> => {
    const { data } = await apiClient.post<ApiResponse<unknown>>(
      `/mcp/tools/${toolName}/invoke`,
      input
    );
    return data.data;
  },

  readResource: async (uri: string): Promise<unknown> => {
    const { data } = await apiClient.get<ApiResponse<unknown>>(
      "/mcp/resources/read",
      { params: { uri } }
    );
    return data.data;
  },
};

// ============================================================
// Settings API
// ============================================================

export const settingsApi = {
  get: async (): Promise<AppSettings> => {
    const { data } = await apiClient.get<ApiResponse<AppSettings>>(
      "/settings"
    );
    return data.data;
  },

  update: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    const { data } = await apiClient.put<ApiResponse<AppSettings>>(
      "/settings",
      settings
    );
    return data.data;
  },
};

// ============================================================
// Health API
// ============================================================

export const healthApi = {
  check: async (): Promise<{ status: string; version: string }> => {
    const { data } = await apiClient.get<{
      status: string;
      version: string;
    }>("/health");
    return data;
  },
};

export default apiClient;
