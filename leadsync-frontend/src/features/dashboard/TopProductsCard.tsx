import React, { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';

interface TopProduct {
  name: string;
  units: number;
  revenue: number;
  share: number;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const TopProductsCard: React.FC = () => {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/analytics/top-products', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok) throw new Error('Failed to fetch top products');
        const payload = await response.json();
        setProducts(payload.topProducts || []);
      } catch (error) {
        console.error('Top products analytics error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--app-text-muted)' }}>
            Top Products
          </p>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Best sellers</h3>
        </div>
        <div className="rounded-full bg-[var(--brand-saffron-soft)] p-2 text-[var(--brand-saffron)]">
          <ShoppingBag className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="rounded-xl border border-dashed border-[var(--app-border)] p-3 text-sm text-[var(--app-text-muted)]">
            Loading product performance...
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--app-border)] p-3 text-sm text-[var(--app-text-muted)]">
            No product data yet.
          </div>
        ) : (
          products.map((product, index) => (
            <div key={`${product.name}-${index}`} className="flex items-center justify-between rounded-xl bg-[var(--app-bg-soft)] px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{product.name}</p>
                <p className="text-xs text-[var(--app-text-muted)]">{product.units} units • {product.share}% share</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{currencyFormatter.format(product.revenue)}</p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--app-text-muted)]">#{index + 1}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
