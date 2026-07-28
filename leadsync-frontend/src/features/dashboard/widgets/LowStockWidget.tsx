import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

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

function LowStockSkeleton() {
  return (
    <div className="card-hover p-5" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
      <div className="h-5 w-32 rounded animate-pulse mb-3" style={{ backgroundColor: 'var(--app-border)' }} />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--app-border)' }} />
        ))}
      </div>
    </div>
  );
}

export const LowStockWidget: React.FC<LowStockWidgetProps> = ({ data, loading, onNavigate }) => {
  if (loading) return <LowStockSkeleton />;

  if (!data || data.totalLowStock === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover p-5"
      style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--app-text)' }}>Low Stock Alert</h2>
        <button
          onClick={() => onNavigate?.('inventory')}
          className="text-2xs font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--brand-saffron)', backgroundColor: 'rgba(200,90,50,0.06)' }}
        >
          View All
        </button>
      </div>

      <div className="space-y-2">
        {data.items.map((item, idx) => (
          <motion.div
            key={item.variantId}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="flex items-center gap-3 px-3 py-2 rounded-xl"
            style={{ backgroundColor: item.stock === 0 ? 'rgba(239,68,68,0.06)' : 'var(--app-bg-soft)' }}
          >
            <AlertTriangle
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: item.stock === 0 ? '#ef4444' : 'var(--brand-saffron)' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>
                {item.productName}
                {item.variantName !== 'Default' && <span style={{ color: 'var(--app-text-muted)' }}> ({item.variantName})</span>}
              </p>
            </div>
            <span
              className="text-xs font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: item.stock === 0 ? 'rgba(239,68,68,0.1)' : 'rgba(200,90,50,0.1)',
                color: item.stock === 0 ? '#ef4444' : 'var(--brand-saffron)',
              }}
            >
              {item.stock === 0 ? 'Out' : item.stock}
            </span>
          </motion.div>
        ))}
      </div>

      {data.totalLowStock > data.items.length && (
        <p className="text-2xs text-center pt-2" style={{ color: 'var(--app-text-muted)' }}>
          +{data.totalLowStock - data.items.length} more low stock items
        </p>
      )}
    </motion.div>
  );
};
