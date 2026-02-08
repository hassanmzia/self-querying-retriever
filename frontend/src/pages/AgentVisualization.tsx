import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  Bot,
  Network,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  AlertTriangle,
} from "lucide-react";
import mermaid from "mermaid";
import { useAgents, useAgentGraph, useAgentExecutions } from "../hooks/useAnalytics";
import { AgentStatus } from "../types";
import { formatDistanceToNow } from "date-fns";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#0f172a",
    primaryColor: "#155e75",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#0891b2",
    lineColor: "#475569",
    secondaryColor: "#1e293b",
    tertiaryColor: "#1e293b",
    fontFamily: "Inter, sans-serif",
  },
});

const statusConfig = {
  [AgentStatus.IDLE]: { icon: Clock, color: "text-surface-400", bg: "bg-surface-800", label: "Idle" },
  [AgentStatus.RUNNING]: { icon: Play, color: "text-brand-400", bg: "bg-brand-600/10", label: "Running" },
  [AgentStatus.COMPLETED]: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-600/10", label: "Completed" },
  [AgentStatus.FAILED]: { icon: XCircle, color: "text-red-400", bg: "bg-red-600/10", label: "Failed" },
  [AgentStatus.WAITING]: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-600/10", label: "Waiting" },
};

const fallbackGraph = `graph TD
  A[Query Router] --> B{Method Selector}
  B -->|Vector| C[Vector Retriever]
  B -->|Self-Query| D[Self-Query Agent]
  B -->|BM25| E[BM25 Retriever]
  B -->|Hybrid| F[Hybrid Retriever]
  B -->|HyDE| G[Hypothetical Agent]
  C --> H[Reranker]
  D --> H
  E --> H
  F --> H
  G --> H
  H --> I[Context Compressor]
  I --> J[Response Synthesizer]
  J --> K[Output]`;

export default function AgentVisualization() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: graphData } = useAgentGraph();
  const { data: executionsData } = useAgentExecutions(1, 10);

  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);

  const graphDefinition = graphData?.definition ?? fallbackGraph;

  useEffect(() => {
    async function renderDiagram() {
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = "";
        try {
          const { svg } = await mermaid.render("agent-graph", graphDefinition);
          mermaidRef.current.innerHTML = svg;
        } catch {
          mermaidRef.current.innerHTML = `<div class="text-surface-500 text-sm p-4">Failed to render graph</div>`;
        }
      }
    }
    void renderDiagram();
  }, [graphDefinition]);

  const executions = executionsData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Graph visualization */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-semibold text-surface-100">LangGraph Agent Flow</h3>
          </div>
          <button className="btn-ghost text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        <div
          ref={mermaidRef}
          className="overflow-x-auto bg-surface-950/50 rounded-lg p-4 min-h-[300px] flex items-center justify-center"
        />
      </div>

      {/* Agent cards */}
      <div>
        <h3 className="text-sm font-semibold text-surface-100 mb-3">Agents</h3>
        {agentsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(agents ?? []).map((agent, idx) => {
              const config = statusConfig[agent.status] ?? statusConfig[AgentStatus.IDLE];
              const StatusIcon = config.icon;

              return (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="card-hover p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx("p-2 rounded-lg", config.bg)}>
                      <Bot className={clsx("w-4 h-4", config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-200 truncate">{agent.name}</p>
                      <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{agent.description}</p>
                    </div>
                    <StatusIcon className={clsx("w-4 h-4 flex-shrink-0", config.color)} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="badge-brand text-[10px]">{agent.type}</span>
                    {agent.capabilities.slice(0, 2).map((cap) => (
                      <span key={cap} className="text-[10px] px-1.5 py-0.5 bg-surface-800 rounded text-surface-500">{cap}</span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Execution traces */}
      <div>
        <h3 className="text-sm font-semibold text-surface-100 mb-3">Recent Executions</h3>
        {executions.length === 0 ? (
          <div className="text-center py-10 text-sm text-surface-500">No executions recorded yet.</div>
        ) : (
          <div className="space-y-2">
            {executions.map((exec) => {
              const config = statusConfig[exec.status] ?? statusConfig[AgentStatus.IDLE];
              const StatusIcon = config.icon;

              return (
                <button
                  key={exec.execution_id}
                  onClick={() => setSelectedExecution(selectedExecution === exec.execution_id ? null : exec.execution_id)}
                  className="w-full text-left card-hover p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={clsx("w-4 h-4", config.color)} />
                      <div>
                        <p className="text-sm font-medium text-surface-200">Execution {exec.execution_id.slice(0, 8)}</p>
                        <p className="text-xs text-surface-500">
                          {exec.agents.length} agents | {exec.total_duration_ms ?? "..."}ms
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-surface-500">
                      {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Expanded trace */}
                  {selectedExecution === exec.execution_id && (
                    <div className="mt-4 pt-3 border-t border-surface-700/50 space-y-2">
                      {exec.agents.map((agentState) => {
                        const agentConfig = statusConfig[agentState.status] ?? statusConfig[AgentStatus.IDLE];
                        const AgentIcon = agentConfig.icon;
                        return (
                          <div key={agentState.agent_id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-800/50">
                            <AgentIcon className={clsx("w-3.5 h-3.5", agentConfig.color)} />
                            <span className="text-xs font-medium text-surface-300 flex-1">{agentState.agent_id}</span>
                            {agentState.duration_ms != null && (
                              <span className="text-[10px] text-surface-500">{agentState.duration_ms}ms</span>
                            )}
                            <span className={clsx("text-[10px] font-medium", agentConfig.color)}>{agentConfig.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
