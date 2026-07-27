import React from 'react';
import { motion } from 'framer-motion';
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

interface MyShopPageProps {
  onNavigate?: (tab: TabID) => void;
}

export const MyShopPage: React.FC<MyShopPageProps> = ({ onNavigate }) => {
  const { data, loading, error } = useShopDashboardData();

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

      {/* Row 2: Alerts — conditional full-width banner */}
      {data?.alerts && (
        <NeedsAttentionWidget alerts={data.alerts} onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined} />
      )}

      {/* Row 3: Revenue + Channels — 2 columns */}
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
          <ChannelBreakdownWidget channels={[]} loading />
        ) : data?.analyticsRevenue ? (
          <ChannelBreakdownWidget channels={data.analyticsRevenue.channelAttribution} />
        ) : <div />}
      </div>

      {/* Row 4: Products + Recent Orders — 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <TopProductsWidget products={[]} loading />
        ) : data?.analyticsDashboard ? (
          <TopProductsWidget products={data.analyticsDashboard.topProducts} />
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
