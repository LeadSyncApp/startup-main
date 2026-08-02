import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, MessageSquare, ShoppingBag, ArrowRight } from 'lucide-react';

interface TopStaffWidgetProps {
  staff: { id: string; name: string; conversations: number; orders: number }[];
  loading?: boolean;
  onNavigate?: (tab: string) => void;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Skeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const TopStaffWidget: React.FC<TopStaffWidgetProps> = ({ staff, loading, onNavigate }) => {
  if (loading) return <Skeleton />;

  const sorted = [...staff].sort((a, b) => b.orders - a.orders).slice(0, 5);
  const maxOrders = Math.max(...sorted.map(s => s.orders), 1);

  return (
    <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-sm" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(167, 139, 250, 0.1)' }}>
            <Trophy className="h-3.5 w-3.5" style={{ color: '#a78bfa' }} />
          </div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Team Leaderboard</h2>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-1 text-2xs font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--brand-saffron)', backgroundColor: 'rgba(211, 107, 70, 0.06)' }}
          >
            View All <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {sorted.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No staff activity this week yet
        </p>
      )}

      <div className="space-y-1.5">
        {sorted.map((member, idx) => {
          const barWidth = Math.max(8, (member.orders / maxOrders) * 100);
          const isStar = idx === 0 && member.orders > 0;
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: isStar ? 'rgba(211, 107, 70, 0.05)' : 'var(--app-bg-soft)' }}
            >
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-2xs font-bold shrink-0"
                style={{
                  backgroundColor: isStar ? 'var(--brand-saffron)' : 'var(--app-border)',
                  color: isStar ? 'var(--app-bg)' : 'var(--app-text)',
                }}
              >
                {getInitials(member.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                    {member.name}
                  </span>
                  {isStar && (
                    <Trophy className="h-3 w-3 shrink-0" style={{ color: 'var(--brand-saffron)' }} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-2xs" style={{ color: 'var(--app-text-muted)' }}>
                  <span className="inline-flex items-center gap-0.5">
                    <ShoppingBag className="h-2.5 w-2.5" /> {member.orders}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <MessageSquare className="h-2.5 w-2.5" /> {member.conversations}
                  </span>
                </div>
              </div>

              <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ backgroundColor: 'var(--app-border)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: isStar ? 'var(--brand-saffron)' : 'var(--success-green)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
