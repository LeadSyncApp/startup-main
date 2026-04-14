import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  data: { label: string; value: number }[];
  dataKey?: string;
  color?: string;
  height?: number;
}

const ChartCard = ({
  title,
  subtitle,
  data,
  dataKey = 'value',
  color = '#6366F1',
  height = 300
}: ChartCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-background-secondary rounded-xl border border-border p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-sm text-text-secondary mt-1">{subtitle}</p>}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`chartGradient-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748B', fontSize: 11 }}
            tickFormatter={(value) => `₹${value}`}
            dx={-10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161922',
              border: '1px solid #2A2F3A',
              borderRadius: '8px',
              color: '#F8FAFC',
            }}
            formatter={(value: number) => [`₹${value}`, 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#chartGradient-${title})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default ChartCard;
