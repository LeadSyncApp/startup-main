import { useState, useEffect, useCallback, useRef } from 'react';
import { authedFetch } from '../../../api/client';

interface ShopDashboardData {
  analyticsDashboard: any;
  analyticsRevenue: any;
  kpis: any;
  agentStats: any;
  alerts: any;
  funnel: any;
  forecast: any;
  conversationSummary: any;
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
      ] = await Promise.all([
        authedFetch('/api/analytics/dashboard'),
        authedFetch('/api/analytics/revenue'),
        authedFetch('/api/dashboard/kpis'),
        authedFetch('/api/dashboard/agent-stats'),
        authedFetch('/api/dashboard/alerts'),
        authedFetch('/api/dashboard/funnel'),
        authedFetch('/api/dashboard/forecast'),
        authedFetch('/api/dashboard/conversation-summary'),
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
      ] = await Promise.all([
        analyticsDashboardRes.ok ? analyticsDashboardRes.json() : null,
        analyticsRevenueRes.ok ? analyticsRevenueRes.json() : null,
        kpisRes.ok ? kpisRes.json() : null,
        agentStatsRes.ok ? agentStatsRes.json() : null,
        alertsRes.ok ? alertsRes.json() : null,
        funnelRes.ok ? funnelRes.json() : null,
        forecastRes.ok ? forecastRes.json() : null,
        conversationSummaryRes.ok ? conversationSummaryRes.json() : null,
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
