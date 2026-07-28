import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

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

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string; amount: number; orders: number } }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs shadow-lg"
      style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
    >
      <p className="font-medium">{d.date}</p>
      <p className="tabular-nums">{'\u20B9'}{d.amount.toLocaleString('en-IN')}</p>
      <p style={{ color: 'var(--app-text-muted)' }}>{d.orders} orders</p>
    </div>
  );
}

export const RevenueTrendWidget: React.FC<RevenueTrendWidgetProps> = ({ trend, chart, loading }) => {
  if (loading) return <TrendSkeleton />;

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
          {trendUp ? '\u2191' : '\u2193'} {Math.abs(trend)}% vs last month
        </div>
      )}

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(chart.length / 5)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(200,90,50,0.06)' }} />
            <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {chart.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.amount > 0 ? 'var(--brand-saffron)' : 'var(--app-border)'}
                  fillOpacity={entry.amount > 0 ? 0.75 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    </div>
  );
};
