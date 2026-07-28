import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, Zap } from 'lucide-react';
import { authedFetch } from '../../api/client';
import { TabID } from '../../components/layouts/MasterDashboardLayout';
import { useShopDashboardData } from './hooks/useShopDashboardData';
import { CollectionStatsWidget } from './widgets/CollectionStatsWidget';
import { NeedsAttentionWidget } from './widgets/NeedsAttentionWidget';
import { HealthCheckWidget } from './widgets/HealthCheckWidget';
import { RevenueTrendWidget } from './widgets/RevenueTrendWidget';
import { TopStaffWidget } from './widgets/TopStaffWidget';
import { ChannelBreakdownWidget } from './widgets/ChannelBreakdownWidget';
import { RecentOrdersWidget } from './widgets/RecentOrdersWidget';
import { RevenueForecastWidget } from './widgets/RevenueForecastWidget';
import { WorkloadOverviewWidget } from './widgets/WorkloadOverviewWidget';
import { LowStockWidget } from './widgets/LowStockWidget';
import { IntegrationHealthWidget } from './widgets/IntegrationHealthWidget';
import { useAuth } from '../auth-tenancy/AuthContext';
import { can } from '../../lib/permissions';

interface MyShopPageProps {
  onNavigate?: (tab: TabID) => void;
}

export const MyShopPage: React.FC<MyShopPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const canViewFinancials = can(user, 'dashboard.financial');
  const { data, loading, error, refetch } = useShopDashboardData();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch(true);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

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
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: 'var(--app-bg-soft)', color: 'var(--app-text-muted)', border: '1px solid var(--app-border)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        {canViewFinancials && (
          <>
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
          </>
        )}
      </div>

      {/* Row 1: Stats overview — full width stacked */}
      <div className="space-y-4">
        {canViewFinancials && <CollectionStatsWidget />}
        {loading ? (
          <HealthCheckWidget kpis={{ leads: 0, conversations: 0, orders: 0, agents: 0 }} conversionRate={0} loading />
        ) : data?.kpis && data?.funnel ? (
          <HealthCheckWidget
            kpis={{
              leads: data.metrics?.metrics?.totalLeads ?? data.kpis.leads,
              conversations: data.kpis.conversations,
              orders: data.metrics?.metrics?.totalOrders ?? data.kpis.orders,
              agents: data.kpis.agents,
            }}
            conversionRate={data.funnel.conversionRate}
          />
        ) : null}
      </div>

      {/* Row 2: Alerts + Workload + Low Stock — conditional */}
      <div className={`grid gap-4 ${data?.lowStock && data.lowStock.totalLowStock > 0 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {data?.alerts && (
          <NeedsAttentionWidget alerts={data.alerts} onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined} />
        )}
        <WorkloadOverviewWidget
          data={data?.conversationSummary ?? null}
          teamMembers={data?.teamMembers ?? null}
          loading={loading}
          onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
        />
        <LowStockWidget
          data={data?.lowStock ?? null}
          loading={loading}
          onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
        />
      </div>

      {/* Row 3: Revenue + Forecast — 2 columns (only when canViewFinancials is true) */}
      {canViewFinancials && (
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
      )}

      {/* Row 4: Channels + Recent Orders */}
      <div className={`grid gap-4 ${canViewFinancials ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {canViewFinancials && (
          loading ? (
            <ChannelBreakdownWidget channels={[]} loading />
          ) : data?.analyticsRevenue ? (
            <ChannelBreakdownWidget channels={data.analyticsRevenue.channelAttribution} />
          ) : <div />
        )}
        {loading ? (
          <RecentOrdersWidget orders={[]} loading />
        ) : data?.analyticsRevenue ? (
          <RecentOrdersWidget orders={data.analyticsRevenue.recentOrders} />
        ) : <div />}
      </div>

      {/* Row 5: Staff leaderboard — full width (only when canViewFinancials is true) */}
      {canViewFinancials && (
        loading ? (
          <TopStaffWidget staff={[]} loading />
        ) : data?.agentStats ? (
          <TopStaffWidget staff={data.agentStats} />
        ) : null
      )}

      {/* Row 6: Compact stat tiles — Integrations + Automation */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntegrationHealthWidget
            data={data?.companyStatus?.company ?? null}
            loading={loading}
          />
          {data?.automationRules && (() => {
            const rules = data.automationRules.rules ?? [];
            const activeCount = rules.filter((r: { isEnabled?: boolean }) => r.isEnabled).length;
            if (activeCount === 0) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-hover p-5 flex items-center gap-4"
                style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
              >
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(167,139,250,0.1)' }}>
                  <Zap className="h-4 w-4" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--app-text)' }}>{activeCount}</p>
                  <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>active automation rules</p>
                </div>
              </motion.div>
            );
          })()}
        </div>
      )}
    </motion.div>
  );
};
