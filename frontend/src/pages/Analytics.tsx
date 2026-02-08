import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Target,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { useDashboardStats, useQueryTrends, useMethodComparison } from "../hooks/useAnalytics";
import type { DashboardStats, QueryTrend, MethodComparison } from "../types";

const fallbackStats: DashboardStats = {
  total_queries: 1247, total_documents: 3842, total_collections: 12,
  avg_response_time_ms: 142, queries_today: 87, queries_this_week: 523,
  cache_hit_rate: 0.73, active_pipelines: 4,
  top_retrieval_method: "hybrid" as DashboardStats["top_retrieval_method"],
  system_health: "healthy",
};

const fallbackTrends: QueryTrend[] = [
  { date: "Mon", query_count: 45, avg_response_time_ms: 130, avg_result_count: 8, success_rate: 0.97 },
  { date: "Tue", query_count: 62, avg_response_time_ms: 125, avg_result_count: 9, success_rate: 0.98 },
  { date: "Wed", query_count: 58, avg_response_time_ms: 148, avg_result_count: 7, success_rate: 0.95 },
  { date: "Thu", query_count: 71, avg_response_time_ms: 135, avg_result_count: 10, success_rate: 0.99 },
  { date: "Fri", query_count: 89, avg_response_time_ms: 120, avg_result_count: 8, success_rate: 0.96 },
  { date: "Sat", query_count: 34, avg_response_time_ms: 110, avg_result_count: 9, success_rate: 0.98 },
  { date: "Sun", query_count: 28, avg_response_time_ms: 105, avg_result_count: 7, success_rate: 0.97 },
];

const fallbackMethods: MethodComparison[] = [
  { method: "vector" as MethodComparison["method"], query_count: 420, avg_score: 0.82, avg_response_time_ms: 95, avg_result_count: 8, satisfaction_rate: 0.88 },
  { method: "self_query" as MethodComparison["method"], query_count: 310, avg_score: 0.87, avg_response_time_ms: 180, avg_result_count: 6, satisfaction_rate: 0.91 },
  { method: "bm25" as MethodComparison["method"], query_count: 185, avg_score: 0.75, avg_response_time_ms: 45, avg_result_count: 12, satisfaction_rate: 0.78 },
  { method: "hybrid" as MethodComparison["method"], query_count: 280, avg_score: 0.89, avg_response_time_ms: 210, avg_result_count: 9, satisfaction_rate: 0.93 },
  { method: "hypothetical" as MethodComparison["method"], query_count: 52, avg_score: 0.91, avg_response_time_ms: 350, avg_result_count: 5, satisfaction_rate: 0.95 },
];

const methodNames: Record<string, string> = {
  vector: "Vector", self_query: "Self-Query", bm25: "BM25", hybrid: "Hybrid", hypothetical: "Hypothetical",
};

type TimeRange = "7d" | "30d" | "90d";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const { data: statsData, isLoading: statsLoading } = useDashboardStats();
  const { data: trendsData } = useQueryTrends();
  const { data: methodsData } = useMethodComparison();

  const stats = statsData ?? fallbackStats;
  const trends = trendsData ?? fallbackTrends;
  const methods = methodsData ?? fallbackMethods;

  const radarData = methods.map((m) => ({
    method: methodNames[m.method] ?? m.method,
    score: m.avg_score * 100,
    speed: Math.max(0, 100 - m.avg_response_time_ms / 4),
    satisfaction: m.satisfaction_rate * 100,
    volume: Math.min(100, (m.query_count / 5)),
  }));

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-400" />
          <span className="text-sm text-surface-400">Analytics Overview</span>
        </div>
        <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
          {(["7d", "30d", "90d"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                timeRange === range ? "bg-brand-600 text-white" : "text-surface-400 hover:text-surface-200"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Success Rate", value: "97.2%", icon: Target, color: "text-emerald-400", change: "+1.5%" },
          { label: "Avg Latency", value: `${stats.avg_response_time_ms}ms`, icon: Clock, color: "text-amber-400", change: "-8ms" },
          { label: "Weekly Queries", value: stats.queries_this_week.toLocaleString(), icon: TrendingUp, color: "text-brand-400", change: "+12%" },
          { label: "Cache Hit Rate", value: `${(stats.cache_hit_rate * 100).toFixed(0)}%`, icon: BarChart3, color: "text-violet-400", change: "+3%" },
        ].map((metric) => (
          <motion.div key={metric.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <metric.icon className={clsx("w-4 h-4", metric.color)} />
              <span className="text-xs text-surface-500">{metric.label}</span>
            </div>
            <p className="text-xl font-bold text-surface-100">{metric.value}</p>
            <span className="text-xs text-emerald-400">{metric.change}</span>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Query volume trends */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-100 mb-4">Query Volume & Latency</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="aQueryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="aLatencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis yAxisId="left" stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", color: "#e2e8f0", fontSize: "0.75rem" }} />
                <Area yAxisId="left" type="monotone" dataKey="query_count" stroke="#06b6d4" strokeWidth={2} fill="url(#aQueryGrad)" name="Queries" />
                <Area yAxisId="right" type="monotone" dataKey="avg_response_time_ms" stroke="#f59e0b" strokeWidth={2} fill="url(#aLatencyGrad)" name="Latency (ms)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Method comparison bar chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-100 mb-4">Method Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methods}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="method" stroke="#475569" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(val: string) => methodNames[val] ?? val} />
                <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", color: "#e2e8f0", fontSize: "0.75rem" }} />
                <Bar dataKey="avg_score" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Avg Score" />
                <Bar dataKey="satisfaction_rate" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Satisfaction" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Radar chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-100 mb-4">Method Comparison Radar</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="method" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.15} />
              <Radar name="Speed" dataKey="speed" stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
              <Radar name="Satisfaction" dataKey="satisfaction" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", color: "#e2e8f0", fontSize: "0.75rem" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Method details table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-surface-700/50">
          <h3 className="text-sm font-semibold text-surface-100">Detailed Method Statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-700/50">
                <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-5 py-3">Method</th>
                <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-5 py-3">Queries</th>
                <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-5 py-3">Avg Score</th>
                <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-5 py-3">Avg Latency</th>
                <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-5 py-3">Avg Results</th>
                <th className="text-left text-xs font-medium text-surface-500 uppercase tracking-wider px-5 py-3">Satisfaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/30">
              {methods.map((m) => (
                <tr key={m.method} className="hover:bg-surface-800/30 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-surface-200">{methodNames[m.method] ?? m.method}</td>
                  <td className="px-5 py-3 text-sm text-surface-300">{m.query_count.toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm text-surface-300">{m.avg_score.toFixed(3)}</td>
                  <td className="px-5 py-3 text-sm text-surface-300">{m.avg_response_time_ms}ms</td>
                  <td className="px-5 py-3 text-sm text-surface-300">{m.avg_result_count}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${m.satisfaction_rate * 100}%` }} />
                      </div>
                      <span className="text-xs text-surface-400">{(m.satisfaction_rate * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
