import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export interface TraceStep {
  id: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  input?: string;
  output?: string;
  duration?: number;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface ExecutionTraceProps {
  steps: TraceStep[];
  className?: string;
}

const statusIcons = {
  pending: <Clock className="h-4 w-4 text-slate-500" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-teal-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
};

const statusColors = {
  pending: 'border-slate-700',
  running: 'border-teal-500/50',
  completed: 'border-emerald-500/50',
  error: 'border-red-500/50',
};

const lineColors = {
  pending: 'bg-slate-700',
  running: 'bg-teal-500/50',
  completed: 'bg-emerald-500/50',
  error: 'bg-red-500/50',
};

function TraceStepItem({ step, isLast }: { step: TraceStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div
          className={clsx(
            'absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5',
            lineColors[step.status]
          )}
        />
      )}

      {/* Status icon */}
      <div
        className={clsx(
          'relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 bg-slate-900',
          statusColors[step.status]
        )}
      >
        {statusIcons[step.status]}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-200">{step.agentName}</span>
            {step.duration !== undefined && (
              <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs text-slate-400">
                {step.duration}ms
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {new Date(step.timestamp).toLocaleTimeString()}
            </span>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="mt-2 space-y-3 rounded-lg border border-slate-700/30 bg-slate-900/50 p-4">
            {step.input && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Input
                </label>
                <pre className="overflow-x-auto rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300 whitespace-pre-wrap">
                  {step.input}
                </pre>
              </div>
            )}
            {step.output && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Output
                </label>
                <pre className="overflow-x-auto rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300 whitespace-pre-wrap">
                  {step.output}
                </pre>
              </div>
            )}
            {step.details && Object.keys(step.details).length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Details
                </label>
                <pre className="overflow-x-auto rounded-lg bg-slate-950/50 p-3 text-xs text-slate-300 whitespace-pre-wrap">
                  {JSON.stringify(step.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExecutionTrace({ steps, className }: ExecutionTraceProps) {
  if (steps.length === 0) {
    return (
      <div className={clsx('rounded-xl border border-dashed border-slate-700/50 p-8 text-center', className)}>
        <p className="text-sm text-slate-500">No execution trace available. Run a query to see agent execution steps.</p>
      </div>
    );
  }

  return (
    <div className={clsx('rounded-xl border border-slate-700/50 bg-slate-800/40 p-6', className)}>
      <h3 className="mb-4 text-sm font-semibold text-slate-200">Execution Trace</h3>
      <div>
        {steps.map((step, i) => (
          <TraceStepItem key={step.id} step={step} isLast={i === steps.length - 1} />
        ))}
      </div>
      {/* Summary */}
      <div className="mt-2 flex items-center gap-4 border-t border-slate-700/30 pt-4 text-xs text-slate-500">
        <span>
          Total steps: {steps.length}
        </span>
        <span>
          Total time:{' '}
          {steps.reduce((sum, s) => sum + (s.duration ?? 0), 0)}ms
        </span>
        <span>
          Completed: {steps.filter((s) => s.status === 'completed').length}/{steps.length}
        </span>
      </div>
    </div>
  );
}
