import { useState, useEffect } from 'react';
import { authedFetch } from '../../../api/client';

interface ShopDashboardData {
  analyticsDashboard: any;
  analyticsRevenue: any;
  kpis: any;
  agentStats: any;
  alerts: any;
  funnel: any;
}

export function useShopDashboardData() {
  const [data, setData] = useState<ShopDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
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
        ] = await Promise.all([
          authedFetch('/api/analytics/dashboard'),
          authedFetch('/api/analytics/revenue'),
          authedFetch('/api/dashboard/kpis'),
          authedFetch('/api/dashboard/agent-stats'),
          authedFetch('/api/dashboard/alerts'),
          authedFetch('/api/dashboard/funnel'),
        ]);

        if (cancelled) return;

        const [
          analyticsDashboard,
          analyticsRevenue,
          kpis,
          agentStats,
          alerts,
          funnel,
        ] = await Promise.all([
          analyticsDashboardRes.ok ? analyticsDashboardRes.json() : null,
          analyticsRevenueRes.ok ? analyticsRevenueRes.json() : null,
          kpisRes.ok ? kpisRes.json() : null,
          agentStatsRes.ok ? agentStatsRes.json() : null,
          alertsRes.ok ? alertsRes.json() : null,
          funnelRes.ok ? funnelRes.json() : null,
        ]);

        if (cancelled) return;

        setData({
          analyticsDashboard,
          analyticsRevenue,
          kpis,
          agentStats,
          alerts,
          funnel,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
