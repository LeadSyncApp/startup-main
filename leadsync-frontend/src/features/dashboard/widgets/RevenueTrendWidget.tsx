import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RevenueTrendWidgetProps {
  trend: number | null;
  chart: { date: string; amount: number; orders: number }[];
  loading?: boolean;
}

function TrendSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-6 w-32 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="h-28 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
    </div>
  );
}

export const RevenueTrendWidget: React.FC<RevenueTrendWidgetProps> = ({ trend, chart, loading }) => {
  if (loading) return <TrendSkeleton />;

  const maxAmount = Math.max(...chart.map(d => d.amount), 1);
  const trendUp = trend !== null && trend > 0;
  const trendDown = trend !== null && trend < 0;
  const trendColor = trendUp ? 'var(--success-green)' : trendDown ? '#ef4444' : 'var(--app-text-muted)';
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;

  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="space-y-3">
      {trend !== null && (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${trendColor}15`, color: trendColor }}
        >
          <TrendIcon className="h-3.5 w-3.5" />
          {trendUp ? '↑' : '↓'} {Math.abs(trend)}% vs last month
        </div>
      )}

      <div className="h-28 flex items-end gap-1.5 justify-between">
        {chart.map((day, i) => {
          const height = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 px-2 py-1 rounded text-2xs font-medium whitespace-nowrap"
                style={{ backgroundColor: 'var(--app-surface)', color: 'var(--app-text)', border: '1px solid var(--app-border)' }}
              >
                ₹{day.amount.toLocaleString('en-IN')} · {day.orders} orders
              </div>
              <motion.div
                className="w-full rounded-sm transition-colors group-hover:opacity-100"
                style={{
                  backgroundColor: day.amount > 0 ? 'var(--brand-saffron)' : 'var(--app-border)',
                  opacity: day.amount > 0 ? 0.75 : 0.3,
                }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(height, 3)}%` }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
              />
              {i % 3 === 0 && (
                <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>
                  {day.date.split(' ').pop()?.slice(0, 2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </div>
  );
};
