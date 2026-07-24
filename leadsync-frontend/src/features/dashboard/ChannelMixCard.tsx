import React, { useEffect, useState } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface ChannelContribution {
  channel: string;
  revenue: number;
  orders: number;
  percentage: number;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const COLORS = ['#d4a843', '#5f8575', '#8b5cf6', '#38bdf8', '#f97316', '#ef4444'];

export const ChannelMixCard: React.FC = () => {
  const [channels, setChannels] = useState<ChannelContribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        const response = await fetch('/api/analytics/channel-contributions', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch channel contributions');
        const payload = await response.json();
        setChannels(payload.channelContributions || []);
      } catch (error) {
        console.error('Channel contributions error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--app-text-muted)' }}>
            Channel Mix
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Where revenue comes from</h3>
        </div>
        <div className="rounded-full bg-[var(--brand-saffron-soft)] p-2 text-[var(--brand-saffron)]">
          <TrendingUp className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 h-52">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-sm text-[var(--app-text-muted)]">
            Loading channel mix...
          </div>
        ) : channels.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] text-sm text-[var(--app-text-muted)]">
            No channel data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={channels} dataKey="revenue" nameKey="channel" innerRadius={48} outerRadius={78} paddingAngle={2}>
                {channels.map((entry, index) => (
                  <Cell key={`${entry.channel}-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [currencyFormatter.format(value), 'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-2 space-y-2">
        {channels.slice(0, 4).map((channel, index) => (
          <div key={channel.channel} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-[var(--app-text-muted)]">{channel.channel}</span>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">{channel.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
