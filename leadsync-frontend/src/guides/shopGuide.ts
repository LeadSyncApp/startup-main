import type { PageGuide } from './types';
import {
  BarChart3, Wallet, AlertTriangle, TrendingUp, LayoutDashboard, Download,
} from 'lucide-react';

export const shopGuide: PageGuide = {
  pageId: 'shop',
  pageTitle: 'My Shop',
  sections: [
    {
      id: 'kpi-health-cards',
      title: 'Key Performance Cards',
      description: 'Four cards at the top of your dashboard showing Total Customers, Active Conversations, Total Orders, and Conversion Rate. Each card includes a trend badge showing whether the metric is trending up or down compared to the previous period.',
      whyItMatters: 'Glance at these first every morning — they tell you at a glance whether your business is growing or slipping.',
      icon: BarChart3,
    },
    {
      id: 'collection-stats',
      title: 'Daily Collection Summary',
      description: "Shows today's total collection amount, pending payments, and order counts. Only visible to owners and managers with financial permissions.",
      whyItMatters: 'Track your daily cash flow in real time — follow up on pending payments before they go stale.',
      icon: Wallet,
    },
    {
      id: 'needs-attention',
      title: 'Needs Your Attention',
      description: 'A highlighted alert banner listing urgent items that require action: pending orders, unclaimed conversations, or bot-handled chats needing human takeover. Each alert is a clickable chip that navigates directly to the relevant tab.',
      whyItMatters: 'Do not let urgent items pile up — tap an alert to jump straight to what needs fixing.',
      icon: AlertTriangle,
    },
    {
      id: 'revenue-analytics',
      title: 'Revenue Analytics',
      description: 'A collapsible section containing a bar chart of your daily revenue trend and a forecast card predicting upcoming revenue. Expand or collapse using the chevron button.',
      whyItMatters: 'Use the trend chart to spot busy days and slow periods — plan staffing and promotions around the patterns you see.',
      icon: TrendingUp,
    },
    {
      id: 'operations-overview',
      title: 'Operations Overview',
      description: "Three cards showing your team's current workload, recent orders, and channel breakdown (which platforms drive your sales). Click any card's action link to navigate to the full view.",
      whyItMatters: "Check workload to balance your team's load, and review channel breakdown to double down on your best-performing platforms.",
      icon: LayoutDashboard,
    },
    {
      id: 'export-toolbar',
      title: 'Refresh & Export',
      description: 'The bottom toolbar with a Refresh button to reload all dashboard data, plus Export Orders and Export Leads buttons that download your data as Excel files.',
      whyItMatters: 'Refresh after making changes elsewhere to see updated numbers. Export regularly for bookkeeping or offline analysis.',
      icon: Download,
    },
  ],
};
