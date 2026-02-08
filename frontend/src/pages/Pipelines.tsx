import { useState } from "react";
import {
  GitBranch,
  Plus,
  Play,
  Pause,
  Settings2,
  Trash2,
  ChevronRight,
  Clock,
  Activity,
  Layers,
  MoreVertical,
} from "lucide-react";
import clsx from "clsx";
import { usePipelines, useCreatePipeline } from "@/hooks/useAnalytics";
import Modal from "@/components/common/Modal";
import Badge from "@/components/common/Badge";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import EmptyState from "@/components/common/EmptyState";
import { RetrievalMethod } from "@/types";
import type { Pipeline } from "@/types";

// ============================================================
// Mock data
// ============================================================

const mockPipelines: Pipeline[] = [
  {
    id: "pipe-1",
    name: "Default RAG Pipeline",
    config: {
      id: "cfg-1",
      name: "Default RAG Pipeline",
      description:
        "Standard retrieval pipeline with vector search, reranking, and answer generation",
      stages: [
        { id: "s1", name: "Query Analyzer", type: "retriever", config: {}, enabled: true, order: 1 },
        { id: "s2", name: "Vector Retriever", type: "retriever", config: { model: "text-embedding-3-small" }, enabled: true, order: 2 },
        { id: "s3", name: "Reranker", type: "ranker", config: { model: "cross-encoder", top_n: 5 }, enabled: true, order: 3 },
        { id: "s4", name: "Answer Generator", type: "synthesizer", config: { model: "gpt-4o" }, enabled: true, order: 4 },
      ],
      default_retrieval_method: RetrievalMethod.VECTOR,
      created_at: "2024-11-15T10:00:00Z",
      updated_at: "2025-01-14T14:00:00Z",
      is_active: true,
    },
    status: "active",
    executions_count: 4521,
    avg_execution_time_ms: 142,
    created_at: "2024-11-15T10:00:00Z",
    updated_at: "2025-01-14T14:00:00Z",
  },
  {
    id: "pipe-2",
    name: "Hybrid Search Pipeline",
    config: {
      id: "cfg-2",
      name: "Hybrid Search Pipeline",
      description:
        "Combines vector and BM25 retrieval with reciprocal rank fusion for comprehensive results",
      stages: [
        { id: "s5", name: "Query Analyzer", type: "retriever", config: {}, enabled: true, order: 1 },
        { id: "s6", name: "Vector Retriever", type: "retriever", config: {}, enabled: true, order: 2 },
        { id: "s7", name: "BM25 Retriever", type: "retriever", config: {}, enabled: true, order: 3 },
        { id: "s8", name: "Hybrid Merger", type: "filter", config: { fusion: "rrf" }, enabled: true, order: 4 },
        { id: "s9", name: "Reranker", type: "ranker", config: {}, enabled: true, order: 5 },
        { id: "s10", name: "Answer Generator", type: "synthesizer", config: {}, enabled: true, order: 6 },
      ],
      default_retrieval_method: RetrievalMethod.HYBRID,
      created_at: "2024-12-01T08:00:00Z",
      updated_at: "2025-01-13T09:30:00Z",
      is_active: true,
    },
    status: "active",
    executions_count: 2134,
    avg_execution_time_ms: 198,
    created_at: "2024-12-01T08:00:00Z",
    updated_at: "2025-01-13T09:30:00Z",
  },
  {
    id: "pipe-3",
    name: "Self-Query Pipeline",
    config: {
      id: "cfg-3",
      name: "Self-Query Pipeline",
      description:
        "LLM-powered structured query generation with automatic metadata filtering",
      stages: [
        { id: "s11", name: "Query Analyzer", type: "retriever", config: {}, enabled: true, order: 1 },
        { id: "s12", name: "Self-Query Constructor", type: "retriever", config: { llm: "gpt-4o-mini" }, enabled: true, order: 2 },
        { id: "s13", name: "Vector Retriever", type: "retriever", config: {}, enabled: true, order: 3 },
        { id: "s14", name: "Context Compressor", type: "augmenter", config: {}, enabled: false, order: 4 },
        { id: "s15", name: "Answer Generator", type: "synthesizer", config: {}, enabled: true, order: 5 },
      ],
      default_retrieval_method: RetrievalMethod.SELF_QUERY,
      created_at: "2024-12-20T15:00:00Z",
      updated_at: "2025-01-12T11:45:00Z",
      is_active: true,
    },
    status: "active",
    executions_count: 1876,
    avg_execution_time_ms: 165,
    created_at: "2024-12-20T15:00:00Z",
    updated_at: "2025-01-12T11:45:00Z",
  },
  {
    id: "pipe-4",
    name: "HyDE Experimental Pipeline",
    config: {
      id: "cfg-4",
      name: "HyDE Experimental Pipeline",
      description:
        "Hypothetical document embedding pipeline for exploratory queries. Currently in draft mode.",
      stages: [
        { id: "s16", name: "Query Analyzer", type: "retriever", config: {}, enabled: true, order: 1 },
        { id: "s17", name: "HyDE Generator", type: "augmenter", config: { llm: "gpt-4o" }, enabled: true, order: 2 },
        { id: "s18", name: "Vector Retriever", type: "retriever", config: {}, enabled: true, order: 3 },
        { id: "s19", name: "Answer Generator", type: "synthesizer", config: {}, enabled: true, order: 4 },
      ],
      default_retrieval_method: RetrievalMethod.HYPOTHETICAL,
      created_at: "2025-01-05T12:00:00Z",
      updated_at: "2025-01-14T08:20:00Z",
      is_active: false,
    },
    status: "draft",
    executions_count: 312,
    avg_execution_time_ms: 345,
    created_at: "2025-01-05T12:00:00Z",
    updated_at: "2025-01-14T08:20:00Z",
  },
  {
    id: "pipe-5",
    name: "Fast BM25 Pipeline",
    config: {
      id: "cfg-5",
      name: "Fast BM25 Pipeline",
      description:
        "Lightweight keyword-only pipeline for fast, low-latency results without LLM overhead",
      stages: [
        { id: "s20", name: "BM25 Retriever", type: "retriever", config: {}, enabled: true, order: 1 },
      ],
      default_retrieval_method: RetrievalMethod.BM25,
      created_at: "2025-01-08T14:00:00Z",
      updated_at: "2025-01-14T12:15:00Z",
      is_active: false,
    },
    status: "inactive",
    executions_count: 89,
    avg_execution_time_ms: 42,
    created_at: "2025-01-08T14:00:00Z",
    updated_at: "2025-01-14T12:15:00Z",
  },
];

const stageTypeColors: Record<string, "teal" | "blue" | "purple" | "amber"> = {
  retriever: "teal",
  ranker: "blue",
  filter: "purple",
  augmenter: "amber",
  synthesizer: "pink" as "teal",
};

const statusConfig = {
  active: { label: "Active", badge: "emerald" as const, icon: Play },
  inactive: { label: "Inactive", badge: "default" as const, icon: Pause },
  draft: { label: "Draft", badge: "amber" as const, icon: Settings2 },
};

// ============================================================
// Pipelines Page
// ============================================================

export default function Pipelines() {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pipeline | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");

  // API hooks
  const { data: apiPipelines, isLoading } = usePipelines();
  const createPipeline = useCreatePipeline();
  const pipelines = apiPipelines && apiPipelines.length > 0 ? apiPipelines : mockPipelines;

  const activePipelines = pipelines.filter((p) => p.status === "active").length;
  const totalExecutions = pipelines.reduce((sum, p) => sum + p.executions_count, 0);

  const handleCreate = () => {
    if (!formName.trim()) return;
    createPipeline.mutate(
      {
        name: formName.trim(),
        description: formDescription.trim(),
        stages: [],
        default_retrieval_method: RetrievalMethod.HYBRID,
        is_active: true,
      },
      {
        onSettled: () => {
          setCreateModalOpen(false);
          setFormName("");
          setFormDescription("");
        },
      }
    );
  };

  const handleToggleStatus = (pipeline: Pipeline) => {
    console.log("Toggle pipeline:", pipeline.id, "from", pipeline.status);
  };

  const handleDelete = () => {
    console.log("Deleting pipeline:", deleteTarget?.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" label="Loading pipelines..." />
      </div>
    );
  }

  // Detail view
  if (selectedPipeline) {
    const config = selectedPipeline.config;
    const statusInfo = statusConfig[selectedPipeline.status];
    return (
      <div className="space-y-6">
        {/* Back + header */}
        <div>
          <button
            onClick={() => setSelectedPipeline(null)}
            className="mb-3 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to Pipelines
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">{selectedPipeline.name}</h1>
              <p className="mt-1 text-sm text-slate-400">{config.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={statusInfo.badge} size="md" dot>
                {statusInfo.label}
              </Badge>
              <button
                onClick={() => handleToggleStatus(selectedPipeline)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  selectedPipeline.status === "active"
                    ? "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                    : "bg-teal-500 text-white hover:bg-teal-400"
                )}
              >
                {selectedPipeline.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4" />
                    Deactivate
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Activate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Pipeline stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Activity className="h-3.5 w-3.5" />
              Executions
            </div>
            <p className="mt-1 text-xl font-bold text-slate-100">
              {selectedPipeline.executions_count.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Avg Execution Time
            </div>
            <p className="mt-1 text-xl font-bold text-slate-100">
              {selectedPipeline.avg_execution_time_ms}ms
            </p>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Layers className="h-3.5 w-3.5" />
              Stages
            </div>
            <p className="mt-1 text-xl font-bold text-slate-100">{config.stages.length}</p>
          </div>
        </div>

        {/* Pipeline stages */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Pipeline Stages</h2>
          <div className="space-y-3">
            {config.stages.map((stage, index) => (
              <div
                key={stage.id}
                className={clsx(
                  "flex items-center gap-4 rounded-lg border p-4 transition-all",
                  stage.enabled
                    ? "border-slate-700/50 bg-slate-900/30"
                    : "border-slate-700/30 bg-slate-900/10 opacity-60"
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/50 text-sm font-bold text-slate-400">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{stage.name}</span>
                    <Badge variant={stageTypeColors[stage.type] ?? "default"} size="sm">
                      {stage.type}
                    </Badge>
                    {!stage.enabled && (
                      <Badge variant="default" size="sm">
                        disabled
                      </Badge>
                    )}
                  </div>
                  {Object.keys(stage.config).length > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {Object.entries(stage.config)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <div
                  className={clsx(
                    "h-5 w-9 rounded-full transition-colors cursor-pointer",
                    stage.enabled ? "bg-teal-500" : "bg-slate-600"
                  )}
                >
                  <div
                    className={clsx(
                      "h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform",
                      stage.enabled ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>Created: {new Date(selectedPipeline.created_at).toLocaleDateString()}</span>
          <span>Updated: {new Date(selectedPipeline.updated_at).toLocaleDateString()}</span>
          <span>Method: {config.default_retrieval_method}</span>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Pipelines</h1>
          <p className="mt-1 text-sm text-slate-400">
            {activePipelines} active pipelines, {totalExecutions.toLocaleString()} total executions
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-400 transition-colors shadow-lg shadow-teal-500/20"
        >
          <Plus className="h-4 w-4" />
          New Pipeline
        </button>
      </div>

      {/* Pipeline list */}
      {pipelines.length > 0 ? (
        <div className="space-y-3">
          {pipelines.map((pipeline) => {
            const statusInfo = statusConfig[pipeline.status];
            const StatusIcon = statusInfo.icon;
            return (
              <div
                key={pipeline.id}
                className={clsx(
                  "group relative rounded-xl border bg-slate-800/60 p-5",
                  "hover:border-slate-600/50 transition-all duration-200",
                  pipeline.status === "active"
                    ? "border-slate-700/50"
                    : "border-slate-700/30"
                )}
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => setSelectedPipeline(pipeline)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          "flex h-10 w-10 items-center justify-center rounded-lg",
                          pipeline.status === "active"
                            ? "bg-teal-500/10 text-teal-400"
                            : "bg-slate-700/50 text-slate-400"
                        )}
                      >
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-100 group-hover:text-teal-400 transition-colors">
                          {pipeline.name}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-1">
                          {pipeline.config.description}
                        </p>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    <Badge variant={statusInfo.badge} size="sm" dot>
                      {statusInfo.label}
                    </Badge>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === pipeline.id ? null : pipeline.id)
                        }
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === pipeline.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl z-10">
                          <button
                            onClick={() => {
                              handleToggleStatus(pipeline);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {pipeline.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPipeline(pipeline);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Configure
                          </button>
                          <button
                            onClick={() => {
                              setDeleteTarget(pipeline);
                              setOpenMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-slate-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-4 flex items-center gap-6 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {pipeline.executions_count.toLocaleString()} executions
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {pipeline.avg_execution_time_ms}ms avg
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    {pipeline.config.stages.length} stages
                  </div>
                </div>

                {/* Stage badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pipeline.config.stages
                    .filter((s) => s.enabled)
                    .map((stage) => (
                      <Badge key={stage.id} variant={stageTypeColors[stage.type] ?? "default"} size="sm">
                        {stage.name}
                      </Badge>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<GitBranch className="h-8 w-8" />}
          title="No pipelines configured"
          description="Create your first retrieval pipeline to get started."
          action={
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-white hover:bg-teal-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Pipeline
            </button>
          }
        />
      )}

      {/* Create pipeline modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Pipeline"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Custom RAG Pipeline"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Describe this pipeline..."
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20 resize-none"
            />
          </div>
          <p className="text-xs text-slate-500">
            After creation, you can configure pipeline stages in the detail view.
          </p>
          <div className="flex items-center justify-end gap-3 border-t border-slate-700/30 pt-4">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formName.trim()}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                formName.trim()
                  ? "bg-teal-500 text-white hover:bg-teal-400"
                  : "bg-slate-700 text-slate-500 cursor-not-allowed"
              )}
            >
              <Plus className="h-4 w-4" />
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Pipeline"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to delete{" "}
            <span className="font-medium text-slate-100">{deleteTarget?.name}</span>? This action
            cannot be undone.
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
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
