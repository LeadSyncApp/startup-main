import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface NeedsAttentionWidgetProps {
  alerts: { urgentLeads: number; pendingOrders: number; botConversations: number };
  onNavigate?: (tab: string) => void;
}

export const NeedsAttentionWidget: React.FC<NeedsAttentionWidgetProps> = ({ alerts, onNavigate }) => {
  const items: { label: string; count: number; tab: string; color: string }[] = [];

  if (alerts.pendingOrders > 0) {
    items.push({ label: 'orders waiting for approval', count: alerts.pendingOrders, tab: 'orders', color: 'var(--brand-saffron)' });
  }
  if (alerts.urgentLeads > 0) {
    items.push({ label: 'customers waiting for a reply', count: alerts.urgentLeads, tab: 'inbox', color: 'var(--info-blue)' });
  }

  if (items.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2 p-3 rounded-xl"
      style={{ backgroundColor: 'rgba(200,90,50,0.06)', border: '1px solid rgba(200,90,50,0.15)' }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--brand-saffron)' }} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 flex-1">
        {items.map(item => {
          return (
            <span key={item.tab} className="text-sm" style={{ color: 'var(--app-text)' }}>
              <span className="font-semibold">{item.count}</span>{' '}
              <span style={{ color: 'var(--app-text-muted)' }}>{item.label}</span>
            </span>
          );
        })}
      </div>
      {onNavigate && (
        <button
          onClick={() => onNavigate(items[0].tab)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
          style={{ backgroundColor: 'var(--brand-saffron)', color: 'var(--app-bg)' }}
        >
          Go
        </button>
      )}
    </motion.div>
  );
};
