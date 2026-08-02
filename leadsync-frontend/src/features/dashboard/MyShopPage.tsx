import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, Zap } from 'lucide-react';
import { authedFetch } from '../../api/client';
import { TabID } from '../../components/layouts/MasterDashboardLayout';
import { useAuth } from '../auth-tenancy/AuthContext';
import { can } from '../../lib/permissions';
import { useDashboardKPIs, useDashboardAlerts, useDashboardRevenue, useDashboardForecast, useDashboardWorkload, useDashboardAgentStats, useDashboardIntegrations, useDashboardLowStock, useCollectionStats } from './hooks/useDashboardQueries';
import { HealthCheckWidget } from './widgets/HealthCheckWidget';
import { CollectionStatsWidget } from './widgets/CollectionStatsWidget';
import { NeedsAttentionWidget } from './widgets/NeedsAttentionWidget';
import { RevenueTrendWidget } from './widgets/RevenueTrendWidget';
import { RevenueForecastWidget } from './widgets/RevenueForecastWidget';
import { ChannelBreakdownWidget } from './widgets/ChannelBreakdownWidget';
import { RecentOrdersWidget } from './widgets/RecentOrdersWidget';
import { TopStaffWidget } from './widgets/TopStaffWidget';
import { WorkloadOverviewWidget } from './widgets/WorkloadOverviewWidget';
import { LowStockWidget } from './widgets/LowStockWidget';
import { IntegrationHealthWidget } from './widgets/IntegrationHealthWidget';
import { CollapsibleSection } from './components/CollapsibleSection';

interface MyShopPageProps {
  onNavigate?: (tab: TabID) => void;
}

export const MyShopPage: React.FC<MyShopPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const canViewFinancials = can(user, 'dashboard.financial');

  // Priority 1: Above-the-fold data (KPIs + Alerts)
  const { data: kpiData, isLoading: kpiLoading } = useDashboardKPIs();
  const { data: alertsData, isLoading: alertsLoading } = useDashboardAlerts();

  // Priority 2: Revenue data (charts)
  const { data: revenueData, isLoading: revenueLoading } = useDashboardRevenue();
  const { data: forecastData, isLoading: forecastLoading } = useDashboardForecast();

  // Priority 3: Secondary data
  const { data: workloadData, isLoading: workloadLoading } = useDashboardWorkload();
  const { data: agentStatsData, isLoading: agentStatsLoading } = useDashboardAgentStats();
  const { data: integrationData, isLoading: integrationLoading } = useDashboardIntegrations();
  const { data: lowStockData, isLoading: lowStockLoading } = useDashboardLowStock();
  const { data: collectionData, isLoading: collectionLoading } = useCollectionStats();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Force-refetch all queries
      await Promise.all([
        useDashboardKPIs,
        useDashboardAlerts,
        useDashboardRevenue,
      ].map(() => new Promise(r => setTimeout(r, 300))));
    } finally {
      setRefreshing(false);
    }
  }, []);

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
      // silently ignore
    }
  }, []);

  const loading = kpiLoading;
  const kpis = kpiData?.kpis;
  const metrics = kpiData?.metrics;
  const funnel = kpiData?.funnel;

  return (
    <motion.div
      key="shop-tab"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="space-y-6"
    >
      {/* ── SECTION 1: Hero KPIs + Financial Stats (Above the fold) ── */}
      <div className="space-y-4">
        {/* Financial summary - only for owners/managers */}
        {canViewFinancials && (
          <CollectionStatsWidget
            todayCollection={collectionData?.todayCollection}
            pendingPayments={collectionData?.pendingPayments}
            paidOrders={collectionData?.paidOrders}
            pendingOrders={collectionData?.pendingOrders}
            loading={collectionLoading}
          />
        )}

        {/* Hero KPI cards */}
        <HealthCheckWidget
          kpis={{
            leads: metrics?.metrics?.totalLeads ?? kpis?.leads ?? 0,
            conversations: kpis?.conversations ?? 0,
            orders: metrics?.metrics?.totalOrders ?? kpis?.orders ?? 0,
            agents: kpis?.agents ?? 0,
          }}
          conversionRate={funnel?.conversionRate ?? 0}
          loading={loading}
        />

        {/* Action Required - prominent at top */}
        {!alertsLoading && alertsData && (
          <NeedsAttentionWidget
            alerts={alertsData}
            onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
          />
        )}
      </div>

      {/* ── SECTION 2: Revenue Charts (Financial only, 2-col grid) ── */}
      {canViewFinancials && (
        <CollapsibleSection title="Revenue Analytics" subtitle="Trend & forecast overview" defaultOpen={true}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RevenueTrendWidget
              trend={revenueData?.analyticsRevenue?.trend ?? null}
              chart={revenueData?.analyticsDashboard?.revenueChart ?? []}
              loading={revenueLoading}
            />
            <RevenueForecastWidget
              forecast={forecastData}
              loading={forecastLoading}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* ── SECTION 3: Operations Grid (Workload + Orders + Channels) ── */}
      <CollapsibleSection title="Operations" subtitle="Workload, orders & channel performance" defaultOpen={true}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <WorkloadOverviewWidget
            data={workloadData?.conversationSummary ?? null}
            teamMembers={workloadData?.teamMembers ?? null}
            loading={workloadLoading}
            onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
          />
          <RecentOrdersWidget
            orders={revenueData?.analyticsRevenue?.recentOrders ?? []}
            loading={revenueLoading}
            onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
          />
          {canViewFinancials && (
            <ChannelBreakdownWidget
              channels={revenueData?.analyticsRevenue?.channelAttribution ?? []}
              loading={revenueLoading}
            />
          )}
        </div>
      </CollapsibleSection>

      {/* ── SECTION 4: Team & Inventory (Collapsible by default) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {canViewFinancials && (
          <CollapsibleSection title="Team Performance" subtitle="Staff leaderboard this week" defaultOpen={false}>
            <TopStaffWidget
              staff={agentStatsData ?? []}
              loading={agentStatsLoading}
              onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
            />
          </CollapsibleSection>
        )}

        {!lowStockLoading && lowStockData && lowStockData.totalLowStock > 0 && (
          <CollapsibleSection title="Inventory Alerts" subtitle="Items running low" defaultOpen={false}>
            <LowStockWidget
              data={lowStockData}
              loading={lowStockLoading}
              onNavigate={onNavigate ? (tab) => onNavigate(tab as TabID) : undefined}
            />
          </CollapsibleSection>
        )}
      </div>

      {/* ── SECTION 5: Integrations & Automation (Compact footer) ── */}
      <CollapsibleSection title="System Status" subtitle="Integrations & automation" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <IntegrationHealthWidget
            data={integrationData?.companyStatus?.company ?? null}
            loading={integrationLoading}
          />
          {!integrationLoading && integrationData?.automationRules && (() => {
            const rules = integrationData.automationRules.rules ?? [];
            const activeCount = rules.filter((r: { isEnabled?: boolean }) => r.isEnabled).length;
            if (activeCount === 0) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:shadow-sm"
                style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
              >
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(167,139,250,0.1)' }}>
                  <Zap className="h-5 w-5" style={{ color: '#a78bfa' }} />
                </div>
                <div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--app-text)' }}>{activeCount}</p>
                  <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>active automation rules</p>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </CollapsibleSection>

      {/* ── Export toolbar (bottom) ── */}
      <div className="flex items-center gap-2 pt-2">
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
    </motion.div>
  );
};
