import { motion } from "framer-motion";
import {
  Activity,
  FileText,
  FolderOpen,
  Search,
  Clock,
  Zap,
  TrendingUp,
  Server,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import clsx from "clsx";
import { useDashboardStats, useQueryTrends, useMethodComparison } from "../hooks/useAnalytics";
import type { DashboardStats, MethodComparison } from "../types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: { value: number; label: string };
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  return (
    <motion.div variants={itemVariants} className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-400 font-medium">{title}</p>
          <p className="mt-1 text-2xl font-bold text-surface-100">{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-surface-500">{subtitle}</p>}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className={clsx("w-3 h-3", trend.value >= 0 ? "text-emerald-400" : "text-red-400")} />
              <span className={clsx("text-xs font-medium", trend.value >= 0 ? "text-emerald-400" : "text-red-400")}>
                {trend.value >= 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-surface-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={clsx("p-2.5 rounded-lg", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </motion.div>
  );
}

const fallbackStats: DashboardStats = {
  total_queries: 1247,
  total_documents: 3842,
  total_collections: 12,
  avg_response_time_ms: 142,
  queries_today: 87,
  queries_this_week: 523,
  cache_hit_rate: 0.73,
  active_pipelines: 4,
  top_retrieval_method: "hybrid" as DashboardStats["top_retrieval_method"],
  system_health: "healthy",
};

const fallbackTrends = [
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
  vector: "Vector",
  self_query: "Self-Query",
  bm25: "BM25",
  hybrid: "Hybrid",
  hypothetical: "Hypothetical",
};

export default function Dashboard() {
  const { data: statsData } = useDashboardStats();
  const { data: trendsData } = useQueryTrends();
  const { data: methodsData } = useMethodComparison();

  const stats = statsData ?? fallbackStats;
  const trends = trendsData ?? fallbackTrends;
  const methods = methodsData ?? fallbackMethods;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* System health banner */}
      <motion.div
        variants={itemVariants}
        className={clsx(
          "flex items-center gap-3 px-4 py-3 rounded-xl border",
          stats.system_health === "healthy"
            ? "bg-emerald-600/10 border-emerald-500/20 text-emerald-300"
            : stats.system_health === "degraded"
            ? "bg-amber-600/10 border-amber-500/20 text-amber-300"
            : "bg-red-600/10 border-red-500/20 text-red-300"
        )}
      >
        <div className={clsx(
          "w-2 h-2 rounded-full animate-pulse",
          stats.system_health === "healthy" ? "bg-emerald-400" :
          stats.system_health === "degraded" ? "bg-amber-400" : "bg-red-400"
        )} />
        <span className="text-sm font-medium">
          System Status: {stats.system_health.charAt(0).toUpperCase() + stats.system_health.slice(1)}
        </span>
        <span className="text-xs opacity-70 ml-auto">
          Top method: {methodNames[stats.top_retrieval_method] ?? stats.top_retrieval_method}
        </span>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Queries" value={stats.total_queries.toLocaleString()} subtitle={`${stats.queries_today} today`} icon={Search} color="bg-brand-600" trend={{ value: 12.5, label: "vs last week" }} />
        <StatCard title="Documents" value={stats.total_documents.toLocaleString()} subtitle={`${stats.total_collections} collections`} icon={FileText} color="bg-violet-600" />
        <StatCard title="Avg Response" value={`${stats.avg_response_time_ms}ms`} subtitle="Median latency" icon={Clock} color="bg-amber-600" trend={{ value: -8.3, label: "improvement" }} />
        <StatCard title="Cache Hit Rate" value={`${(stats.cache_hit_rate * 100).toFixed(1)}%`} subtitle={`${stats.active_pipelines} active pipelines`} icon={Zap} color="bg-emerald-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-100">Query Volume</h3>
              <p className="text-xs text-surface-400 mt-0.5">Queries over the past week</p>
            </div>
            <Activity className="w-4 h-4 text-surface-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="queryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", color: "#e2e8f0", fontSize: "0.875rem" }} />
                <Area type="monotone" dataKey="query_count" stroke="#06b6d4" strokeWidth={2} fill="url(#queryGrad)" name="Queries" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-100">Methods</h3>
              <p className="text-xs text-surface-400 mt-0.5">By query count</p>
            </div>
            <Server className="w-4 h-4 text-surface-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methods} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#475569" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis type="category" dataKey="method" stroke="#475569" tick={{ fill: "#94a3b8", fontSize: 11 }} width={80} tickFormatter={(val: string) => methodNames[val] ?? val} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", color: "#e2e8f0", fontSize: "0.75rem" }} />
                <Bar dataKey="query_count" fill="#06b6d4" radius={[0, 4, 4, 0]} name="Queries" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Quick actions and response time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="card p-5">
          <h3 className="text-sm font-semibold text-surface-100 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "New Query", icon: Search, href: "/query", color: "bg-brand-600/10 text-brand-300 border-brand-500/20" },
              { label: "Upload Document", icon: FileText, href: "/documents", color: "bg-violet-600/10 text-violet-300 border-violet-500/20" },
              { label: "View Agents", icon: Zap, href: "/agents", color: "bg-amber-600/10 text-amber-300 border-amber-500/20" },
              { label: "Collections", icon: FolderOpen, href: "/collections", color: "bg-emerald-600/10 text-emerald-300 border-emerald-500/20" },
            ].map((action) => (
              <a key={action.label} href={action.href} className={clsx("flex items-center gap-3 p-3 rounded-lg border transition-all hover:scale-[1.02]", action.color)}>
                <action.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{action.label}</span>
              </a>
            ))}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-100">Response Time</h3>
              <p className="text-xs text-surface-400 mt-0.5">Average response time (ms)</p>
            </div>
            <Clock className="w-4 h-4 text-surface-500" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="respGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "0.5rem", color: "#e2e8f0", fontSize: "0.75rem" }} />
                <Area type="monotone" dataKey="avg_response_time_ms" stroke="#8b5cf6" strokeWidth={2} fill="url(#respGrad)" name="Avg Response (ms)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
