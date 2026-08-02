import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface RevenueForecastWidgetProps {
  forecast: { historical: { date: string; revenue: number }[]; forecast: { date: string; revenue: number; forecast: boolean }[] } | null;
  loading?: boolean;
}

function Skeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="h-5 w-40 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="h-40 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; payload: { date: string; forecast?: boolean } }>;
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs shadow-lg"
      style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
    >
      <p className="font-medium">{point.date}</p>
      <p className="tabular-nums font-semibold">{'\u20B9'}{payload[0].value.toLocaleString('en-IN')}</p>
      {point.forecast && <p style={{ color: 'var(--app-text-muted)' }}>Forecast</p>}
    </div>
  );
}

export const RevenueForecastWidget: React.FC<RevenueForecastWidgetProps> = ({ forecast, loading }) => {
  if (loading) return <Skeleton />;

  const hasData = forecast && forecast.historical && forecast.historical.length > 0;
  if (!hasData) {
    return (
      <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Revenue Forecast</h2>
        <p className="text-sm text-center py-8" style={{ color: 'var(--app-text-muted)' }}>
          Not enough data to generate a forecast
        </p>
      </div>
    );
  }

  const combined = [
    ...forecast.historical.map(d => ({ ...d, forecast: false })),
    ...forecast.forecast,
  ];

  const totalHistorical = forecast.historical.reduce((s, d) => s + d.revenue, 0);
  const totalForecast = forecast.forecast.reduce((s, d) => s + d.revenue, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 transition-all duration-200 hover:shadow-sm"
      style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Revenue Forecast</h2>
        <div className="flex items-center gap-3 text-2xs" style={{ color: 'var(--app-text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: 'var(--brand-saffron)' }} />
            Actual
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: 'var(--brand-saffron)', opacity: 0.4 }} />
            Forecast
          </span>
        </div>
      </div>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={combined} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(combined.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--app-text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--brand-saffron)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
        <div className="text-center">
          <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>Last 30 days</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--app-text)' }}>{'\u20B9'}{totalHistorical.toLocaleString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--brand-saffron)' }} />
        </div>
        <div className="text-center">
          <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>Next 14 days</p>
          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--brand-saffron)' }}>{'\u20B9'}{totalForecast.toLocaleString('en-IN')}</p>
        </div>
      </div>
    </motion.div>
  );
};
