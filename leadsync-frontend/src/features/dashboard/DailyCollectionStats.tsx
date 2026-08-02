import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { CountUp } from '../../components/ui';
import { authedFetch } from '../../api/client';

export const DailyCollectionStats: React.FC = () => {
  const [stats, setStats] = useState({
    todayCollection: 0,
    pendingPayments: 0,
    paidOrders: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await authedFetch('/api/orders');
        if (response.ok) {
          const rawData = await response.json();
          const orders = Array.isArray(rawData) ? rawData : (rawData.data || []);
          const today = new Date().toISOString().split('T')[0];
          const PAID_STATUSES = ['PAID', 'COMPLETED', 'DELIVERED', 'SHIPPED', 'PROCESSING', 'PREPARING', 'READY'];
          const PENDING_STATUSES = ['PENDING', 'NEW', 'BOT_CREATED_ORDER', 'USER_CONFIRMED_PENDING_AGENT'];
          const todayCollection = orders.filter((o: any) => PAID_STATUSES.includes(o.status) && o.createdAt.startsWith(today)).reduce((sum: number, o: any) => sum + o.amount, 0);
          const pendingPayments = orders.filter((o: any) => PENDING_STATUSES.includes(o.status)).reduce((sum: number, o: any) => sum + o.amount, 0);
          const paidOrders = orders.filter((o: any) => PAID_STATUSES.includes(o.status)).length;
          const pendingOrders = orders.filter((o: any) => PENDING_STATUSES.includes(o.status)).length;
          setStats({ todayCollection, pendingPayments, paidOrders, pendingOrders });
        }
      } catch (error) {
        console.error('Fetch stats error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-28 rounded-xl" style={{ backgroundColor: 'var(--app-border)' }} />
        <div className="h-28 rounded-xl" style={{ backgroundColor: 'var(--app-border)' }} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-tour="daily-stats">
      {/* Today's Collection */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--brand-saffron-soft)] text-[var(--success-green)]" style={{ backgroundColor: 'rgba(95, 133, 117, 0.1)' }}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Today's Collection</p>
              <div className="flex items-baseline gap-1 mt-1">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                <CountUp value={stats.todayCollection} className="text-2xl font-bold" style={{ color: 'var(--app-text)' }} />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Paid Orders</p>
            <p className="text-lg font-bold text-[var(--success-green)]">
              <CountUp value={stats.paidOrders} formatter={(v) => String(v)} />
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-[var(--success-green)]">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Real-time update</span>
        </div>
      </motion.div>

      {/* Pending Payments */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--brand-saffron-soft)] text-[var(--brand-saffron)]">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Pending Payments</p>
              <div className="flex items-baseline gap-1 mt-1">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                <CountUp value={stats.pendingPayments} className="text-2xl font-bold" style={{ color: 'var(--app-text)' }} />
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Pending Orders</p>
            <p className="text-lg font-bold text-[var(--brand-saffron)]">
              <CountUp value={stats.pendingOrders} formatter={(v) => String(v)} />
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-[var(--brand-saffron)]">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Awaiting payment</span>
        </div>
      </motion.div>
    </div>
  );
};