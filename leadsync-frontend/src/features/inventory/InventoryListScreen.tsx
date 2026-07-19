/**
 * Inventory List Screen - Shows saved products with option to add new
 * Business-agnostic: displays variants generically
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plus, ShoppingBag, RefreshCw, ChevronRight, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProductVariant {
  id: string;
  attributeValue: string;
  price: number;
  stock: number | null;
  stockStatus?: string | null;
}

interface SavedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string | null;
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

const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(stock: number | null): string | null {
  if (stock === null) return null;
  if (stock === 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

function StockBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    IN_STOCK: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
    LOW_STOCK: { bg: "rgba(245, 158, 11, 0.15)", text: "#d97706", border: "rgba(245, 158, 11, 0.3)" },
    OUT_OF_STOCK: { bg: "rgba(239, 68, 68, 0.15)", text: "#dc2626", border: "rgba(239, 68, 68, 0.3)" },
  };
  const c = colors[status] || colors.OUT_OF_STOCK;
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
      {status === "IN_STOCK" ? "In Stock" : status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
    </span>
  );
}

export function InventoryListScreen({ companyId, onAddNew, onSelectProduct }: InventoryListScreenProps) {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteProduct = async (productId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/companies/${companyId}/inventory/${productId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete product");
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setDeletingProductId(null);
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      alert(err.message || "An error occurred while deleting the product");
    } finally {
      setIsDeleting(false);
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
                        {product.sku && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                            {product.sku}
                          </span>
                        )}
                        {(() => {
                          const variantStatuses = product.variants.map(v => v.stockStatus || getStockStatus(v.stock));
                          const hasOutOfStock = variantStatuses.some(s => s === "OUT_OF_STOCK");
                          const hasLowStock = variantStatuses.some(s => s === "LOW_STOCK");
                          const hasAnyTracked = variantStatuses.some(s => s !== null);
                          let productStatus = null;
                          if (hasAnyTracked) {
                            if (hasOutOfStock) productStatus = "OUT_OF_STOCK";
                            else if (hasLowStock) productStatus = "LOW_STOCK";
                            else productStatus = "IN_STOCK";
                          }
                          return productStatus ? <StockBadge status={productStatus} /> : null;
                        })()}
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
                            <StockBadge status={v.stockStatus || getStockStatus(v.stock)} />
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingProductId(product.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-black/5 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-app-text-muted" />
                  </div>
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

      {/* Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm p-6 rounded-2xl shadow-xl border text-center space-y-4"
            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold" style={{ color: 'var(--app-text)' }}>
                Delete Product
              </h3>
              <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingProductId(null)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium transition cursor-pointer hover:bg-black/5"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDeleteProduct(deletingProductId)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium transition cursor-pointer hover:bg-red-700 flex items-center justify-center gap-2"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

