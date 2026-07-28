import { useState, useEffect, useCallback, useRef } from 'react';
import { authedFetch, getCompanyId } from '../../../api/client';

interface ShopDashboardData {
  analyticsDashboard: any;
  analyticsRevenue: any;
  kpis: any;
  agentStats: any;
  alerts: any;
  funnel: any;
  forecast: any;
  conversationSummary: any;
  metrics: any;
  teamMembers: any;
  automationRules: any;
  lowStock: any;
  companyStatus: any;
}

export function useShopDashboardData() {
  const [data, setData] = useState<ShopDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchAll = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
        const [
          analyticsDashboardRes,
          analyticsRevenueRes,
          kpisRes,
          agentStatsRes,
          alertsRes,
          funnelRes,
          forecastRes,
          conversationSummaryRes,
          metricsRes,
          teamMembersRes,
          automationRulesRes,
          lowStockRes,
          companyStatusRes,
        ] = await Promise.all([
          authedFetch('/api/analytics/dashboard'),
          authedFetch('/api/analytics/revenue'),
          authedFetch('/api/dashboard/kpis'),
          authedFetch('/api/dashboard/agent-stats'),
          authedFetch('/api/dashboard/alerts'),
          authedFetch('/api/dashboard/funnel'),
          authedFetch('/api/dashboard/forecast'),
          authedFetch('/api/dashboard/conversation-summary'),
          authedFetch('/api/dashboard/metrics'),
          authedFetch('/api/team/members'),
          getCompanyId() ? authedFetch(`/api/automation/conversational-rules/${getCompanyId()}`) : Promise.resolve(null),
          authedFetch('/api/dashboard/low-stock'),
          authedFetch('/api/company/status'),
        ]);

        if (cancelledRef.current) return;

        const [
          analyticsDashboard,
          analyticsRevenue,
          kpis,
          agentStats,
          alerts,
          funnel,
          forecast,
          conversationSummary,
          metrics,
          teamMembers,
          automationRules,
          lowStock,
          companyStatus,
        ] = await Promise.all([
          analyticsDashboardRes.ok ? analyticsDashboardRes.json() : null,
          analyticsRevenueRes.ok ? analyticsRevenueRes.json() : null,
          kpisRes.ok ? kpisRes.json() : null,
          agentStatsRes.ok ? agentStatsRes.json() : null,
          alertsRes.ok ? alertsRes.json() : null,
          funnelRes.ok ? funnelRes.json() : null,
          forecastRes.ok ? forecastRes.json() : null,
          conversationSummaryRes.ok ? conversationSummaryRes.json() : null,
          metricsRes.ok ? metricsRes.json() : null,
          teamMembersRes && teamMembersRes.ok ? teamMembersRes.json() : null,
          automationRulesRes && automationRulesRes.ok ? automationRulesRes.json() : null,
          lowStockRes.ok ? lowStockRes.json() : null,
          companyStatusRes.ok ? companyStatusRes.json() : null,
        ]);

        if (cancelledRef.current) return;

        setData({
          analyticsDashboard,
          analyticsRevenue,
          kpis,
          agentStats,
          alerts,
          funnel,
          forecast,
          conversationSummary,
          metrics,
          teamMembers,
          automationRules,
          lowStock,
          companyStatus,
        });
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAll();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchAll]);

  return { data, loading, error, refetch: fetchAll };
}
