import { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import Badge from '@/components/common/Badge';

interface FilterPanelProps {
  years: number[];
  selectedYears: number[];
  onYearsChange: (years: number[]) => void;
  topics: string[];
  selectedTopics: string[];
  onTopicsChange: (topics: string[]) => void;
  subtopic: string;
  onSubtopicChange: (subtopic: string) => void;
  className?: string;
}

export default function FilterPanel({
  years,
  selectedYears,
  onYearsChange,
  topics,
  selectedTopics,
  onTopicsChange,
  subtopic,
  onSubtopicChange,
  className,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const activeFilterCount =
    selectedYears.length + selectedTopics.length + (subtopic ? 1 : 0);

  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      onYearsChange(selectedYears.filter((y) => y !== year));
    } else {
      onYearsChange([...selectedYears, year]);
    }
  };

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      onTopicsChange(selectedTopics.filter((t) => t !== topic));
    } else {
      onTopicsChange([...selectedTopics, topic]);
    }
  };

  const clearAll = () => {
    onYearsChange([]);
    onTopicsChange([]);
    onSubtopicChange('');
  };

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-sm',
        className
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-teal-400" />
          <span className="text-sm font-medium text-slate-200">Metadata Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="teal" size="sm">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700/30 px-5 py-4 space-y-5">
          {/* Year filter */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Year
            </label>
            <div className="flex flex-wrap gap-2">
              {years.map((year) => (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={clsx(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                    selectedYears.includes(year)
                      ? 'border-teal-500/50 bg-teal-500/10 text-teal-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Topics filter */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Topics
            </label>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => toggleTopic(topic)}
                  className={clsx(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                    selectedTopics.includes(topic)
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Subtopic filter */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Subtopic
            </label>
            <input
              type="text"
              value={subtopic}
              onChange={(e) => onSubtopicChange(e.target.value)}
              placeholder="Filter by subtopic..."
              className={clsx(
                'w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200',
                'placeholder-slate-500 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20'
              )}
            />
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
