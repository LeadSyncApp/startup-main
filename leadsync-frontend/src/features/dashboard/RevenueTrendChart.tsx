import React, { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface RevenuePoint {
  name: string;
  value: number;
  orders: number;
}

interface RevenueSummary {
  totalRevenue: number;
  avgOrderValue: number;
  trend: number | null;
  timeline: RevenuePoint[];
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const compactFormatter = (value: number) => {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
  return `₹${value}`;
};

export const RevenueTrendChart: React.FC = () => {
  const [summary, setSummary] = useState<RevenueSummary>({
    totalRevenue: 0,
    avgOrderValue: 0,
    trend: null,
    timeline: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/analytics/revenue', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch revenue analytics');
        const payload = await response.json();
        setSummary({
          totalRevenue: payload.totalRevenue || 0,
          avgOrderValue: payload.avgOrderValue || 0,
          trend: payload.trend ?? null,
          timeline: payload.timeline || [],
        });
      } catch (error) {
        console.error('Revenue analytics error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--app-text-muted)' }}>
            Revenue Trend
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Last 30 days</h3>
        </div>
        <div className="rounded-full bg-[var(--brand-saffron-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-saffron)]">
          Live
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[var(--app-bg-soft)] p-3">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Revenue</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{currencyFormatter.format(summary.totalRevenue)}</p>
        </div>
        <div className="rounded-xl bg-[var(--app-bg-soft)] p-3">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>AOV</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{currencyFormatter.format(summary.avgOrderValue)}</p>
        </div>
        <div className="rounded-xl bg-[var(--app-bg-soft)] p-3">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Trend</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {summary.trend === null ? '—' : `${summary.trend > 0 ? '+' : ''}${summary.trend.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="mt-4 h-56">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-sm text-[var(--app-text-muted)]">
            Loading revenue chart...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.timeline}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-saffron)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--brand-saffron)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={12} />
              <YAxis tickFormatter={compactFormatter} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: number) => [currencyFormatter.format(value), 'Revenue']}
                labelStyle={{ color: 'var(--app-text)' }}
                contentStyle={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', borderRadius: 12 }}
              />
              <Area type="monotone" dataKey="value" stroke="var(--brand-saffron)" strokeWidth={2} fill="url(#revenueGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
