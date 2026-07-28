import React from 'react';
import { motion } from 'framer-motion';
import { Users, MessageSquare } from 'lucide-react';

interface StaffWorkload {
  staffId: string;
  staffName: string;
  count: number;
}

interface WorkloadOverviewWidgetProps {
  data: { totalActive: number; unclaimed: number; byStaff: StaffWorkload[] } | null;
  loading?: boolean;
  onNavigate?: (tab: string) => void;
}

function WorkloadSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-5 w-40 rounded animate-pulse mb-4" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const WorkloadOverviewWidget: React.FC<WorkloadOverviewWidgetProps> = ({ data, loading, onNavigate }) => {
  if (loading) return <WorkloadSkeleton />;

  if (!data) return null;

  const sorted = [...data.byStaff].sort((a, b) => b.count - a.count);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover p-5"
      style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Conversation Workload</h2>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--app-bg-soft)' }}>
          <Users className="h-4 w-4" style={{ color: 'var(--info-blue)' }} />
          <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--app-text)' }}>{data.totalActive}</span>
          <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>active</span>
        </div>
        {data.unclaimed > 0 && (
          <button
            onClick={() => onNavigate?.('inbox')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: 'rgba(200,90,50,0.08)', border: '1px solid rgba(200,90,50,0.15)' }}
          >
            <MessageSquare className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--brand-saffron)' }}>{data.unclaimed}</span>
            <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>unclaimed</span>
          </button>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((staff, idx) => {
            const maxCount = sorted[0].count || 1;
            const barWidth = Math.max(8, (staff.count / maxCount) * 100);
            return (
              <motion.div
                key={staff.staffId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ backgroundColor: 'var(--app-bg-soft)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>{staff.staffName}</span>
                    <span className="text-xs font-semibold tabular-nums ml-2" style={{ color: 'var(--app-text)' }}>{staff.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: 'var(--brand-saffron)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.06 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 && data.unclaimed === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No active conversations right now
        </p>
      )}
    </motion.div>
  );
};
