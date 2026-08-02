import React from 'react';
import { motion } from 'framer-motion';
import { Users, MessageSquare, Wifi, ArrowRight } from 'lucide-react';

interface StaffWorkload {
  staffId: string;
  staffName: string;
  count: number;
}

interface WorkloadOverviewWidgetProps {
  data: { totalActive: number; unclaimed: number; byStaff: StaffWorkload[] } | null;
  teamMembers: { members: { isOnline: boolean }[] } | null;
  loading?: boolean;
  onNavigate?: (tab: string) => void;
}

function Skeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="h-4 w-40 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const WorkloadOverviewWidget: React.FC<WorkloadOverviewWidgetProps> = ({ data, teamMembers, loading, onNavigate }) => {
  if (loading) return <Skeleton />;
  if (!data) return null;

  const sorted = [...data.byStaff].sort((a, b) => b.count - a.count).slice(0, 4);
  const agentsOnline = teamMembers?.members?.filter(m => m.isOnline).length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 transition-all duration-200 hover:shadow-sm"
      style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Conversation Workload</h2>
        {onNavigate && (
          <button
            onClick={() => onNavigate('inbox')}
            className="flex items-center gap-1 text-2xs font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--brand-saffron)', backgroundColor: 'rgba(211, 107, 70, 0.06)' }}
          >
            Open Inbox <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--app-bg-soft)' }}>
          <Users className="h-3.5 w-3.5" style={{ color: 'var(--info-blue)' }} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--app-text)' }}>{data.totalActive}</span>
          <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>active</span>
        </div>
        {agentsOnline > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--app-bg-soft)' }}>
            <Wifi className="h-3.5 w-3.5" style={{ color: 'var(--success-green)' }} />
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--app-text)' }}>{agentsOnline}</span>
            <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>online</span>
          </div>
        )}
        {data.unclaimed > 0 && (
          <button
            onClick={() => onNavigate?.('inbox')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: 'rgba(211, 107, 70, 0.06)', border: '1px solid rgba(211, 107, 70, 0.12)' }}
          >
            <MessageSquare className="h-3.5 w-3.5" style={{ color: 'var(--brand-saffron)' }} />
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--brand-saffron)' }}>{data.unclaimed}</span>
            <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>unclaimed</span>
          </button>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="space-y-1.5">
          {sorted.map((staff, idx) => {
            const maxCount = sorted[0].count || 1;
            const barWidth = Math.max(8, (staff.count / maxCount) * 100);
            return (
              <motion.div
                key={staff.staffId}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--app-bg-soft)' }}
              >
                <span className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: 'var(--app-text)' }}>{staff.staffName}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--app-border)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--brand-saffron)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${barWidth}%` }}
                    transition={{ duration: 0.4, delay: idx * 0.05 }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums shrink-0 w-6 text-right" style={{ color: 'var(--app-text)' }}>{staff.count}</span>
              </motion.div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && data.unclaimed === 0 && (
        <p className="text-xs text-center py-3" style={{ color: 'var(--app-text-muted)' }}>
          No active conversations right now
        </p>
      )}
    </motion.div>
  );
};
