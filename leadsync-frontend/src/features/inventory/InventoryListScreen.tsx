/**
 * Inventory List Screen - Shows saved products with option to add new
 * Business-agnostic: displays variants generically
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plus, ShoppingBag, RefreshCw, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProductVariant {
  id: string;
  attributeValue: string;
  price: number;
  stock: number | null;
}

interface SavedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  basePrice: number;
  imageUrl: string | null;
  hasVariants: boolean;
  variantAttributeName: string | null;
  variants: ProductVariant[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InventoryListResponse {
  products: SavedProduct[];
  count: number;
}

interface InventoryListScreenProps {
  companyId?: string;
  onAddNew: () => void;
  onSelectProduct?: (product: SavedProduct) => void;
}

export function InventoryListScreen({ companyId, onAddNew, onSelectProduct }: InventoryListScreenProps) {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/companies/${companyId}/inventory`);
      if (!response.ok) throw new Error("Failed to fetch products");
      const data: InventoryListResponse = await response.json();
      setProducts(data.products);
    } catch (err: any) {
      console.error("Failed to fetch inventory:", err);
      setError(err.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [companyId]);

  const formatTimeAgo = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-saffron-soft text-brand-saffron flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
              Your Inventory
            </h1>
            <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
              {loading ? "Loading..." : `${products.length} product${products.length !== 1 ? 's' : ''} saved`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="btn-ghost text-sm flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddNew}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Products
          </motion.button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-12">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-brand-saffron" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--app-text)' }}>
            No Products Saved
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--app-text-muted)' }}>
            Add your first product to get started
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddNew}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Add Your First Product
          </motion.button>
        </div>
      )}

      {/* Product Grid */}
      <AnimatePresence>
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-4"
          >
            {products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => onSelectProduct?.(product)}
                className="p-4 rounded-xl border transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
              >
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-base" style={{ color: 'var(--app-text)' }}>
                          {product.name}
                        </h3>
                        {product.description && (
                          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                            {product.description}
                          </span>
                        )}
                      {product.hasVariants && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-saffron/20 text-brand-saffron">
                          {product.variants.length} variants
                        </span>
                      )}
                    </div>
                    
                    {/* Show variants generically */}
                    {product.hasVariants && product.variantAttributeName && product.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {product.variants.map((v) => (
                          <span
                            key={v.id}
                            className="text-xs px-2 py-0.5 rounded-full border"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                          >
                            {v.attributeValue}
                            {v.price !== product.basePrice && (
                              <span className="ml-1 font-medium" style={{ color: 'var(--brand-saffron)' }}>
                                ₹{v.price}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-lg font-bold" style={{ color: 'var(--brand-saffron)' }}>
                      ₹{product.basePrice}
                      {!product.hasVariants && product.variants.length === 0 && (
                        <span className="text-xs font-normal ml-2" style={{ color: 'var(--app-text-muted)' }}>
                          base price
                        </span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-app-text-muted" />
                </div>
                
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                    Added {formatTimeAgo(product.createdAt)}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
