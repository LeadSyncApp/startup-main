/**
 * Mock data - Industry-agnostic with generic placeholders.
 * Replace with Supabase queries or API calls when integrating.
 *
 * Multi-tenant: All data includes companyId. Filter by company_id in queries:
 *   supabase.from('leads').select('*').eq('company_id', companyId)
 */
import type { Lead, Message, Deal, User, Company } from '../types';

/** Sample companies - generic placeholders for any SME (bakery, retailer, etc.) */
export const mockCompanies: Company[] = [
  { id: 'co1', name: 'Company A', industry: 'retail' },
  { id: 'co2', name: 'Bakery XYZ', industry: 'bakery' },
  { id: 'co3', name: 'Retail Shop 123', industry: 'retail' },
];

/** Dynamic placeholder leads - scope by company_id in real API */
export const mockLeads: Lead[] = [
  {
    id: '1',
    name: 'Priya Sharma',
    email: 'priya@example.com',
    phone: '+91 98765 43210',
    company: 'Customer Business A',
    source: 'website',
    priority: 'high',
    agentAssigned: 'Agent One',
    agentId: 'a1',
    companyId: 'co1',
    createdAt: '2025-02-05T10:00:00Z',
  },
  {
    id: '2',
    name: 'Amit Patel',
    email: 'amit@example.com',
    company: 'Customer Business B',
    source: 'chat',
    priority: 'critical',
    agentAssigned: 'Agent Two',
    agentId: 'a2',
    companyId: 'co1',
    createdAt: '2025-02-06T14:30:00Z',
  },
  {
    id: '3',
    name: 'Sneha Reddy',
    email: 'sneha@example.com',
    company: 'Customer Business C',
    source: 'demo',
    priority: 'medium',
    companyId: 'co1',
    createdAt: '2025-02-07T09:15:00Z',
  },
  {
    id: '4',
    name: 'Vikram Mehta',
    email: 'vikram@example.com',
    company: 'Customer Business D',
    source: 'referral',
    priority: 'high',
    agentAssigned: 'Agent One',
    agentId: 'a1',
    companyId: 'co1',
    createdAt: '2025-02-04T16:00:00Z',
  },
];

/** Shared inbox messages per lead - company_id for multi-tenant; add when integrating Supabase Realtime */
export const mockMessages: Record<string, Message[]> = {
  '1': [
    { id: 'm1', leadId: '1', companyId: 'co1', sender: 'lead', content: 'Hi, I\'m interested in your demo.', timestamp: '2025-02-05T10:05:00Z' },
    { id: 'm2', leadId: '1', companyId: 'co1', sender: 'agent', content: 'Namaste! Happy to help. When works for a call?', timestamp: '2025-02-05T10:15:00Z', agentId: 'a1' },
    { id: 'm3', leadId: '1', companyId: 'co1', sender: 'lead', content: 'How about tomorrow at 2pm?', timestamp: '2025-02-05T10:18:00Z' },
    { id: 'm4', leadId: '1', companyId: 'co1', sender: 'auto', content: 'Thanks! I\'ve scheduled a reminder for our team.', timestamp: '2025-02-05T10:18:30Z' },
  ],
  '2': [
    { id: 'm5', leadId: '2', companyId: 'co1', sender: 'lead', content: 'Need pricing ASAP', timestamp: '2025-02-06T14:35:00Z' },
  ],
};

/** Deals per company - dynamic company-wise breakdown, no hardcoded names */
export const mockDeals: Deal[] = [
  { id: 'd1', leadId: '1', leadName: 'Priya Sharma', company: 'Customer Business A', companyId: 'co1', value: 1200000, stage: 'proposal', agentId: 'a1' },
  { id: 'd2', leadId: '2', leadName: 'Amit Patel', company: 'Customer Business B', companyId: 'co1', value: 3500000, stage: 'negotiation', agentId: 'a2' },
  { id: 'd3', leadId: '4', leadName: 'Vikram Mehta', company: 'Customer Business D', companyId: 'co1', value: 650000, stage: 'closed_won', agentId: 'a1', closedAt: '2025-02-06T12:00:00Z' },
  { id: 'd4', leadId: '1', leadName: 'Priya Sharma', company: 'Customer Business A', companyId: 'co1', value: 500000, stage: 'closed_won', agentId: 'a1', closedAt: '2025-01-15T10:00:00Z' },
  { id: 'd5', leadId: '2', leadName: 'Amit Patel', company: 'Customer Business B', companyId: 'co1', value: 1800000, stage: 'closed_won', agentId: 'a2', closedAt: '2025-02-01T14:00:00Z' },
];

/** Agents with companyId - role-based filtering: Admin sees all, Manager/Agent see filtered data */
export const mockAgents: User[] = [
  { id: 'a1', email: 'agent1@example.com', name: 'Agent One', role: 'manager', companyId: 'co1', avatar: '' },
  { id: 'a2', email: 'agent2@example.com', name: 'Agent Two', role: 'agent', companyId: 'co1', avatar: '' },
  // Agents for other companies (placeholder)
  { id: 'a3', email: 'agent3@bakeryxyz.com', name: 'Baker Agent', role: 'agent', companyId: 'co2' },
];

/** Revenue timeseries placeholder - day/month/year breakdown per company */
export const mockRevenue = {
  co1: {
    daily: [
      { date: '2025-02-01', value: 250000 },
      { date: '2025-02-02', value: 180000 },
      { date: '2025-02-03', value: 220000 },
      { date: '2025-02-04', value: 300000 },
      { date: '2025-02-05', value: 150000 },
      { date: '2025-02-06', value: 200000 },
      { date: '2025-02-07', value: 280000 },
    ],
    monthly: [
      { month: 'Jan', value: 3200000 },
      { month: 'Feb', value: 4500000 },
      { month: 'Mar', value: 3800000 },
    ],
    yearly: [
      { year: '2023', value: 24000000 },
      { year: '2024', value: 29000000 },
      { year: '2025', value: 32000000 },
    ],
  },
  co2: {
    daily: [
      { date: '2025-02-01', value: 12000 },
      { date: '2025-02-02', value: 8000 },
      { date: '2025-02-03', value: 15000 },
    ],
    monthly: [
      { month: 'Jan', value: 80000 },
      { month: 'Feb', value: 95000 },
    ],
    yearly: [
      { year: '2024', value: 900000 },
    ],
  },
};
