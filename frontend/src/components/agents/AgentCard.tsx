import {
  Brain,
  Search,
  FileText,
  Layers,
  HelpCircle,
  Zap,
  Shrink,
  Expand,
  MessageSquare,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import Badge from '@/components/common/Badge';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'error';

interface AgentCardProps {
  name: string;
  description: string;
  capabilities: string[];
  status: AgentStatus;
  lastExecution?: {
    duration: number;
    timestamp: string;
  };
  className?: string;
}

const agentIcons: Record<string, LucideIcon> = {
  'Query Analyzer': Brain,
  'Self-Query Constructor': Search,
  'Vector Retriever': Search,
  'BM25 Retriever': FileText,
  'Hybrid Merger': Layers,
  'Hypothetical Question Generator': HelpCircle,
  Reranker: Zap,
  Compressor: Shrink,
  'Query Expander': Expand,
  'Answer Generator': MessageSquare,
  Supervisor: Eye,
};

const statusConfig: Record<AgentStatus, { label: string; color: string; dotColor: string }> = {
  idle: { label: 'Idle', color: 'text-slate-400', dotColor: 'bg-slate-400' },
  running: { label: 'Running', color: 'text-teal-400', dotColor: 'bg-teal-400 animate-pulse' },
  completed: { label: 'Completed', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  error: { label: 'Error', color: 'text-red-400', dotColor: 'bg-red-400' },
};

export default function AgentCard({
  name,
  description,
  capabilities,
  status,
  lastExecution,
  className,
}: AgentCardProps) {
  const IconComponent = agentIcons[name] ?? Brain;
  const statusInfo = statusConfig[status];

  return (
    <div
      className={clsx(
        'rounded-xl border bg-slate-800/60 backdrop-blur-sm p-5',
        'transition-all duration-200',
        status === 'running'
          ? 'border-teal-500/50 shadow-lg shadow-teal-500/5'
          : status === 'error'
            ? 'border-red-500/30'
            : 'border-slate-700/50 hover:border-slate-600/50',
        className
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={clsx(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              status === 'running' ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-700/50 text-slate-400'
            )}
          >
            <IconComponent className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{name}</h3>
            <div className={clsx('flex items-center gap-1.5 text-xs', statusInfo.color)}>
              <span className={clsx('h-1.5 w-1.5 rounded-full', statusInfo.dotColor)} />
              {statusInfo.label}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="mb-3 text-xs text-slate-400 leading-relaxed">{description}</p>

      {/* Capabilities */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {capabilities.map((cap) => (
          <Badge key={cap} variant="default" size="sm">
            {cap}
          </Badge>
        ))}
      </div>

      {/* Last execution */}
      {lastExecution && (
        <div className="border-t border-slate-700/30 pt-3 text-xs text-slate-500">
          <span>Last run: {lastExecution.duration}ms</span>
          <span className="mx-2">|</span>
          <span>{new Date(lastExecution.timestamp).toLocaleTimeString()}</span>
        </div>
      )}
    </div>
  );
}
