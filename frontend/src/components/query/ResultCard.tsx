import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, Hash } from 'lucide-react';
import clsx from 'clsx';
import Badge from '@/components/common/Badge';

interface ResultMetadata {
  year?: number;
  topic?: string;
  topics?: string[];
  subtopic?: string;
  source?: string;
  [key: string]: unknown;
}

interface SearchResult {
  rank: number;
  score: number;
  content: string;
  metadata: ResultMetadata;
  retrieval_method?: string;
}

interface ResultCardProps {
  result: SearchResult;
  className?: string;
}

const methodColors: Record<string, 'teal' | 'blue' | 'purple' | 'amber' | 'pink'> = {
  VECTOR: 'teal',
  SELF_QUERY: 'blue',
  BM25: 'purple',
  HYBRID: 'amber',
  HYPOTHETICAL: 'pink',
};

export default function ResultCard({ result, className }: ResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const previewLength = 300;
  const isLong = result.content.length > previewLength;
  const displayContent = expanded ? result.content : result.content.slice(0, previewLength);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scorePercent = Math.min(Math.max(result.score * 100, 0), 100);
  const allTopics = result.metadata.topics ?? (result.metadata.topic ? [result.metadata.topic] : []);

  return (
    <div
      className={clsx(
        'group rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm',
        'hover:border-slate-600/50 transition-all duration-200',
        className
      )}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-sm font-bold text-teal-400">
              <Hash className="h-3.5 w-3.5" />
              {result.rank}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-300">
                  Score: {(result.score * 100).toFixed(1)}%
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result.retrieval_method && (
              <Badge variant={methodColors[result.retrieval_method] ?? 'default'} dot>
                {result.retrieval_method.replace('_', ' ')}
              </Badge>
            )}
            <button
              onClick={handleCopy}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
              title="Copy content"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mb-3">
          <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
            {displayContent}
            {isLong && !expanded && (
              <span className="text-slate-500">...</span>
            )}
          </p>
        </div>

        {/* Expand/collapse */}
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mb-3 flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show more
              </>
            )}
          </button>
        )}

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2">
          {result.metadata.year && (
            <Badge variant="cyan" size="sm">
              {result.metadata.year}
            </Badge>
          )}
          {allTopics.map((topic) => (
            <Badge key={topic} variant="blue" size="sm">
              {topic}
            </Badge>
          ))}
          {result.metadata.subtopic && (
            <Badge variant="purple" size="sm">
              {result.metadata.subtopic}
            </Badge>
          )}
          {result.metadata.source && (
            <Badge variant="default" size="sm">
              {result.metadata.source}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
