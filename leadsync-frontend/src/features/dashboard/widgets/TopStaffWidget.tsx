import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, MessageSquare, ShoppingBag } from 'lucide-react';

interface TopStaffWidgetProps {
  staff: { id: string; name: string; conversations: number; orders: number }[];
  loading?: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function StaffSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--app-bg-soft)' }}>
            <div className="h-10 w-10 rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
              <div className="h-3 w-32 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            </div>
            <div className="h-6 w-12 rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const TopStaffWidget: React.FC<TopStaffWidgetProps> = ({ staff, loading }) => {
  if (loading) return <StaffSkeleton />;

  const sorted = [...staff].sort((a, b) => b.orders - a.orders);
  const maxOrders = Math.max(...sorted.map(s => s.orders), 1);

  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Team Leaderboard</h2>
      <div className="space-y-2">
      {sorted.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No staff activity this week yet
        </p>
      )}
      {sorted.map((member, idx) => {
        const barWidth = Math.max(8, (member.orders / maxOrders) * 100);
        const isStar = idx === 0 && member.orders > 0;
        return (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
            style={{ backgroundColor: isStar ? 'rgba(200,90,50,0.06)' : 'var(--app-bg-soft)' }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                backgroundColor: isStar ? 'var(--brand-saffron)' : 'var(--app-border)',
                color: isStar ? 'var(--app-bg)' : 'var(--app-text)',
              }}
            >
              {getInitials(member.name)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                  {member.name}
                </span>
                {isStar && (
                  <span className="inline-flex items-center gap-1 text-2xs font-bold px-1.5 py-0.5 rounded-full bg-[var(--brand-saffron)] text-[var(--app-bg)]">
                    <Trophy className="h-3 w-3" /> Star
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-2xs" style={{ color: 'var(--app-text-muted)' }}>
                <span className="inline-flex items-center gap-1">
                  <ShoppingBag className="h-3 w-3" /> {member.orders} orders
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {member.conversations} chats
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: isStar ? 'var(--brand-saffron)' : 'var(--success-green)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.1 }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
      {sorted.length > 0 && (
        <p className="text-2xs text-center pt-2" style={{ color: 'var(--app-text-muted)' }}>
         Great teamwork this week — {sorted.reduce((sum, s) => sum + s.orders, 0)} orders handled together
        </p>
      )}
      </div>
    </div>
  );
};
