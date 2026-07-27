import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee } from 'lucide-react';

interface RecentOrdersWidgetProps {
  orders: { customer: string; amount: number; date: Date | string; status: string }[];
  loading?: boolean;
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
  PAID: { bg: 'rgba(95,133,117,0.12)', color: 'var(--success-green)' },
  DELIVERED: { bg: 'rgba(95,133,117,0.12)', color: 'var(--success-green)' },
  PENDING: { bg: 'rgba(200,90,50,0.1)', color: 'var(--brand-saffron)' },
};

function OrderSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
              <div className="h-2.5 w-16 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            </div>
            <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            <div className="h-5 w-14 rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const RecentOrdersWidget: React.FC<RecentOrdersWidgetProps> = ({ orders, loading }) => {
  if (loading) return <OrderSkeleton />;

  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Recent Orders</h2>
      <div className="space-y-0.5">
      {orders.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No recent orders
        </p>
      )}
      {orders.map((order, idx) => {
        const style = statusStyles[order.status] || statusStyles.PENDING;
        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="flex items-center gap-3 py-2 px-1 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--app-text)' }}>
                {order.customer}
              </p>
              <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>
                {timeAgo(order.date)}
              </p>
            </div>
            <div className="flex items-center gap-1 tabular-nums shrink-0">
              <IndianRupee className="h-3 w-3" style={{ color: 'var(--app-text-muted)' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>
                {order.amount.toLocaleString('en-IN')}
              </span>
            </div>
            <span
              className="text-2xs font-semibold px-2 py-0.5 rounded-full shrink-0"
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
