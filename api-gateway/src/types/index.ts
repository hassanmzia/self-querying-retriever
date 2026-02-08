// ============================================================
// Query Types
// ============================================================

export interface QueryRequest {
  query: string;
  collection?: string;
  method?: RetrievalMethod;
  filters?: Record<string, unknown>;
  top_k?: number;
  stream?: boolean;
  include_metadata?: boolean;
  rerank?: boolean;
}

export type RetrievalMethod =
  | 'self_query'
  | 'semantic'
  | 'keyword'
  | 'hybrid'
  | 'mmr'
  | 'similarity_score_threshold';

export interface QueryResult {
  id: string;
  query: string;
  method: RetrievalMethod;
  results: DocumentChunk[];
  answer?: string;
  metadata: QueryMetadata;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score?: number;
  source?: string;
}

export interface QueryMetadata {
  processing_time_ms: number;
  total_results: number;
  filters_applied?: Record<string, unknown>;
  self_query_generated?: string;
  model_used?: string;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  method: RetrievalMethod;
  result_count: number;
  processing_time_ms: number;
  created_at: string;
}

export interface QueryExpandRequest {
  query: string;
  num_expansions?: number;
}

export interface QueryExpandResponse {
  original_query: string;
  expanded_queries: string[];
}

export interface QueryCompareRequest {
  query: string;
  methods: RetrievalMethod[];
  collection?: string;
  top_k?: number;
}

export interface QueryCompareResponse {
  query: string;
  comparisons: {
    method: RetrievalMethod;
    results: DocumentChunk[];
    processing_time_ms: number;
    result_count: number;
  }[];
}

// ============================================================
// Document Types
// ============================================================

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: DocumentMetadata;
  collection_id?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentMetadata {
  source?: string;
  author?: string;
  file_type?: string;
  file_size?: number;
  page_count?: number;
  tags?: string[];
  custom?: Record<string, unknown>;
}

export interface DocumentUploadRequest {
  title?: string;
  content?: string;
  file?: Buffer;
  metadata?: Partial<DocumentMetadata>;
  collection_id?: string;
}

export interface DocumentUpdateRequest {
  title?: string;
  content?: string;
  metadata?: Partial<DocumentMetadata>;
}

export interface BulkUploadRequest {
  documents: DocumentUploadRequest[];
  collection_id?: string;
}

export interface BulkUploadResponse {
  total: number;
  successful: number;
  failed: number;
  results: {
    index: number;
    id?: string;
    status: 'success' | 'error';
    error?: string;
  }[];
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Agent Types
// ============================================================

export interface Agent {
  name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export type AgentStatus = 'active' | 'inactive' | 'error';

export interface AgentExecution {
  id: string;
  agent_name: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  steps?: AgentStep[];
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentStep {
  name: string;
  status: ExecutionStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
}

export interface GraphVisualization {
  mermaid: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

// ============================================================
// Analytics Types
// ============================================================

export interface DashboardStats {
  total_queries: number;
  total_documents: number;
  total_collections: number;
  avg_processing_time_ms: number;
  queries_today: number;
  queries_this_week: number;
  top_methods: { method: RetrievalMethod; count: number }[];
  recent_queries: QueryHistoryItem[];
}

export interface QueryTrend {
  date: string;
  count: number;
  avg_processing_time_ms: number;
  method_breakdown: Record<RetrievalMethod, number>;
}

export interface MethodComparison {
  method: RetrievalMethod;
  total_queries: number;
  avg_processing_time_ms: number;
  avg_result_count: number;
  success_rate: number;
}

export interface ExportRequest {
  format: 'csv' | 'json';
  type: 'queries' | 'documents' | 'analytics';
  date_from?: string;
  date_to?: string;
  filters?: Record<string, unknown>;
}

// ============================================================
// Pipeline Types
// ============================================================

export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  status: PipelineStatus;
  created_at: string;
  updated_at: string;
}

export type PipelineStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface PipelineStep {
  id: string;
  name: string;
  type: PipelineStepType;
  config: Record<string, unknown>;
  order: number;
}

export type PipelineStepType =
  | 'ingest'
  | 'transform'
  | 'embed'
  | 'index'
  | 'retrieve'
  | 'rerank'
  | 'generate';

export interface CreatePipelineRequest {
  name: string;
  description?: string;
  steps: Omit<PipelineStep, 'id'>[];
}

export interface UpdatePipelineRequest {
  name?: string;
  description?: string;
  steps?: Omit<PipelineStep, 'id'>[];
  status?: PipelineStatus;
}

export interface PipelineExecution {
  id: string;
  pipeline_id: string;
  status: ExecutionStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  step_results: PipelineStepResult[];
  started_at: string;
  completed_at?: string;
}

export interface PipelineStepResult {
  step_id: string;
  step_name: string;
  status: ExecutionStatus;
  output?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}

// ============================================================
// MCP (Model Context Protocol) Types
// ============================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolExecutionRequest {
  arguments: Record<string, unknown>;
}

export interface MCPToolExecutionResponse {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// ============================================================
// WebSocket Types
// ============================================================

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  id?: string;
  timestamp?: string;
}

export type WSMessageType =
  | 'query'
  | 'stream_start'
  | 'stream_chunk'
  | 'stream_end'
  | 'stream_error'
  | 'ping'
  | 'pong'
  | 'subscribe'
  | 'unsubscribe';

export interface WSStreamChunk {
  queryId: string;
  chunk: string;
  index: number;
  done: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Common Types
// ============================================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: {
    backend: ServiceHealth;
    mcp: ServiceHealth;
    websocket: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'unknown';
  latency_ms?: number;
  last_checked?: string;
}
