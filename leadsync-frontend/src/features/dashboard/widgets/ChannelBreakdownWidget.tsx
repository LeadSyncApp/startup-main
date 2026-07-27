import React from 'react';
import { motion } from 'framer-motion';

interface ChannelBreakdownWidgetProps {
  channels: { channel: string; revenue: number; orders: number; percentage: number }[];
  loading?: boolean;
}

const channelColors: Record<string, string> = {
  WHATSAPP: '#25D366',
  INSTAGRAM: '#E1306C',
  TELEGRAM: '#0088cc',
  WEBSITE: '#6366f1',
  SMS: '#f59e0b',
  UNKNOWN: 'var(--app-text-muted)',
};

const channelLabels: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  TELEGRAM: 'Telegram',
  WEBSITE: 'Website',
  SMS: 'SMS',
  UNKNOWN: 'Other',
};

function ChannelSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-4 w-32 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        <div className="h-3 rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
              <div className="h-3 w-14 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ChannelBreakdownWidget: React.FC<ChannelBreakdownWidgetProps> = ({ channels, loading }) => {
  if (loading) return <ChannelSkeleton />;

  const sorted = [...channels].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Revenue by Channel</h2>
      <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No channel data available
        </p>
      )}

      {sorted.length > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--app-border)' }}>
          {sorted.map((ch, i) => (
            <motion.div
              key={ch.channel}
              className="h-full"
              style={{ backgroundColor: channelColors[ch.channel] || channelColors.UNKNOWN }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(ch.percentage, 2)}%` }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {sorted.map(ch => (
          <div key={ch.channel} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: channelColors[ch.channel] || channelColors.UNKNOWN }}
            />
            <span style={{ color: 'var(--app-text)' }}>
              {channelLabels[ch.channel] || ch.channel}
            </span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--app-text)' }}>
              {ch.percentage}%
            </span>
            <span className="tabular-nums" style={{ color: 'var(--app-text-muted)' }}>
              (₹{ch.revenue.toLocaleString('en-IN')})
            </span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
};
