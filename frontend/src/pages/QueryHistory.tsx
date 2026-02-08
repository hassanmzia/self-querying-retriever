import { useState, useMemo } from "react";
import {
  History,
  Search,
  Trash2,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import clsx from "clsx";
import { useQueryHistory, useDeleteQueryHistory, useClearQueryHistory } from "@/hooks/useQuery";
import Badge from "@/components/common/Badge";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import Modal from "@/components/common/Modal";
import type { QueryHistoryItem } from "@/types";

// ============================================================
// Mock data
// ============================================================

const mockHistory: QueryHistoryItem[] = [
  {
    id: "qh-1",
    query: "What are the latest trends in AI safety?",
    retrieval_method: "self_query" as const,
    collection_id: "research-papers",
    result_count: 8,
    execution_time_ms: 142,
    created_at: "2025-01-14T14:32:00Z",
    augmentations: ["reranking" as const],
  },
  {
    id: "qh-2",
    query: "Compare transformer architectures from 2024",
    retrieval_method: "hybrid" as const,
    collection_id: "research-papers",
    result_count: 12,
    execution_time_ms: 198,
    created_at: "2025-01-14T14:28:00Z",
    augmentations: [],
  },
  {
    id: "qh-3",
    query: "RAG implementation best practices",
    retrieval_method: "vector" as const,
    collection_id: "tutorials",
    result_count: 5,
    execution_time_ms: 89,
    created_at: "2025-01-14T14:15:00Z",
    augmentations: ["context_compression" as const],
  },
  {
    id: "qh-4",
    query: "LangChain vs LlamaIndex performance benchmarks",
    retrieval_method: "bm25" as const,
    collection_id: "technical-docs",
    result_count: 3,
    execution_time_ms: 67,
    created_at: "2025-01-14T14:10:00Z",
    augmentations: [],
  },
  {
    id: "qh-5",
    query: "Multi-agent systems for document retrieval",
    retrieval_method: "hypothetical" as const,
    collection_id: "research-papers",
    result_count: 7,
    execution_time_ms: 312,
    created_at: "2025-01-14T13:55:00Z",
    augmentations: ["reranking" as const, "query_expansion" as const],
  },
  {
    id: "qh-6",
    query: "ChromaDB indexing strategies",
    retrieval_method: "vector" as const,
    collection_id: "technical-docs",
    result_count: 4,
    execution_time_ms: 95,
    created_at: "2025-01-14T13:40:00Z",
    augmentations: [],
  },
  {
    id: "qh-7",
    query: "Self-querying retriever metadata filtering",
    retrieval_method: "self_query" as const,
    collection_id: "research-papers",
    result_count: 6,
    execution_time_ms: 156,
    created_at: "2025-01-14T13:22:00Z",
    augmentations: ["reranking" as const],
  },
  {
    id: "qh-8",
    query: "Embedding model comparison for technical docs",
    retrieval_method: "hybrid" as const,
    collection_id: "technical-docs",
    result_count: 10,
    execution_time_ms: 234,
    created_at: "2025-01-14T12:58:00Z",
    augmentations: [],
  },
  {
    id: "qh-9",
    query: "Query expansion techniques overview",
    retrieval_method: "vector" as const,
    collection_id: "tutorials",
    result_count: 5,
    execution_time_ms: 112,
    created_at: "2025-01-14T12:45:00Z",
    augmentations: ["query_expansion" as const],
  },
  {
    id: "qh-10",
    query: "ReRanker implementation with cross-encoders",
    retrieval_method: "self_query" as const,
    collection_id: "research-papers",
    result_count: 9,
    execution_time_ms: 178,
    created_at: "2025-01-14T12:30:00Z",
    augmentations: [],
  },
  {
    id: "qh-11",
    query: "How to fine-tune LLMs for domain-specific tasks",
    retrieval_method: "vector" as const,
    collection_id: "tutorials",
    result_count: 6,
    execution_time_ms: 103,
    created_at: "2025-01-13T16:20:00Z",
    augmentations: [],
  },
  {
    id: "qh-12",
    query: "Vector database comparison: ChromaDB vs Pinecone vs Weaviate",
    retrieval_method: "hybrid" as const,
    collection_id: "technical-docs",
    result_count: 8,
    execution_time_ms: 215,
    created_at: "2025-01-13T15:45:00Z",
    augmentations: ["reranking" as const],
  },
];

const methodBadgeVariants: Record<string, "teal" | "blue" | "purple" | "amber" | "pink"> = {
  vector: "teal",
  self_query: "blue",
  bm25: "purple",
  hybrid: "amber",
  hypothetical: "pink",
};

const ITEMS_PER_PAGE = 10;

// ============================================================
// Query History Page
// ============================================================

export default function QueryHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QueryHistoryItem | null>(null);

  // API hooks
  const { data: apiHistory, isLoading } = useQueryHistory(currentPage, ITEMS_PER_PAGE);
  const deleteHistoryMutation = useDeleteQueryHistory();
  const clearHistoryMutation = useClearQueryHistory();

  const history = apiHistory?.data ?? mockHistory;

  // Filter logic
  const filtered = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        !searchQuery || item.query.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMethod = methodFilter === "all" || item.retrieval_method === methodFilter;
      return matchesSearch && matchesMethod;
    });
  }, [history, searchQuery, methodFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteHistoryMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleClearAll = () => {
    clearHistoryMutation.mutate(undefined, {
      onSuccess: () => setClearConfirmOpen(false),
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return `Today ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (isYesterday) return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" label="Loading query history..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Query History</h1>
          <p className="mt-1 text-sm text-slate-400">
            {history.length} total queries
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setClearConfirmOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Clear History
          </button>
        )}
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search query history..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-300 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
          >
            <option value="all">All Methods</option>
            <option value="vector">Vector</option>
            <option value="self_query">Self-Query</option>
            <option value="bm25">BM25</option>
            <option value="hybrid">Hybrid</option>
            <option value="hypothetical">Hypothetical</option>
          </select>
        </div>
      </div>

      {/* History table */}
      {filtered.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-700/50">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/80">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Query
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Results
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="w-20 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {paginated.map((item) => (
                  <tr
                    key={item.id}
                    className="group bg-slate-800/40 hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-200 line-clamp-1 max-w-md">
                          {item.query}
                        </span>
                        {item.augmentations.length > 0 && (
                          <div className="flex gap-1">
                            {item.augmentations.map((aug) => (
                              <Badge key={aug} variant="default" size="sm">
                                {aug.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={methodBadgeVariants[item.retrieval_method] ?? "default"}
                        size="sm"
                      >
                        {item.retrieval_method.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm tabular-nums text-slate-300">
                        {item.result_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span className="text-sm tabular-nums text-slate-400">
                          {item.execution_time_ms}ms
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={`/query?q=${encodeURIComponent(item.query)}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-700 hover:text-teal-400 transition-colors"
                          title="Re-run query"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="rounded p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="No query history"
          description={
            searchQuery || methodFilter !== "all"
              ? "No queries match your current filters. Try adjusting your search."
              : "Your query history will appear here after you run some queries."
          }
          action={
            <a
              href="/query"
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-400 transition-colors"
            >
              <Search className="h-4 w-4" />
              Go to Query Interface
            </a>
          }
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                currentPage === 1
                  ? "border-slate-700/50 text-slate-600 cursor-not-allowed"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={clsx(
                    "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    currentPage === page
                      ? "border-teal-500/50 bg-teal-500/10 text-teal-400"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  )}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                currentPage === totalPages
                  ? "border-slate-700/50 text-slate-600 cursor-not-allowed"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete single item modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Query"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Delete this query from history?
          </p>
          <p className="text-sm text-slate-400 italic line-clamp-2">
            &quot;{deleteTarget?.query}&quot;
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setDeleteTarget(null)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteHistoryMutation.isPending}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 transition-colors"
            >
              {deleteHistoryMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Clear all modal */}
      <Modal
        isOpen={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear All History"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to clear all query history? This will delete{" "}
            <span className="font-medium text-slate-100">{history.length} queries</span>. This
            action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setClearConfirmOpen(false)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClearAll}
              disabled={clearHistoryMutation.isPending}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 transition-colors"
            >
              {clearHistoryMutation.isPending ? "Clearing..." : "Clear All"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
