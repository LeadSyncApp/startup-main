import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { CountUp } from '../../components/ui';
import { getSocket } from '../../lib/socketClient';

export const DailyCollectionStats: React.FC = () => {
  const [stats, setStats] = useState({
    todayCollection: 0,
    pendingPayments: 0,
    paidOrders: 0,
    pendingOrders: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const lastSnapshotRef = useRef<any[]>([]);

  const applyOrders = (orders: any[]) => {
    const today = new Date().toISOString().split('T')[0];
    const todayCollection = orders.filter((o: any) => (o.status === 'PAID' || o.status === 'DELIVERED') && String(o.createdAt || '').startsWith(today)).reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);
    const pendingPayments = orders.filter((o: any) => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PROCESSING').reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0);
    const paidOrders = orders.filter((o: any) => o.status === 'PAID' || o.status === 'DELIVERED').length;
    const pendingOrders = orders.filter((o: any) => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'PROCESSING').length;
    setStats({ todayCollection, pendingPayments, paidOrders, pendingOrders });
    setLastUpdated(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/orders?view=history', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const orders = await response.json();
        lastSnapshotRef.current = orders;
        applyOrders(orders);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const poller = window.setInterval(() => {
      fetchStats();
    }, 20000);

    const socket = getSocket();
    if (socket) {
      const handleOrderEvent = (payload: any) => {
        const order = payload.order || payload;
        const nextOrders = [...lastSnapshotRef.current.filter((item: any) => item.id !== order?.id)];
        if (order?.id) {
          nextOrders.unshift(order);
        }
        lastSnapshotRef.current = nextOrders;
        applyOrders(nextOrders);
      };

      socket.on('order_created', handleOrderEvent);
      socket.on('order_updated', handleOrderEvent);
      socket.on('payment_confirmed', handleOrderEvent);

      return () => {
        socket.off('order_created', handleOrderEvent);
        socket.off('order_updated', handleOrderEvent);
        socket.off('payment_confirmed', handleOrderEvent);
        window.clearInterval(poller);
      };
    }

    return () => window.clearInterval(poller);
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
          <span>Updated {lastUpdated || 'just now'}</span>
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