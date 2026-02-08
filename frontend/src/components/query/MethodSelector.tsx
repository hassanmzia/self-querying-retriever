import { Search, Brain, FileText, Layers, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export type RetrievalMethod = 'VECTOR' | 'SELF_QUERY' | 'BM25' | 'HYBRID' | 'HYPOTHETICAL';

interface MethodOption {
  value: RetrievalMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const methods: MethodOption[] = [
  {
    value: 'VECTOR',
    label: 'Vector',
    description: 'Semantic similarity search using embeddings',
    icon: <Search className="h-4 w-4" />,
    color: 'teal',
  },
  {
    value: 'SELF_QUERY',
    label: 'Self-Query',
    description: 'LLM-generated structured queries with metadata filtering',
    icon: <Brain className="h-4 w-4" />,
    color: 'blue',
  },
  {
    value: 'BM25',
    label: 'BM25',
    description: 'Traditional keyword-based retrieval with BM25 scoring',
    icon: <FileText className="h-4 w-4" />,
    color: 'purple',
  },
  {
    value: 'HYBRID',
    label: 'Hybrid',
    description: 'Combined vector + BM25 retrieval with reciprocal rank fusion',
    icon: <Layers className="h-4 w-4" />,
    color: 'amber',
  },
  {
    value: 'HYPOTHETICAL',
    label: 'Hypothetical',
    description: 'Generates hypothetical answer, then retrieves similar documents',
    icon: <HelpCircle className="h-4 w-4" />,
    color: 'pink',
  },
];

const colorMap: Record<string, { active: string; ring: string; icon: string }> = {
  teal: {
    active: 'border-teal-500/50 bg-teal-500/10',
    ring: 'ring-teal-500/20',
    icon: 'text-teal-400',
  },
  blue: {
    active: 'border-blue-500/50 bg-blue-500/10',
    ring: 'ring-blue-500/20',
    icon: 'text-blue-400',
  },
  purple: {
    active: 'border-purple-500/50 bg-purple-500/10',
    ring: 'ring-purple-500/20',
    icon: 'text-purple-400',
  },
  amber: {
    active: 'border-amber-500/50 bg-amber-500/10',
    ring: 'ring-amber-500/20',
    icon: 'text-amber-400',
  },
  pink: {
    active: 'border-pink-500/50 bg-pink-500/10',
    ring: 'ring-pink-500/20',
    icon: 'text-pink-400',
  },
};

interface MethodSelectorProps {
  selected: RetrievalMethod;
  onChange: (method: RetrievalMethod) => void;
  className?: string;
}

export default function MethodSelector({ selected, onChange, className }: MethodSelectorProps) {
  return (
    <div className={clsx('space-y-3', className)}>
      <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">
        Retrieval Method
      </label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {methods.map((method) => {
          const isActive = selected === method.value;
          const colors = colorMap[method.color];
          return (
            <button
              key={method.value}
              onClick={() => onChange(method.value)}
              className={clsx(
                'group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-200',
                isActive
                  ? `${colors?.active} ring-1 ${colors?.ring}`
                  : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600/50 hover:bg-slate-800/60'
              )}
            >
              <div
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                  isActive ? colors?.icon : 'text-slate-500 group-hover:text-slate-400'
                )}
              >
                {method.icon}
              </div>
              <span
                className={clsx(
                  'text-sm font-medium transition-colors',
                  isActive ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-300'
                )}
              >
                {method.label}
              </span>
              <span className="text-xs text-slate-500 line-clamp-2">{method.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
