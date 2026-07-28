import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { authedFetch } from '../../api/client';
import { TabID } from '../../components/layouts/MasterDashboardLayout';
import { useShopDashboardData } from './hooks/useShopDashboardData';
import { CollectionStatsWidget } from './widgets/CollectionStatsWidget';
import { NeedsAttentionWidget } from './widgets/NeedsAttentionWidget';
import { HealthCheckWidget } from './widgets/HealthCheckWidget';
import { RevenueTrendWidget } from './widgets/RevenueTrendWidget';
import { TopProductsWidget } from './widgets/TopProductsWidget';
import { TopStaffWidget } from './widgets/TopStaffWidget';
import { ChannelBreakdownWidget } from './widgets/ChannelBreakdownWidget';
import { RecentOrdersWidget } from './widgets/RecentOrdersWidget';
import { RevenueForecastWidget } from './widgets/RevenueForecastWidget';
import { WorkloadOverviewWidget } from './widgets/WorkloadOverviewWidget';

interface MyShopPageProps {
  onNavigate?: (tab: TabID) => void;
}

export const MyShopPage: React.FC<MyShopPageProps> = ({ onNavigate }) => {
  const { data, loading, error } = useShopDashboardData();

  const handleExport = useCallback(async (endpoint: string, filename: string) => {
    try {
      const res = await authedFetch(endpoint);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore export failures
    }
  }, []);

  return (
    <motion.div
      key="shop-tab"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="space-y-4"
    >
      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          Some dashboard data couldn't load. Showing what's available.
        </div>
      )}

      {/* Export buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport('/api/analytics/export', 'leadsync-orders.xlsx')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--app-bg-soft)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)' }}
        >
          <Download className="h-3.5 w-3.5" />
          Export Orders
        </button>
        <button
          onClick={() => handleExport('/api/analytics/export-leads', 'leadsync-leads.xlsx')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--app-bg-soft)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)' }}
        >
          <Download className="h-3.5 w-3.5" />
          Export Leads
        </button>
      </div>

      {/* Row 1: Stats overview — full width stacked */}
      <div className="space-y-4">
        <CollectionStatsWidget />
        {loading ? (
          <HealthCheckWidget kpis={{ leads: 0, conversations: 0, orders: 0, agents: 0 }} conversionRate={0} loading />
        ) : data?.kpis && data?.funnel ? (
          <HealthCheckWidget
            kpis={{ leads: data.kpis.leads, conversations: data.kpis.conversations, orders: data.kpis.orders, agents: data.kpis.agents }}
            conversionRate={data.funnel.conversionRate}
          />
        ) : null}
      </div>

      {/* Row 2: Alerts + Workload — conditional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data?.alerts && (
          <NeedsAttentionWidget alerts={data.alerts} onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined} />
        )}
        <WorkloadOverviewWidget
          data={data?.conversationSummary ?? null}
          loading={loading}
          onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
        />
      </div>

      {/* Row 3: Revenue + Forecast — 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <RevenueTrendWidget trend={null} chart={[]} loading />
        ) : data?.analyticsRevenue && data?.analyticsDashboard ? (
          <RevenueTrendWidget
            trend={data.analyticsRevenue.trend}
            chart={data.analyticsDashboard.revenueChart}
          />
        ) : <div />}
        {loading ? (
          <RevenueForecastWidget forecast={null} loading />
        ) : data?.forecast ? (
          <RevenueForecastWidget forecast={data.forecast} />
        ) : <div />}
      </div>

      {/* Row 4: Channels + Recent Orders — 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <ChannelBreakdownWidget channels={[]} loading />
        ) : data?.analyticsRevenue ? (
          <ChannelBreakdownWidget channels={data.analyticsRevenue.channelAttribution} />
        ) : <div />}
        {loading ? (
          <RecentOrdersWidget orders={[]} loading />
        ) : data?.analyticsRevenue ? (
          <RecentOrdersWidget orders={data.analyticsRevenue.recentOrders} />
        ) : <div />}
      </div>

      {/* Row 5: Staff leaderboard — full width */}
      {loading ? (
        <TopStaffWidget staff={[]} loading />
      ) : data?.agentStats ? (
        <TopStaffWidget staff={data.agentStats} />
      ) : null}
    </motion.div>
  );
};
