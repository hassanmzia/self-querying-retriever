import {
  useQuery as useReactQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { queryApi } from "../services/api";
import { wsClient } from "../services/websocket";
import { useQueryStore } from "../store";
import type {
  QueryRequest,
  QueryResponse,
  QueryHistoryItem,
  StreamingChunk,
  QueryProgressUpdate,
  RetrievalMethod,
  AugmentationType,
} from "../types";

// ============================================================
// Query Keys
// ============================================================

export const queryKeys = {
  all: ["queries"] as const,
  history: (page?: number) => [...queryKeys.all, "history", page] as const,
  result: (id: string) => [...queryKeys.all, "result", id] as const,
};

// ============================================================
// useSearchQuery - Submit and retrieve query results
// ============================================================

export function useSearchQuery() {
  const queryClient = useQueryClient();
  const {
    setQueryResponse,
    setIsLoading,
    setError,
    addToHistory,
  } = useQueryStore();

  const mutation = useMutation({
    mutationFn: async (request: QueryRequest): Promise<QueryResponse> => {
      setIsLoading(true);
      setError(null);
      return queryApi.submit(request);
    },
    onSuccess: (data) => {
      setQueryResponse(data);
      setIsLoading(false);

      // Add to local history
      const historyItem: QueryHistoryItem = {
        id: data.query_id,
        query: data.query,
        retrieval_method: data.retrieval_method,
        collection_id: data.metadata.collection_id,
        result_count: data.total_results,
        execution_time_ms: data.execution_time_ms,
        created_at: new Date().toISOString(),
        augmentations: [],
      };
      addToHistory(historyItem);

      // Invalidate history queries to refresh
      void queryClient.invalidateQueries({ queryKey: queryKeys.history() });
    },
    onError: (error: Error) => {
      setIsLoading(false);
      setError(error.message);
    },
  });

  const submitQuery = useCallback(
    (
      query: string,
      collectionId: string,
      method: RetrievalMethod,
      options?: {
        topK?: number;
        scoreThreshold?: number;
        augmentations?: AugmentationType[];
      }
    ) => {
      const request: QueryRequest = {
        query,
        collection_id: collectionId,
        retrieval_method: method,
        options: {
          top_k: options?.topK ?? 10,
          score_threshold: options?.scoreThreshold ?? 0.5,
          augmentations: options?.augmentations ?? [],
          include_metadata: true,
          include_embeddings: false,
        },
      };
      mutation.mutate(request);
    },
    [mutation]
  );

  return {
    submitQuery,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

// ============================================================
// useQueryHistory - Fetch paginated query history
// ============================================================

export function useQueryHistory(page = 1, pageSize = 20) {
  return useReactQuery({
    queryKey: queryKeys.history(page),
    queryFn: () => queryApi.getHistory(page, pageSize),
    staleTime: 30000,
  });
}

// ============================================================
// useQueryResult - Fetch a specific query result
// ============================================================

export function useQueryResult(queryId: string) {
  return useReactQuery({
    queryKey: queryKeys.result(queryId),
    queryFn: () => queryApi.getResult(queryId),
    enabled: !!queryId,
    staleTime: 60000,
  });
}

// ============================================================
// useDeleteQueryHistory - Delete history items
// ============================================================

export function useDeleteQueryHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (queryId: string) => queryApi.deleteHistoryItem(queryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.history() });
    },
  });
}

// ============================================================
// useClearQueryHistory - Clear all query history
// ============================================================

export function useClearQueryHistory() {
  const queryClient = useQueryClient();
  const { clearHistory } = useQueryStore();

  return useMutation({
    mutationFn: () => queryApi.clearHistory(),
    onSuccess: () => {
      clearHistory();
      void queryClient.invalidateQueries({ queryKey: queryKeys.history() });
    },
  });
}

// ============================================================
// useStreamingQuery - WebSocket-based streaming query
// ============================================================

export function useStreamingQuery() {
  const {
    setIsStreaming,
    setIsLoading,
    setError,
    appendStreamingChunk,
    clearStreamingChunks,
    setQueryResponse,
    addToHistory,
  } = useQueryStore();

  const cleanupRef = useRef<(() => void)[]>([]);
  const queryClient = useQueryClient();

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, []);

  const startStreamingQuery = useCallback(
    (
      query: string,
      collectionId: string,
      method: RetrievalMethod,
      options?: {
        topK?: number;
        scoreThreshold?: number;
        augmentations?: AugmentationType[];
      }
    ) => {
      // Clean up previous listeners
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];

      // Reset state
      clearStreamingChunks();
      setIsStreaming(true);
      setIsLoading(true);
      setError(null);

      // Ensure WebSocket is connected
      if (!wsClient.isConnected) {
        wsClient.connect();
      }

      const queryId = crypto.randomUUID();

      // Set up event handlers
      const unsubChunk = wsClient.onQueryChunk((chunk: StreamingChunk) => {
        appendStreamingChunk(chunk);

        if (chunk.is_final) {
          setIsStreaming(false);
          setIsLoading(false);
        }
      });

      const unsubResult = wsClient.onQueryResult((result) => {
        setQueryResponse(result as QueryResponse);
        setIsStreaming(false);
        setIsLoading(false);

        const response = result as QueryResponse;
        const historyItem: QueryHistoryItem = {
          id: response.query_id,
          query: response.query,
          retrieval_method: response.retrieval_method,
          collection_id: response.metadata.collection_id,
          result_count: response.total_results,
          execution_time_ms: response.execution_time_ms,
          created_at: new Date().toISOString(),
          augmentations: [],
        };
        addToHistory(historyItem);

        void queryClient.invalidateQueries({
          queryKey: queryKeys.history(),
        });
      });

      const unsubError = wsClient.onQueryError(
        (error: { error: string }) => {
          setError(error.error);
          setIsStreaming(false);
          setIsLoading(false);
        }
      );

      cleanupRef.current = [unsubChunk, unsubResult, unsubError];

      // Send query
      wsClient.sendQuery(queryId, query, {
        collection_id: collectionId,
        retrieval_method: method,
        top_k: options?.topK ?? 10,
        score_threshold: options?.scoreThreshold ?? 0.5,
        augmentations: options?.augmentations ?? [],
      });

      return queryId;
    },
    [
      appendStreamingChunk,
      clearStreamingChunks,
      setIsStreaming,
      setIsLoading,
      setError,
      setQueryResponse,
      addToHistory,
      queryClient,
    ]
  );

  const cancelStreaming = useCallback(() => {
    cleanupRef.current.forEach((cleanup) => cleanup());
    cleanupRef.current = [];
    setIsStreaming(false);
    setIsLoading(false);
  }, [setIsStreaming, setIsLoading]);

  return {
    startStreamingQuery,
    cancelStreaming,
  };
}

// ============================================================
// useQueryProgress - Listen for query progress updates
// ============================================================

export function useQueryProgress(
  onProgress?: (update: QueryProgressUpdate) => void
) {
  useEffect(() => {
    if (!onProgress) return;

    const unsubscribe = wsClient.onQueryProgress(onProgress);
    return unsubscribe;
  }, [onProgress]);
}
