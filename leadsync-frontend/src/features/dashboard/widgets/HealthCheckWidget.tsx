import React from 'react';
import { motion } from 'framer-motion';
import { Users, MessageSquare, ShoppingBag, Target } from 'lucide-react';

interface HealthCheckWidgetProps {
  kpis: { leads: number; conversations: number; orders: number; agents: number };
  conversionRate: number;
  loading?: boolean;
}

interface Pill {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

function PillSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
      ))}
    </div>
  );
}

export const HealthCheckWidget: React.FC<HealthCheckWidgetProps> = ({ kpis, conversionRate, loading }) => {
  if (loading) return <PillSkeleton />;

  const pills: Pill[] = [
    { label: 'Total Customers', value: kpis.leads, icon: Users, color: 'var(--brand-saffron)' },
    { label: 'Active Conversations', value: kpis.conversations, icon: MessageSquare, color: 'var(--info-blue)' },
    { label: 'Total Orders', value: kpis.orders, icon: ShoppingBag, color: 'var(--success-green)' },
    { label: 'Conversion Rate', value: conversionRate, icon: Target, color: '#a78bfa' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {pills.map((pill, idx) => {
        const Icon = pill.icon;
        const displayValue = pill.label === 'Conversion Rate'
          ? `${pill.value}%`
          : pill.value.toLocaleString('en-IN');
        return (
          <motion.div
            key={pill.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="p-3 rounded-xl text-center"
            style={{ backgroundColor: 'var(--app-bg-soft)' }}
          >
            <div className="flex items-center justify-center mb-1.5">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${pill.color}15` }}
              >
                <Icon className="h-4 w-4" style={{ color: pill.color }} />
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--app-text)' }}>
              {displayValue}
            </p>
            <p className="text-2xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              {pill.label}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
};
