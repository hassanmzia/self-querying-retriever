import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyticsApi, agentApi, pipelineApi } from "../services/api";
import type { AnalyticsTimeRange, PipelineConfig } from "../types";

// ============================================================
// Query Keys
// ============================================================

export const analyticsKeys = {
  all: ["analytics"] as const,
  dashboard: () => [...analyticsKeys.all, "dashboard"] as const,
  trends: (range?: AnalyticsTimeRange) =>
    [...analyticsKeys.all, "trends", range] as const,
  methods: () => [...analyticsKeys.all, "methods"] as const,
};

export const agentKeys = {
  all: ["agents"] as const,
  list: () => [...agentKeys.all, "list"] as const,
  detail: (id: string) => [...agentKeys.all, "detail", id] as const,
  executions: (page?: number) =>
    [...agentKeys.all, "executions", page] as const,
  execution: (id: string) =>
    [...agentKeys.all, "execution", id] as const,
  graph: () => [...agentKeys.all, "graph"] as const,
};

export const pipelineKeys = {
  all: ["pipelines"] as const,
  list: () => [...pipelineKeys.all, "list"] as const,
  detail: (id: string) => [...pipelineKeys.all, "detail", id] as const,
};

// ============================================================
// useDashboardStats - Fetch dashboard statistics
// ============================================================

export function useDashboardStats() {
  return useQuery({
    queryKey: analyticsKeys.dashboard(),
    queryFn: () => analyticsApi.getDashboardStats(),
    staleTime: 15000,
    refetchInterval: 30000,
  });
}

// ============================================================
// useQueryTrends - Fetch query trend data
// ============================================================

export function useQueryTrends(timeRange?: AnalyticsTimeRange) {
  return useQuery({
    queryKey: analyticsKeys.trends(timeRange),
    queryFn: () => analyticsApi.getQueryTrends(timeRange),
    staleTime: 60000,
  });
}

// ============================================================
// useMethodComparison - Fetch retrieval method comparisons
// ============================================================

export function useMethodComparison() {
  return useQuery({
    queryKey: analyticsKeys.methods(),
    queryFn: () => analyticsApi.getMethodComparison(),
    staleTime: 60000,
  });
}

// ============================================================
// useAgents - List all agents
// ============================================================

export function useAgents() {
  return useQuery({
    queryKey: agentKeys.list(),
    queryFn: () => agentApi.list(),
    staleTime: 30000,
  });
}

// ============================================================
// useAgent - Get a single agent
// ============================================================

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: agentKeys.detail(agentId),
    queryFn: () => agentApi.get(agentId),
    enabled: !!agentId,
    staleTime: 30000,
  });
}

// ============================================================
// useAgentExecutions - List agent executions
// ============================================================

export function useAgentExecutions(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: agentKeys.executions(page),
    queryFn: () => agentApi.listExecutions(page, pageSize),
    staleTime: 15000,
  });
}

// ============================================================
// useAgentExecution - Get a single execution trace
// ============================================================

export function useAgentExecution(executionId: string) {
  return useQuery({
    queryKey: agentKeys.execution(executionId),
    queryFn: () => agentApi.getExecution(executionId),
    enabled: !!executionId,
    staleTime: 30000,
  });
}

// ============================================================
// useAgentGraph - Get the LangGraph visualization
// ============================================================

export function useAgentGraph() {
  return useQuery({
    queryKey: agentKeys.graph(),
    queryFn: () => agentApi.getGraph(),
    staleTime: 120000,
  });
}

// ============================================================
// usePipelines - List all pipelines
// ============================================================

export function usePipelines() {
  return useQuery({
    queryKey: pipelineKeys.list(),
    queryFn: () => pipelineApi.list(),
    staleTime: 30000,
  });
}

// ============================================================
// usePipeline - Get a single pipeline
// ============================================================

export function usePipeline(pipelineId: string) {
  return useQuery({
    queryKey: pipelineKeys.detail(pipelineId),
    queryFn: () => pipelineApi.get(pipelineId),
    enabled: !!pipelineId,
    staleTime: 30000,
  });
}

// ============================================================
// useCreatePipeline - Create a new pipeline
// ============================================================

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<PipelineConfig>) => pipelineApi.create(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.list() });
    },
  });
}
