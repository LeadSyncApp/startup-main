/**
 * Inventory List Screen - Redesigned Dashboard Table Layout
 * Features aggregate metrics stats, searchable/sortable data table,
 * category chip filter reuse, and product detail drawer modal.
 */

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Package,
  Plus,
  ShoppingBag,
  RefreshCw,
  Search,
  Trash2,
  Eye,
} from "lucide-react";
import { InventoryStatsHeader } from "./components/InventoryStatsHeader";
import { ProductDetailModal } from "./components/ProductDetailModal";
import { authedFetch } from "../../api/client";

interface ProductVariant {
  id: string;
  attributeValue: string;
  price: number;
  stock: number | null;
  stockStatus?: string | null;
  sku?: string | null;
  attributes?: Record<string, string> | null;
}

interface ProductImage {
  id: string;
  url: string;
  order: number;
}

interface SavedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  categories: string[];
  sku: string | null;
  basePrice: number;
  imageUrl: string | null;
  images?: ProductImage[];
  hasVariants: boolean;
  variantAttributeName: string | null;
  variantAttributeNames?: string[];
  variants: ProductVariant[];
  stockStatus?: string | null;
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

function StockBadge({ status }: { status: string | null }) {
  if (status === "IN_STOCK") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
        In Stock
      </span>
    );
  }
  if (status === "LOW_STOCK") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-500/15 text-amber-600 border-amber-500/30">
        Low Stock
      </span>
    );
  }
  if (status === "OUT_OF_STOCK") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-500/15 text-red-600 border-red-500/30">
        Out of Stock
      </span>
    );
  }
  // Fallback for null stock (e.g. Restaurant / Service items)
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/15 text-blue-600 border-blue-500/30">
      On-demand
    </span>
  );
}

export function InventoryListScreen({ companyId, onAddNew, onSelectProduct }: InventoryListScreenProps) {
  const [products, setProducts] = useState<SavedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name-asc" | "price-asc" | "price-desc" | "date-desc">("date-desc");
  const [activeDetailProduct, setActiveDetailProduct] = useState<SavedProduct | null>(null);

  // Exact category extraction logic preserved from existing InventoryListScreen.tsx
  const allCategories = useMemo(() => {
    return [...new Set(products.flatMap(p => p.categories || []))].sort();
  }, [products]);

  // Combined search, category filter, and sorting
  const processedProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter(p => (p.categories || []).some(c => selectedCategories.includes(c)));
    }

    // Text search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.categories && p.categories.some(c => c.toLowerCase().includes(q)))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "price-asc") return a.basePrice - b.basePrice;
      if (sortBy === "price-desc") return b.basePrice - a.basePrice;
      // default: date-desc
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [products, selectedCategories, searchTerm, sortBy]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory`);
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
      const response = await authedFetch(`/api/companies/${companyId}/inventory/${productId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete product");
      }
      setProducts(prev => prev.filter(p => p.id !== productId));
      setDeletingProductId(null);
      if (activeDetailProduct?.id === productId) {
        setActiveDetailProduct(null);
      }
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

  const calculateTotalStockDisplay = (p: SavedProduct) => {
    if (!p.hasVariants || !p.variants || p.variants.length === 0) {
      return "On-demand";
    }
    const trackedVariants = p.variants.filter(v => v.stock !== null);
    if (trackedVariants.length === 0) return "On-demand";
    const sum = trackedVariants.reduce((acc, v) => acc + (v.stock || 0), 0);
    return `${sum} units`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-brand-saffron-soft text-brand-saffron flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-sans" style={{ color: "var(--app-text)" }}>
              Inventory Management
            </h1>
            <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
              {loading
                ? "Loading inventory..."
                : `${processedProducts.length} product${processedProducts.length !== 1 ? "s" : ""}${
                    selectedCategories.length > 0 || searchTerm ? " (filtered)" : ""
                  }`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddNew}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add Products
          </motion.button>
        </div>
      </div>

      {/* Aggregate Stats Header */}
      {!loading && !error && <InventoryStatsHeader products={products} />}

      {/* Toolbar: Search, Sorting, and Category Pills */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by name, SKU, or category..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-brand-saffron"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--app-text)",
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs font-semibold" style={{ color: "var(--app-text-muted)" }}>
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-xs font-medium px-3 py-2 rounded-xl border transition cursor-pointer focus:outline-none"
              style={{
                backgroundColor: "var(--app-surface)",
                borderColor: "var(--app-border)",
                color: "var(--app-text)",
              }}
            >
              <option value="date-desc">Newest First</option>
              <option value="name-asc">Name (A - Z)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Category Filter Chips — Preserves exact original implementation */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--app-text-muted)" }}>
              Categories:
            </span>
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategories(prev =>
                    prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                  )
                }
                className="text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer"
                style={{
                  backgroundColor: selectedCategories.includes(cat) ? "var(--brand-saffron)" : "var(--app-surface)",
                  color: selectedCategories.includes(cat) ? "#ffffff" : "var(--app-text-muted)",
                  borderColor: selectedCategories.includes(cat) ? "var(--brand-saffron)" : "var(--app-border)",
                }}
              >
                {cat}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="text-[10px] px-2 py-1 rounded-full border transition cursor-pointer"
                style={{ color: "var(--app-text-muted)", borderColor: "var(--app-border)" }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl border text-sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-16 border rounded-2xl" style={{ backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)" }}>
          <ShoppingBag className="h-14 w-14 mx-auto mb-4 text-brand-saffron" />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--app-text)" }}>
            No Products Saved
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--app-text-muted)" }}>
            Add your first inventory product to start tracking stock and pricing.
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

      {/* No Filter Results State */}
      {!loading && !error && products.length > 0 && processedProducts.length === 0 && (
        <div className="text-center py-12 border rounded-2xl" style={{ backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--app-text-muted)" }}>
            No products match the selected criteria.
          </p>
          <button
            onClick={() => {
              setSelectedCategories([]);
              setSearchTerm("");
            }}
            className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer"
            style={{ color: "var(--app-text-muted)", borderColor: "var(--app-border)" }}
          >
            Clear Search & Filters
          </button>
        </div>
      )}

      {/* Product Data Table */}
      {!loading && !error && processedProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border rounded-2xl overflow-hidden shadow-sm"
          style={{ backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs">
              <thead className="bg-black/5 uppercase text-[10px] font-bold tracking-wider" style={{ color: "var(--app-text-muted)" }}>
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Categories</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Base Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--app-border)" }}>
                {processedProducts.map(product => {
                  const stockDisplay = calculateTotalStockDisplay(product);

                  return (
                    <motion.tr
                      key={product.id}
                      whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                      onClick={() => {
                        setActiveDetailProduct(product);
                        onSelectProduct?.(product);
                      }}
                      className="cursor-pointer transition-colors"
                    >
                      {/* Product Name & Thumbnail */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-10 h-10 object-cover rounded-lg border shrink-0"
                              style={{ borderColor: "var(--app-border)" }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center border shrink-0" style={{ borderColor: "var(--app-border)" }}>
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate" style={{ color: "var(--app-text)" }}>
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="text-[11px] truncate max-w-xs" style={{ color: "var(--app-text-muted)" }}>
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SKU Badge */}
                      <td className="px-4 py-3 font-mono">
                        {product.sku ? (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-black/5" style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                            {product.sku}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Category Pills */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {product.categories && product.categories.length > 0 ? (
                            product.categories.slice(0, 2).map(cat => (
                              <span
                                key={cat}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                style={{
                                  backgroundColor: "var(--app-bg-soft)",
                                  borderColor: "var(--app-border)",
                                  color: "var(--app-text-muted)",
                                }}
                              >
                                {cat}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                          {product.categories && product.categories.length > 2 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 text-gray-500">
                              +{product.categories.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Qty */}
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--app-text)" }}>
                        {stockDisplay}
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3 font-bold" style={{ color: "var(--brand-saffron)" }}>
                        ₹{product.basePrice}
                      </td>

                      {/* Stock Status Badge */}
                      <td className="px-4 py-3">
                        <StockBadge status={product.stockStatus ?? null} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveDetailProduct(product)}
                            className="p-1.5 text-gray-400 hover:text-brand-saffron rounded-lg hover:bg-black/5 transition cursor-pointer"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(product.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-black/5 transition cursor-pointer"
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Product Detail Modal */}
      {activeDetailProduct && (
        <ProductDetailModal
          product={activeDetailProduct}
          companyId={companyId}
          onClose={() => setActiveDetailProduct(null)}
          onDelete={handleDeleteProduct}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm p-6 rounded-2xl shadow-xl border text-center space-y-4"
            style={{ backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)" }}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold" style={{ color: "var(--app-text)" }}>
                Delete Product
              </h3>
              <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeletingProductId(null)}
                className="flex-1 px-4 py-2 border rounded-lg text-sm font-medium transition cursor-pointer hover:bg-black/5"
                style={{ borderColor: "var(--app-border)", color: "var(--app-text)" }}
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
