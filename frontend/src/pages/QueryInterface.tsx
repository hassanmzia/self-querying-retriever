import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import {
  Search,
  Send,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Sliders,
  X,
  Plus,
  Sparkles,
  Wifi,
} from "lucide-react";
import { useQueryStore } from "../store";
import { useSearchQuery, useStreamingQuery } from "../hooks/useQuery";
import { useCollections } from "../hooks/useDocuments";
import { RetrievalMethod, AugmentationType } from "../types";
import type { QueryFilter } from "../types";

const methodOptions = [
  { value: RetrievalMethod.VECTOR, label: "Vector Search", description: "Semantic similarity via embeddings", color: "brand" },
  { value: RetrievalMethod.SELF_QUERY, label: "Self-Query", description: "LLM-generated structured queries", color: "violet" },
  { value: RetrievalMethod.BM25, label: "BM25", description: "Keyword-based TF-IDF scoring", color: "amber" },
  { value: RetrievalMethod.HYBRID, label: "Hybrid", description: "Combined vector + keyword search", color: "emerald" },
  { value: RetrievalMethod.HYPOTHETICAL, label: "Hypothetical Questions", description: "HyDE: answer-then-search approach", color: "rose" },
];

const augmentationOptions = [
  { value: AugmentationType.RERANKING, label: "Reranking", description: "Cross-encoder reranking" },
  { value: AugmentationType.CONTEXT_COMPRESSION, label: "Context Compression", description: "Compress and deduplicate context" },
  { value: AugmentationType.QUERY_EXPANSION, label: "Query Expansion", description: "Expand query with related terms" },
];

export default function QueryInterface() {
  const {
    currentQuery,
    setCurrentQuery,
    retrievalMethod,
    setRetrievalMethod,
    collectionId,
    setCollectionId,
    filters,
    addFilter,
    removeFilter,
    topK,
    setTopK,
    scoreThreshold,
    setScoreThreshold,
    augmentations,
    toggleAugmentation,
    queryResponse,
    streamingChunks,
    isStreaming,
    isLoading,
    error,
    resetQuery,
  } = useQueryStore();

  const { submitQuery } = useSearchQuery();
  const { startStreamingQuery, cancelStreaming } = useStreamingQuery();
  const { data: collections } = useCollections();

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [useStreaming, setUseStreaming] = useState(false);
  const [newFilterField, setNewFilterField] = useState("");
  const [newFilterValue, setNewFilterValue] = useState("");

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!currentQuery.trim() || isLoading) return;

      const options = {
        topK,
        scoreThreshold,
        augmentations,
      };

      if (useStreaming) {
        startStreamingQuery(currentQuery, collectionId, retrievalMethod, options);
      } else {
        submitQuery(currentQuery, collectionId, retrievalMethod, options);
      }
    },
    [currentQuery, collectionId, retrievalMethod, topK, scoreThreshold, augmentations, isLoading, useStreaming, submitQuery, startStreamingQuery]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleAddFilter = useCallback(() => {
    if (newFilterField.trim() && newFilterValue.trim()) {
      const filter: QueryFilter = {
        field: newFilterField.trim(),
        operator: "eq",
        value: newFilterValue.trim(),
      };
      addFilter(filter);
      setNewFilterField("");
      setNewFilterValue("");
    }
  }, [newFilterField, newFilterValue, addFilter]);

  const streamedText = streamingChunks.map((c) => c.content).join("");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Query input */}
      <form onSubmit={handleSubmit}>
        <div className="card p-1">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={currentQuery}
              onChange={(e) => setCurrentQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your documents..."
              rows={3}
              className="w-full px-5 py-4 bg-transparent text-surface-100 placeholder-surface-500 resize-none focus:outline-none text-base"
            />
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-2">
                {/* Collection selector */}
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="px-3 py-1.5 bg-surface-800 border border-surface-700/50 rounded-lg text-xs text-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                >
                  <option value="">All Collections</option>
                  {collections?.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>

                {/* Streaming toggle */}
                <button
                  type="button"
                  onClick={() => setUseStreaming(!useStreaming)}
                  className={clsx(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    useStreaming
                      ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                      : "bg-surface-800 text-surface-400 border border-surface-700/50 hover:text-surface-300"
                  )}
                >
                  <Wifi className="w-3 h-3" />
                  Stream
                </button>

                {/* Advanced toggle */}
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-400 border border-surface-700/50 hover:text-surface-300 transition-colors"
                >
                  <Sliders className="w-3 h-3" />
                  Options
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(currentQuery || queryResponse) && (
                  <button
                    type="button"
                    onClick={resetQuery}
                    className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!currentQuery.trim() || isLoading}
                  className="btn-primary px-4 py-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span className="text-sm">Search</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Retrieval method selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {methodOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRetrievalMethod(opt.value)}
            className={clsx(
              "p-3 rounded-xl border text-left transition-all",
              retrievalMethod === opt.value
                ? "bg-brand-600/10 border-brand-500/30 ring-1 ring-brand-500/20"
                : "bg-surface-900 border-surface-700/50 hover:border-surface-600"
            )}
          >
            <p className={clsx("text-xs font-semibold", retrievalMethod === opt.value ? "text-brand-300" : "text-surface-200")}>
              {opt.label}
            </p>
            <p className="text-[10px] text-surface-500 mt-0.5 line-clamp-1">{opt.description}</p>
          </button>
        ))}
      </div>

      {/* Advanced options */}
      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="card p-5 space-y-5">
              <h3 className="text-sm font-semibold text-surface-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-400" />
                Augmentations
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {augmentationOptions.map((aug) => (
                  <button
                    key={aug.value}
                    onClick={() => toggleAugmentation(aug.value)}
                    className={clsx(
                      "p-3 rounded-lg border text-left transition-all",
                      augmentations.includes(aug.value)
                        ? "bg-brand-600/10 border-brand-500/30"
                        : "bg-surface-800/50 border-surface-700/50 hover:border-surface-600"
                    )}
                  >
                    <p className={clsx("text-xs font-medium", augmentations.includes(aug.value) ? "text-brand-300" : "text-surface-300")}>
                      {aug.label}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">{aug.description}</p>
                  </button>
                ))}
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-surface-300">Top K Results</label>
                    <span className="text-xs text-brand-400 bg-surface-800 px-2 py-0.5 rounded font-mono">{topK}</span>
                  </div>
                  <input type="range" min={1} max={50} value={topK} onChange={(e) => setTopK(Number(e.target.value))} className="w-full accent-brand-500" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-surface-300">Score Threshold</label>
                    <span className="text-xs text-brand-400 bg-surface-800 px-2 py-0.5 rounded font-mono">{scoreThreshold.toFixed(2)}</span>
                  </div>
                  <input type="range" min={0} max={100} value={scoreThreshold * 100} onChange={(e) => setScoreThreshold(Number(e.target.value) / 100)} className="w-full accent-brand-500" />
                </div>
              </div>

              {/* Filters */}
              <div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 text-xs font-medium text-surface-400 hover:text-surface-200 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Metadata Filters ({filters.length})
                </button>

                {showFilters && (
                  <div className="mt-3 space-y-2">
                    {filters.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-surface-800 rounded text-surface-300">{f.field}</span>
                        <span className="text-surface-500">{f.operator}</span>
                        <span className="px-2 py-1 bg-surface-800 rounded text-surface-300">{String(f.value)}</span>
                        <button onClick={() => removeFilter(i)} className="p-0.5 text-surface-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        value={newFilterField}
                        onChange={(e) => setNewFilterField(e.target.value)}
                        placeholder="Field"
                        className="px-2 py-1.5 text-xs bg-surface-800 border border-surface-700/50 rounded text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 w-28"
                      />
                      <input
                        value={newFilterValue}
                        onChange={(e) => setNewFilterValue(e.target.value)}
                        placeholder="Value"
                        className="px-2 py-1.5 text-xs bg-surface-800 border border-surface-700/50 rounded text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 w-28"
                      />
                      <button onClick={handleAddFilter} className="px-2 py-1.5 text-xs bg-brand-600 text-white rounded hover:bg-brand-500 transition-colors">
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading / Streaming indicator */}
      {isLoading && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-brand-500/20 bg-brand-500/5">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          <div>
            <p className="text-sm font-medium text-brand-300">
              {isStreaming ? "Streaming results..." : "Processing query..."}
            </p>
            <p className="text-xs text-brand-400/70">
              Using {methodOptions.find((m) => m.value === retrievalMethod)?.label} retrieval
            </p>
          </div>
          {isStreaming && (
            <button onClick={cancelStreaming} className="ml-auto text-xs text-surface-400 hover:text-surface-200">
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Streaming output */}
      {streamedText && (
        <div className="card p-5">
          <h3 className="text-xs font-medium text-brand-400 uppercase tracking-wider mb-2">Streaming Response</h3>
          <p className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed">{streamedText}</p>
          {isStreaming && <span className="inline-block w-2 h-4 bg-brand-400 animate-pulse ml-0.5" />}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 py-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {queryResponse && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-100">
              Results <span className="text-surface-500 font-normal">({queryResponse.total_results} found)</span>
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-surface-400">
              <Clock className="w-3.5 h-3.5" />
              {queryResponse.execution_time_ms}ms
            </div>
          </div>

          {queryResponse.results.map((result, _idx) => (
            <motion.div
              key={result.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: _idx * 0.05 }}
              className="card-hover p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-brand-400 bg-brand-600/10 px-2 py-0.5 rounded">
                    #{_idx + 1}
                  </span>
                  <span className="text-xs text-surface-400">
                    Score: {result.score.toFixed(3)}
                  </span>
                </div>
                <span className="badge-brand text-[10px]">{result.retrieval_method}</span>
              </div>

              <p className="text-sm text-surface-200 leading-relaxed line-clamp-4">
                {result.document.content}
              </p>

              {result.document.metadata && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {result.document.metadata.source && (
                    <span className="text-[10px] px-2 py-0.5 bg-surface-800 rounded text-surface-400">
                      {result.document.metadata.source}
                    </span>
                  )}
                  {result.document.metadata.tags?.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-surface-800 rounded text-surface-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {result.explanation && (
                <p className="mt-2 text-xs text-surface-500 italic">{result.explanation}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!queryResponse && !isLoading && !error && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-surface-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-surface-400">Ready to search</h3>
          <p className="text-sm text-surface-500 mt-1 max-w-md mx-auto">
            Enter a query above to search your document collections using AI-powered retrieval methods.
          </p>
        </div>
      )}
    </div>
  );
}
