import { useQuery } from '@tanstack/react-query';
import { authedFetch, getCompanyId } from '../../../api/client';

// Priority 1: KPIs + Alerts (above the fold)
export function useDashboardKPIs() {
  return useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async () => {
      const [kpisRes, metricsRes, funnelRes] = await Promise.all([
        authedFetch('/api/dashboard/kpis'),
        authedFetch('/api/dashboard/metrics'),
        authedFetch('/api/dashboard/funnel'),
      ]);
      const [kpis, metrics, funnel] = await Promise.all([
        kpisRes.ok ? kpisRes.json() : null,
        metricsRes.ok ? metricsRes.json() : null,
        funnelRes.ok ? funnelRes.json() : null,
      ]);
      return { kpis, metrics, funnel };
    },
    staleTime: 60_000,
  });
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: async () => {
      const res = await authedFetch('/api/dashboard/alerts');
      return res.ok ? res.json() : null;
    },
    staleTime: 30_000,
  });
}

// Priority 2: Revenue charts + orders
export function useDashboardRevenue() {
  return useQuery({
    queryKey: ['dashboard', 'revenue'],
    queryFn: async () => {
      const [analyticsDashboardRes, analyticsRevenueRes] = await Promise.all([
        authedFetch('/api/analytics/dashboard'),
        authedFetch('/api/analytics/revenue'),
      ]);
      const [analyticsDashboard, analyticsRevenue] = await Promise.all([
        analyticsDashboardRes.ok ? analyticsDashboardRes.json() : null,
        analyticsRevenueRes.ok ? analyticsRevenueRes.json() : null,
      ]);
      return { analyticsDashboard, analyticsRevenue };
    },
    staleTime: 60_000,
  });
}

export function useDashboardForecast() {
  return useQuery({
    queryKey: ['dashboard', 'forecast'],
    queryFn: async () => {
      const res = await authedFetch('/api/dashboard/forecast');
      return res.ok ? res.json() : null;
    },
    staleTime: 120_000,
  });
}

// Priority 3: Workload + staff + secondary
export function useDashboardWorkload() {
  return useQuery({
    queryKey: ['dashboard', 'workload'],
    queryFn: async () => {
      const [convRes, teamRes] = await Promise.all([
        authedFetch('/api/dashboard/conversation-summary'),
        authedFetch('/api/team/members'),
      ]);
      const [conversationSummary, teamMembers] = await Promise.all([
        convRes.ok ? convRes.json() : null,
        teamRes.ok ? teamRes.json() : null,
      ]);
      return { conversationSummary, teamMembers };
    },
    staleTime: 30_000,
  });
}

export function useDashboardAgentStats() {
  return useQuery({
    queryKey: ['dashboard', 'agentStats'],
    queryFn: async () => {
      const res = await authedFetch('/api/dashboard/agent-stats');
      return res.ok ? res.json() : null;
    },
    staleTime: 60_000,
  });
}

// Priority 3: Integrations + automation + low stock
export function useDashboardIntegrations() {
  return useQuery({
    queryKey: ['dashboard', 'integrations'],
    queryFn: async () => {
      const [statusRes, autoRes] = await Promise.all([
        authedFetch('/api/company/status'),
        getCompanyId()
          ? authedFetch(`/api/automation/conversational-rules/${getCompanyId()}`)
          : Promise.resolve(null),
      ]);
      const [companyStatus, automationRules] = await Promise.all([
        statusRes.ok ? statusRes.json() : null,
        autoRes && autoRes.ok ? autoRes.json() : null,
      ]);
      return { companyStatus, automationRules };
    },
    staleTime: 120_000,
  });
}

export function useDashboardLowStock() {
  return useQuery({
    queryKey: ['dashboard', 'lowStock'],
    queryFn: async () => {
      const res = await authedFetch('/api/dashboard/low-stock');
      return res.ok ? res.json() : null;
    },
    staleTime: 60_000,
  });
}

// Collection stats - uses existing metrics endpoint instead of fetching all orders
export function useCollectionStats() {
  return useQuery({
    queryKey: ['dashboard', 'collectionStats'],
    queryFn: async () => {
      const res = await authedFetch('/api/dashboard/metrics');
      if (!res.ok) return null;
      const data = await res.json();
      return {
        todayCollection: data?.metrics?.todayCollection ?? 0,
        pendingPayments: data?.metrics?.pendingPayments ?? 0,
        paidOrders: data?.metrics?.paidOrders ?? 0,
        pendingOrders: data?.metrics?.pendingOrders ?? 0,
      };
    },
    staleTime: 60_000,
  });
}
