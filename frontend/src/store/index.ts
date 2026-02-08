import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  RetrievalMethod,
  AugmentationType,
  QueryFilter,
  QueryResponse,
  QueryHistoryItem,
  Notification,
  StreamingChunk,
} from "../types";

// ============================================================
// Query Store
// ============================================================

interface QueryState {
  // Current query
  currentQuery: string;
  retrievalMethod: RetrievalMethod;
  collectionId: string;
  filters: QueryFilter[];
  topK: number;
  scoreThreshold: number;
  augmentations: AugmentationType[];

  // Results
  queryResponse: QueryResponse | null;
  streamingChunks: StreamingChunk[];
  isStreaming: boolean;

  // Loading state
  isLoading: boolean;
  error: string | null;

  // History
  queryHistory: QueryHistoryItem[];

  // Actions
  setCurrentQuery: (query: string) => void;
  setRetrievalMethod: (method: RetrievalMethod) => void;
  setCollectionId: (id: string) => void;
  setFilters: (filters: QueryFilter[]) => void;
  addFilter: (filter: QueryFilter) => void;
  removeFilter: (index: number) => void;
  setTopK: (k: number) => void;
  setScoreThreshold: (threshold: number) => void;
  setAugmentations: (augmentations: AugmentationType[]) => void;
  toggleAugmentation: (augmentation: AugmentationType) => void;
  setQueryResponse: (response: QueryResponse | null) => void;
  appendStreamingChunk: (chunk: StreamingChunk) => void;
  clearStreamingChunks: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addToHistory: (item: QueryHistoryItem) => void;
  clearHistory: () => void;
  resetQuery: () => void;
}

const defaultQueryState = {
  currentQuery: "",
  retrievalMethod: "hybrid" as RetrievalMethod,
  collectionId: "",
  filters: [] as QueryFilter[],
  topK: 10,
  scoreThreshold: 0.5,
  augmentations: [] as AugmentationType[],
  queryResponse: null,
  streamingChunks: [] as StreamingChunk[],
  isStreaming: false,
  isLoading: false,
  error: null,
  queryHistory: [] as QueryHistoryItem[],
};

export const useQueryStore = create<QueryState>()(
  persist(
    (set) => ({
      ...defaultQueryState,

      setCurrentQuery: (query) => set({ currentQuery: query }),

      setRetrievalMethod: (method) => set({ retrievalMethod: method }),

      setCollectionId: (id) => set({ collectionId: id }),

      setFilters: (filters) => set({ filters }),

      addFilter: (filter) =>
        set((state) => ({ filters: [...state.filters, filter] })),

      removeFilter: (index) =>
        set((state) => ({
          filters: state.filters.filter((_, i) => i !== index),
        })),

      setTopK: (k) => set({ topK: k }),

      setScoreThreshold: (threshold) => set({ scoreThreshold: threshold }),

      setAugmentations: (augmentations) => set({ augmentations }),

      toggleAugmentation: (augmentation) =>
        set((state) => {
          const exists = state.augmentations.includes(augmentation);
          return {
            augmentations: exists
              ? state.augmentations.filter((a) => a !== augmentation)
              : [...state.augmentations, augmentation],
          };
        }),

      setQueryResponse: (response) => set({ queryResponse: response }),

      appendStreamingChunk: (chunk) =>
        set((state) => ({
          streamingChunks: [...state.streamingChunks, chunk],
        })),

      clearStreamingChunks: () => set({ streamingChunks: [] }),

      setIsStreaming: (streaming) => set({ isStreaming: streaming }),

      setIsLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      addToHistory: (item) =>
        set((state) => ({
          queryHistory: [item, ...state.queryHistory].slice(0, 100),
        })),

      clearHistory: () => set({ queryHistory: [] }),

      resetQuery: () =>
        set({
          currentQuery: "",
          filters: [],
          queryResponse: null,
          streamingChunks: [],
          isStreaming: false,
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: "sqr-query-store",
      partialize: (state) => ({
        retrievalMethod: state.retrievalMethod,
        collectionId: state.collectionId,
        topK: state.topK,
        scoreThreshold: state.scoreThreshold,
        augmentations: state.augmentations,
        queryHistory: state.queryHistory,
      }),
    }
  )
);

// ============================================================
// UI Store
// ============================================================

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Theme
  theme: "dark" | "light" | "system";

  // Notifications
  notifications: Notification[];
  unreadCount: number;

  // Global search
  globalSearchOpen: boolean;
  globalSearchQuery: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setGlobalSearchQuery: (query: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: "dark",
      notifications: [],
      unreadCount: 0,
      globalSearchOpen: false,
      globalSearchQuery: "",

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      setTheme: (theme) => set({ theme }),

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
          unreadCount: state.unreadCount + 1,
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            read: true,
          })),
          unreadCount: 0,
        })),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),

      setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
    }),
    {
      name: "sqr-ui-store",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
