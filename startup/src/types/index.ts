/**
 * LeadSync CRM - Shared TypeScript types
 * Industry-agnostic multi-tenant support.
 * Replace with Supabase-generated types when integrating backend
 */

export type UserRole = 'admin' | 'manager' | 'agent';

/** Company / tenant - dynamic placeholder; replace with Supabase companies table */
export interface Company {
  id: string;
  name: string;
  industry?: string; // e.g. 'bakery', 'retail', 'ecommerce', 'services'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  /** Company this agent belongs to - for multi-tenant filtering */
  companyId?: string;
}

export type LeadSource = 'website' | 'chat' | 'demo' | 'referral' | 'social' | 'other';
export type LeadPriority = 'low' | 'medium' | 'high' | 'critical';

/** Lead - includes company_id for multi-tenant; all leads scoped per company */
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string; // Lead's own company (e.g. customer business name)
  source: LeadSource;
  priority: LeadPriority;
  agentAssigned?: string;
  agentId?: string;
  /** Multi-tenant: scope leads per company. Replace with Supabase RLS or API filter */
  companyId: string;
  createdAt: string;
  notes?: string;
}

export interface Message {
  id: string;
  leadId: string;
  /** Shared inbox: all agents in company see same messages */
  companyId: string;
  sender: 'lead' | 'agent' | 'auto';
  content: string;
  timestamp: string;
  agentId?: string;
}

export interface Deal {
  id: string;
  leadId: string;
  leadName: string;
  company?: string; // Lead's business
  /** Multi-tenant: scope deals per company */
  companyId: string;
  value: number;
  stage: 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  agentId?: string;
  closedAt?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
