import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { CountUp } from '../../../components/ui';

interface CollectionStatsWidgetProps {
  todayCollection?: number;
  pendingPayments?: number;
  paidOrders?: number;
  pendingOrders?: number;
  loading?: boolean;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--app-bg-soft)' }} />
      <div className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--app-bg-soft)' }} />
    </div>
  );
}

export const CollectionStatsWidget: React.FC<CollectionStatsWidgetProps> = ({
  todayCollection = 0,
  pendingPayments = 0,
  paidOrders = 0,
  pendingOrders = 0,
  loading,
}) => {
  if (loading) return <Skeleton />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-tour="daily-stats">
      {/* Today's Collection */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:shadow-md group"
        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
      >
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-[0.07] group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: 'var(--success-green)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(134, 194, 50, 0.1)' }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success-green)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Today's Collection</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                <CountUp value={todayCollection} className="text-2xl font-bold" style={{ color: 'var(--app-text)' }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--success-green)' }}>
              <TrendingUp className="h-3.5 w-3.5" />
              <span>{paidOrders} paid orders</span>
            </div>
            <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>Real-time</span>
          </div>
        </div>
      </motion.div>

      {/* Pending Payments */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:shadow-md group"
        style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
      >
        <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full opacity-[0.07] group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: 'var(--brand-saffron)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--brand-saffron-soft)' }}>
              <Clock className="h-5 w-5" style={{ color: 'var(--brand-saffron)' }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Pending Payments</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                <CountUp value={pendingPayments} className="text-2xl font-bold" style={{ color: 'var(--app-text)' }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--brand-saffron)' }}>
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{pendingOrders} awaiting payment</span>
            </div>
            <span className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>Track closely</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
