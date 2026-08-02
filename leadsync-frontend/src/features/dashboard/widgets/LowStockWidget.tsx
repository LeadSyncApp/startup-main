import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface LowStockItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  stock: number;
  sku: string | null;
}

interface LowStockWidgetProps {
  data: { totalLowStock: number; items: LowStockItem[] } | null;
  loading?: boolean;
  onNavigate?: (tab: string) => void;
}

function Skeleton() {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
      <div className="h-4 w-32 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const LowStockWidget: React.FC<LowStockWidgetProps> = ({ data, loading, onNavigate }) => {
  if (loading) return <Skeleton />;
  if (!data || data.totalLowStock === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 transition-all duration-200 hover:shadow-sm"
      style={{ backgroundColor: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)' }}>
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--brand-saffron)' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Low Stock</h2>
            <p className="text-2xs" style={{ color: 'var(--app-text-muted)' }}>{data.totalLowStock} items</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('inventory')}
          className="flex items-center gap-1 text-2xs font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer hover:opacity-80"
          style={{ color: 'var(--brand-saffron)', backgroundColor: 'rgba(211, 107, 70, 0.06)' }}
        >
          View All <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="space-y-1.5">
        {data.items.slice(0, 3).map((item, idx) => (
          <motion.div
            key={item.variantId}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ backgroundColor: item.stock === 0 ? 'rgba(239,68,68,0.05)' : 'var(--app-bg-soft)' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>
                {item.productName}
                {item.variantName !== 'Default' && <span className="font-normal" style={{ color: 'var(--app-text-muted)' }}> ({item.variantName})</span>}
              </p>
            </div>
            <span
              className="text-2xs font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: item.stock === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(211, 107, 70, 0.1)',
                color: item.stock === 0 ? '#ef4444' : 'var(--brand-saffron)',
              }}
            >
              {item.stock === 0 ? 'Out' : item.stock}
            </span>
          </motion.div>
        ))}
      </div>

      {data.totalLowStock > 3 && (
        <p className="text-2xs text-center pt-2" style={{ color: 'var(--app-text-muted)' }}>
          +{data.totalLowStock - 3} more
        </p>
      )}
    </motion.div>
  );
};
