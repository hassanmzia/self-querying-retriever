import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  compact?: boolean;
}

export default function QueryInput({
  onSubmit,
  isLoading = false,
  placeholder = 'Ask a question about your documents...',
  initialValue = '',
  className,
  compact = false,
}: QueryInputProps) {
  const [query, setQuery] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = compact ? 80 : 200;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [compact]);

  useEffect(() => {
    autoResize();
  }, [query, autoResize]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed && !isLoading) {
      onSubmit(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={clsx(
        'relative rounded-xl border border-slate-700/50 bg-slate-800/80 backdrop-blur-sm',
        'focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/20',
        'transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <Sparkles className="mt-1 h-5 w-5 flex-shrink-0 text-teal-400" />
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className={clsx(
            'flex-1 resize-none bg-transparent text-slate-100 placeholder-slate-500',
            'focus:outline-none text-base leading-relaxed',
            'disabled:opacity-50'
          )}
        />
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
            'transition-all duration-200',
            query.trim() && !isLoading
              ? 'bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/20'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between border-t border-slate-700/30 px-4 py-2">
        <span className="text-xs text-slate-500">
          Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">Ctrl</kbd>
          {' + '}
          <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-400">Enter</kbd>
          {' to submit'}
        </span>
        {isLoading && (
          <span className="flex items-center gap-2 text-xs text-teal-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-400" />
            Processing query...
          </span>
        )}
      </div>
    </div>
  );
}
