// ============================================================
// Enums
// ============================================================

export enum RetrievalMethod {
  VECTOR = "vector",
  SELF_QUERY = "self_query",
  BM25 = "bm25",
  HYBRID = "hybrid",
  HYPOTHETICAL = "hypothetical",
}

export enum AugmentationType {
  RERANKING = "reranking",
  CONTEXT_COMPRESSION = "context_compression",
  QUERY_EXPANSION = "query_expansion",
}

export enum AgentStatus {
  IDLE = "idle",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  WAITING = "waiting",
}

export enum WebSocketEventType {
  QUERY_START = "query_start",
  QUERY_PROGRESS = "query_progress",
  QUERY_CHUNK = "query_chunk",
  QUERY_RESULT = "query_result",
  QUERY_ERROR = "query_error",
  AGENT_UPDATE = "agent_update",
  PIPELINE_UPDATE = "pipeline_update",
  CONNECTION_ACK = "connection_ack",
}

// ============================================================
// Document Types
// ============================================================

export interface DocumentMetadata {
  source: string;
  author?: string;
  created_at: string;
  updated_at?: string;
  page?: number;
  chunk_index?: number;
  total_chunks?: number;
  file_type?: string;
  file_size?: number;
  language?: string;
  tags?: string[];
  custom_fields?: Record<string, string | number | boolean>;
}

export interface Document {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  collection_id: string;
  embedding_model?: string;
  score?: number;
  highlights?: string[];
}

export interface DocumentUploadRequest {
  file?: File;
  content?: string;
  collection_id: string;
  metadata?: Partial<DocumentMetadata>;
  chunk_size?: number;
  chunk_overlap?: number;
}

export interface DocumentUploadResponse {
  id: string;
  chunks_created: number;
  collection_id: string;
  status: string;
}

// ============================================================
// Collection Types
// ============================================================

export interface Collection {
  id: string;
  name: string;
  description?: string;
  document_count: number;
  embedding_model: string;
  vector_dimension: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export interface CollectionCreateRequest {
  name: string;
  description?: string;
  embedding_model?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Query Types
// ============================================================

export interface QueryFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin" | "contains";
  value: string | number | boolean | string[];
}

export interface QueryOptions {
  top_k: number;
  score_threshold: number;
  augmentations: AugmentationType[];
  rerank_model?: string;
  expansion_count?: number;
  include_metadata: boolean;
  include_embeddings: boolean;
}

export interface QueryRequest {
  query: string;
  collection_id: string;
  retrieval_method: RetrievalMethod;
  filters?: QueryFilter[];
  options: QueryOptions;
}

export interface QueryResult {
  id: string;
  document: Document;
  score: number;
  retrieval_method: RetrievalMethod;
  augmentation_applied?: AugmentationType[];
  explanation?: string;
  highlights?: string[];
}

export interface QueryResponse {
  query_id: string;
  query: string;
  results: QueryResult[];
  total_results: number;
  retrieval_method: RetrievalMethod;
  execution_time_ms: number;
  agent_trace?: AgentExecution;
  metadata: {
    collection_id: string;
    model_used: string;
    tokens_used?: number;
    cached?: boolean;
  };
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  retrieval_method: RetrievalMethod;
  collection_id: string;
  result_count: number;
  execution_time_ms: number;
  created_at: string;
  augmentations: AugmentationType[];
}

// ============================================================
// Agent Types
// ============================================================

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  type: "retriever" | "ranker" | "augmenter" | "router" | "synthesizer";
  status: AgentStatus;
  capabilities: string[];
  icon?: string;
}

export interface AgentState {
  agent_id: string;
  status: AgentStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentExecution {
  execution_id: string;
  query_id: string;
  agents: AgentState[];
  graph_definition: string; // Mermaid diagram definition
  current_agent?: string;
  started_at: string;
  completed_at?: string;
  total_duration_ms?: number;
  status: AgentStatus;
}

// ============================================================
// Pipeline Types
// ============================================================

export interface PipelineStage {
  id: string;
  name: string;
  type: "retriever" | "ranker" | "filter" | "augmenter" | "synthesizer";
  config: Record<string, unknown>;
  enabled: boolean;
  order: number;
}

export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  default_retrieval_method: RetrievalMethod;
  default_collection_id?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  config: PipelineConfig;
  status: "active" | "inactive" | "draft";
  executions_count: number;
  avg_execution_time_ms: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Analytics Types
// ============================================================

export interface DashboardStats {
  total_queries: number;
  total_documents: number;
  total_collections: number;
  avg_response_time_ms: number;
  queries_today: number;
  queries_this_week: number;
  cache_hit_rate: number;
  active_pipelines: number;
  top_retrieval_method: RetrievalMethod;
  system_health: "healthy" | "degraded" | "down";
}

export interface QueryTrend {
  date: string;
  query_count: number;
  avg_response_time_ms: number;
  avg_result_count: number;
  success_rate: number;
}

export interface MethodComparison {
  method: RetrievalMethod;
  query_count: number;
  avg_score: number;
  avg_response_time_ms: number;
  avg_result_count: number;
  satisfaction_rate: number;
}

export interface AnalyticsTimeRange {
  start: string;
  end: string;
  granularity: "hour" | "day" | "week" | "month";
}

// ============================================================
// WebSocket Types
// ============================================================

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: unknown;
  timestamp: string;
  correlation_id?: string;
}

export interface StreamingChunk {
  chunk_index: number;
  content: string;
  is_final: boolean;
  metadata?: Record<string, unknown>;
}

export interface QueryProgressUpdate {
  query_id: string;
  stage: string;
  progress: number; // 0-100
  message: string;
  agent_id?: string;
}

// ============================================================
// MCP Types
// ============================================================

export interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mime_type?: string;
}

// ============================================================
// API Response Wrappers
// ============================================================

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================
// Settings Types
// ============================================================

export interface AppSettings {
  default_collection_id?: string;
  default_retrieval_method: RetrievalMethod;
  default_top_k: number;
  default_score_threshold: number;
  enable_streaming: boolean;
  enable_agent_traces: boolean;
  theme: "dark" | "light" | "system";
  api_base_url: string;
  websocket_url: string;
}

// ============================================================
// Notification Types
// ============================================================

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
