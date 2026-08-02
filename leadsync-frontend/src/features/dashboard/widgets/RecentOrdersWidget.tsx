import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, ArrowRight } from 'lucide-react';

interface RecentOrdersWidgetProps {
  orders: { customer: string; amount: number; date: Date | string; status: string }[];
  loading?: boolean;
  onNavigate?: (tab: string) => void;
}

function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const statusStyles: Record<string, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(134, 194, 50, 0.1)', color: 'var(--success-green)' },
  DELIVERED: { bg: 'rgba(134, 194, 50, 0.1)', color: 'var(--success-green)' },
  PENDING: { bg: 'rgba(211, 107, 70, 0.08)', color: 'var(--brand-saffron)' },
};

function Skeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const RecentOrdersWidget: React.FC<RecentOrdersWidgetProps> = ({ orders, loading, onNavigate }) => {
  if (loading) return <Skeleton />;

  const displayOrders = orders.slice(0, 5);

  return (
    <div className="rounded-2xl p-5 transition-all duration-200 hover:shadow-sm" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Recent Orders</h2>
        {onNavigate && (
          <button
            onClick={() => onNavigate('orders')}
            className="flex items-center gap-1 text-2xs font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--brand-saffron)', backgroundColor: 'rgba(211, 107, 70, 0.06)' }}
          >
            View All <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="space-y-0.5">
      {displayOrders.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No recent orders
        </p>
      )}
      {displayOrders.map((order, idx) => {
        const style = statusStyles[order.status] || statusStyles.PENDING;
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>
                {order.customer}
              </p>
              <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>
                {timeAgo(order.date)}
              </p>
            </div>
            <div className="flex items-center gap-0.5 tabular-nums shrink-0">
              <IndianRupee className="h-2.5 w-2.5" style={{ color: 'var(--app-text-muted)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
                {order.amount.toLocaleString('en-IN')}
              </span>
            </div>
            <span
              className="text-2xs font-semibold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {order.status}
            </span>
          </motion.div>
        );
      })}
      </div>
    </div>
  );
};
