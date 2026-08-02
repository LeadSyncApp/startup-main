import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface NeedsAttentionWidgetProps {
  alerts: { urgentLeads: number; pendingOrders: number; botConversations: number };
  onNavigate?: (tab: string) => void;
}

interface AlertItem {
  label: string;
  count: number;
  tab: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
}

export const NeedsAttentionWidget: React.FC<NeedsAttentionWidgetProps> = ({ alerts, onNavigate }) => {
  const items: AlertItem[] = [];

  if (alerts.pendingOrders > 0) {
    items.push({
      label: 'Orders waiting for approval',
      count: alerts.pendingOrders,
      tab: 'orders',
      color: 'var(--brand-saffron)',
      bgColor: 'rgba(211, 107, 70, 0.08)',
      icon: AlertTriangle,
    });
  }
  if (alerts.urgentLeads > 0) {
    items.push({
      label: 'Customers waiting for a reply',
      count: alerts.urgentLeads,
      tab: 'inbox',
      color: 'var(--info-blue)',
      bgColor: 'rgba(58, 75, 70, 0.08)',
      icon: AlertTriangle,
    });
  }
  if (alerts.botConversations > 0) {
    items.push({
      label: 'Conversations handled by bot',
      count: alerts.botConversations,
      tab: 'inbox',
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.08)',
      icon: AlertTriangle,
    });
  }

  if (items.length === 0) return null;

  const totalAlerts = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(211, 107, 70, 0.06) 0%, rgba(211, 107, 70, 0.02) 100%)',
        border: '1px solid rgba(211, 107, 70, 0.15)',
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(211, 107, 70, 0.12)' }}>
              <AlertTriangle className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Needs Your Attention</h3>
              <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>{totalAlerts} item{totalAlerts !== 1 ? 's' : ''} require action</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.tab}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onNavigate?.(item.tab)}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all duration-150 hover:shadow-sm cursor-pointer group/btn"
                  style={{
                    backgroundColor: item.bgColor,
                    border: `1px solid ${item.color}20`,
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                  <span className="text-sm font-semibold" style={{ color: item.color }}>{item.count}</span>
                  <span className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{item.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -ml-1 group-hover/btn:opacity-100 group-hover/btn:ml-0 transition-all duration-150" style={{ color: item.color }} />
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
