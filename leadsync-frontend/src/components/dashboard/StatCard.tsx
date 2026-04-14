import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import CountUp from 'react-countup';

interface StatCardProps {
  label: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: number; // Percentage, e.g., 12 for +12%
  trendLabel?: string;
  icon: React.ReactNode;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'violet';
  delay?: number;
}

const colorMap = {
  indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/20',
  emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
  amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20',
  rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20',
  blue: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
  violet: 'from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/20',
};

const StatCard = ({
  label,
  value,
  prefix = '',
  suffix = '',
  trend,
  trendLabel,
  icon,
  color = 'indigo',
  delay = 0
}: StatCardProps) => {
  const numericValue = typeof value === 'number' ? value : parseInt(value as string) || 0;
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-xl bg-background-secondary border border-border p-6 group cursor-default"
    >
      {/* Gradient background on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorMap[color]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="relative z-10">
        {/* Header: Icon + Trend */}
        <div className="flex items-center justify-between mb-4">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorMap[color]} flex items-center justify-center border`}>
            {icon}
          </div>

          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-text-muted'}`}>
              {isPositive && <ArrowUpRight size={14} />}
              {isNegative && <ArrowDownRight size={14} />}
              {!isPositive && !isNegative && <Minus size={14} />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>

        {/* Value */}
        <div className="space-y-1">
          <p className="text-2xl font-bold text-text-primary tracking-tight">
            <CountUp
              end={numericValue}
              duration={1.5}
              prefix={prefix}
              suffix={suffix}
              separator=","
            />
          </p>
          <p className="text-sm text-text-secondary">{label}</p>
        </div>

        {/* Trend Label */}
        {trendLabel && (
          <p className="mt-3 text-xs text-text-muted">{trendLabel}</p>
        )}
      </div>

      {/* Bottom accent line */}
      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-brand opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    </motion.div>
  );
};

export default StatCard;
