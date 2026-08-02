import React from 'react';
import { motion } from 'framer-motion';
import { Users, MessageSquare, ShoppingBag, Target, TrendingUp, TrendingDown } from 'lucide-react';

interface HealthCheckWidgetProps {
  kpis: { leads: number; conversations: number; orders: number; agents: number };
  conversionRate: number;
  loading?: boolean;
  trends?: { leads?: number; conversations?: number; orders?: number; conversion?: number };
}

interface KpiCard {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: number;
  format: 'number' | 'percent';
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--app-bg-soft)' }} />
      ))}
    </div>
  );
}

function TrendBadge({ value }: { value?: number }) {
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isNeutral = value === 0;
  const color = isNeutral ? 'var(--app-text-muted)' : isUp ? 'var(--success-green)' : 'var(--danger-red)';
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-2xs font-semibold px-1.5 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}12`, color }}
    >
      <Icon className="h-3 w-3" />
      {isNeutral ? '0' : `${isUp ? '+' : ''}${value}%`}
    </span>
  );
}

export const HealthCheckWidget: React.FC<HealthCheckWidgetProps> = ({ kpis, conversionRate, loading, trends }) => {
  if (loading) return <Skeleton />;

  const cards: KpiCard[] = [
    {
      label: 'Total Customers',
      value: kpis.leads,
      icon: Users,
      color: 'var(--brand-saffron)',
      bgColor: 'var(--brand-saffron-soft)',
      trend: trends?.leads,
      format: 'number',
    },
    {
      label: 'Active Conversations',
      value: kpis.conversations,
      icon: MessageSquare,
      color: 'var(--info-blue)',
      bgColor: 'rgba(58, 75, 70, 0.08)',
      trend: trends?.conversations,
      format: 'number',
    },
    {
      label: 'Total Orders',
      value: kpis.orders,
      icon: ShoppingBag,
      color: 'var(--success-green)',
      bgColor: 'rgba(134, 194, 50, 0.1)',
      trend: trends?.orders,
      format: 'number',
    },
    {
      label: 'Conversion Rate',
      value: conversionRate,
      icon: Target,
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.1)',
      trend: trends?.conversion,
      format: 'percent',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const displayValue = card.format === 'percent'
          ? `${card.value}%`
          : card.value.toLocaleString('en-IN');

        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.35 }}
            className="relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:shadow-md group"
            style={{
              backgroundColor: 'var(--app-surface)',
              border: '1px solid var(--app-border)',
            }}
          >
            {/* Decorative gradient circle */}
            <div
              className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-[0.07] transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: card.color }}
            />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                  style={{ backgroundColor: card.bgColor }}
                >
                  <Icon className="h-5 w-5" style={{ color: card.color }} />
                </div>
                <TrendBadge value={card.trend} />
              </div>

              <p className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: 'var(--app-text)' }}>
                {displayValue}
              </p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--app-text-muted)' }}>
                {card.label}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
