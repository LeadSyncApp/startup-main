import React from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface TopProductsWidgetProps {
  products: { name: string; count: number }[];
  loading?: boolean;
}

function ProductSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-4 w-36 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-6 w-6 rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
              <div className="h-2 w-full rounded-full animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
            </div>
            <div className="h-4 w-8 rounded animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export const TopProductsWidget: React.FC<TopProductsWidgetProps> = ({ products, loading }) => {
  if (loading) return <ProductSkeleton />;

  const sorted = [...products].sort((a, b) => b.count - a.count);
  const maxCount = Math.max(...sorted.map(p => p.count), 1);

  const rankColors = ['var(--brand-saffron)', 'var(--app-text-muted)', 'var(--app-text-muted)'];

  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--app-text)' }}>Top Products</h2>
      <div className="space-y-3">
      {sorted.length === 0 && (
        <p className="text-sm text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
          No product sales recorded this month
        </p>
      )}
      {sorted.map((product, idx) => {
        const barWidth = Math.max(8, (product.count / maxCount) * 100);
        const isTop = idx === 0 && product.count > 0;
        return (
          <motion.div
            key={product.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-3"
          >
            <span
              className="text-xs font-bold w-6 text-center shrink-0"
              style={{ color: idx < 3 ? rankColors[idx] : 'var(--app-text-muted)' }}
            >
              {idx + 1}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isTop && <Trophy className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--brand-saffron)' }} />}
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--app-text)' }}>
                    {product.name}
                  </span>
                </div>
                <span className="text-xs font-semibold tabular-nums ml-2 shrink-0" style={{ color: 'var(--app-text)' }}>
                  {product.count}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--app-border)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: isTop ? 'var(--brand-saffron)' : 'var(--success-green)',
                    opacity: isTop ? 1 : 0.6,
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
      {sorted.length > 0 && (
        <p className="text-2xs text-center pt-1" style={{ color: 'var(--app-text-muted)' }}>
          {sorted.length} products selling — top item: {sorted[0].name}
        </p>
      )}
      </div>
    </div>
  );
};
