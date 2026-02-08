import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface StatsCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export default function StatsCard({ icon, title, value, trend, className }: StatsCardProps) {
  const trendDirection = trend ? (trend.value > 0 ? 'up' : trend.value < 0 ? 'down' : 'neutral') : null;

  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-700/50 bg-slate-800/80 backdrop-blur-sm p-6',
        'hover:border-slate-600/50 transition-all duration-200',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-100">{value}</p>
          </div>
        </div>
        {trend && (
          <div
            className={clsx(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
              trendDirection === 'up' && 'bg-emerald-500/10 text-emerald-400',
              trendDirection === 'down' && 'bg-red-500/10 text-red-400',
              trendDirection === 'neutral' && 'bg-slate-500/10 text-slate-400'
            )}
          >
            {trendDirection === 'up' && <TrendingUp className="h-3 w-3" />}
            {trendDirection === 'down' && <TrendingDown className="h-3 w-3" />}
            {trendDirection === 'neutral' && <Minus className="h-3 w-3" />}
            <span>
              {trend.value > 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
