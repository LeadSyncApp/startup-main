import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

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
        const response = await fetch('/api/orders', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
          const orders = await response.json();
          const today = new Date().toISOString().split('T')[0];
          const todayCollection = orders.filter((o: any) => o.status === 'PAID' && o.createdAt.startsWith(today)).reduce((sum: number, o: any) => sum + o.amount, 0);
          const pendingPayments = orders.filter((o: any) => o.status === 'PENDING').reduce((sum: number, o: any) => sum + o.amount, 0);
          const paidOrders = orders.filter((o: any) => o.status === 'PAID').length;
          const pendingOrders = orders.filter((o: any) => o.status === 'PENDING').length;
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
        className="rounded-xl border p-5 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Today's Collection</p>
              <div className="flex items-baseline gap-1 mt-1">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                <span className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
                  {stats.todayCollection.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Paid Orders</p>
            <p className="text-lg font-bold text-green-600">{stats.paidOrders}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-green-600">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Real-time update</span>
        </div>
      </motion.div>

      {/* Pending Payments */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border p-5 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--app-text-muted)' }}>Pending Payments</p>
              <div className="flex items-baseline gap-1 mt-1">
                <IndianRupee className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                <span className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
                  {stats.pendingPayments.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Pending Orders</p>
            <p className="text-lg font-bold text-amber-600">{stats.pendingOrders}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>Awaiting payment</span>
        </div>
      </motion.div>
    </div>
  );
};