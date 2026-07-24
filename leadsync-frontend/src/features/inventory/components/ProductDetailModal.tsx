import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, Trash2, Loader2 } from "lucide-react";
import { ProductHistoryChart, PriceHistoryItem, StockHistoryItem } from "./ProductHistoryChart";
import { authedFetch } from "../../../api/client";

interface ProductVariant {
  id: string;
  attributeValue: string;
  price: number;
  stock: number | null;
  stockStatus?: string | null;
  sku?: string | null;
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
  variants: ProductVariant[];
  stockStatus?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductDetailModalProps {
  product: SavedProduct | null;
  companyId?: string;
  onClose: () => void;
  onDelete?: (productId: string) => void;
}

export function ProductDetailModal({ product, companyId, onClose, onDelete }: ProductDetailModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [stockHistory, setStockHistory] = useState<StockHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!product) return;
    setSelectedImage(product.imageUrl || (product.images && product.images[0]?.url) || null);

    // Fetch history logs
    if (companyId && product.id) {
      setLoadingHistory(true);
      authedFetch(`/api/companies/${companyId}/inventory/${product.id}/history`)
        .then(res => (res.ok ? res.json() : Promise.reject("Failed to load history")))
        .then(data => {
          setPriceHistory(data.priceHistory || []);
          setStockHistory(data.stockHistory || []);
        })
        .catch(err => console.error("Error loading history:", err))
        .finally(() => setLoadingHistory(false));
    }
  }, [product, companyId]);

  if (!product) return null;

  const galleryImages = product.images && product.images.length > 0
    ? product.images.map(img => img.url)
    : product.imageUrl
    ? [product.imageUrl]
    : [];

  const renderStockBadge = () => {
    const status = product.stockStatus;
    if (status === "IN_STOCK") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
          In Stock
        </span>
      );
    }
    if (status === "LOW_STOCK") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
          Low Stock
        </span>
      );
    }
    if (status === "OUT_OF_STOCK") {
      return (
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-600 border border-red-500/30">
          Out of Stock
        </span>
      );
    }
    // Null stock -> Restaurant / Service fallback
    return (
      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/30">
        On-demand / Service
      </span>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="w-full max-w-3xl rounded-3xl shadow-2xl border overflow-hidden my-8"
          style={{ backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)" }}
        >
          {/* Modal Header */}
          <div className="p-6 border-b flex items-start justify-between" style={{ borderColor: "var(--app-border)" }}>
            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold font-sans" style={{ color: "var(--app-text)" }}>
                  {product.name}
                </h2>
                {renderStockBadge()}
              </div>
              <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "var(--app-text-muted)" }}>
                <span>SKU: {product.sku || "—"}</span>
                <span>•</span>
                <span>Base Price: ₹{product.basePrice}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 transition cursor-pointer"
              style={{ color: "var(--app-text-muted)" }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Gallery & Specs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Gallery */}
              <div className="space-y-3">
                <div
                  className="w-full h-56 rounded-2xl overflow-hidden border flex items-center justify-center relative"
                  style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}
                >
                  {selectedImage ? (
                    <img src={selectedImage} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Package className="h-10 w-10" />
                      <span className="text-xs">No image provided</span>
                    </div>
                  )}
                </div>

                {galleryImages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(img)}
                        className={`h-14 w-14 rounded-xl border overflow-hidden shrink-0 transition cursor-pointer ${
                          selectedImage === img ? "ring-2 ring-brand-saffron border-transparent" : "opacity-70 hover:opacity-100"
                        }`}
                        style={{ borderColor: "var(--app-border)" }}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info & Categories */}
              <div className="space-y-4">
                {/* Description */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "var(--app-text-muted)" }}>
                    Description
                  </h4>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--app-text)" }}>
                    {product.description || "No description specified for this product."}
                  </p>
                </div>

                {/* Categories */}
                {product.categories && product.categories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--app-text-muted)" }}>
                      Categories
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {product.categories.map(cat => (
                        <span
                          key={cat}
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                          style={{
                            backgroundColor: "var(--app-bg-soft)",
                            borderColor: "var(--app-border)",
                            color: "var(--app-text)",
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Variants Breakdown */}
                {product.hasVariants && product.variants && product.variants.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--app-text-muted)" }}>
                      Variants ({product.variants.length})
                    </h4>
                    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--app-border)" }}>
                      <table className="w-full text-xs text-left">
                        <thead className="bg-black/5 uppercase text-[10px] font-bold" style={{ color: "var(--app-text-muted)" }}>
                          <tr>
                            <th className="px-3 py-2">Variant</th>
                            <th className="px-3 py-2">Price</th>
                            <th className="px-3 py-2">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "var(--app-border)" }}>
                          {product.variants.map(v => (
                            <tr key={v.id}>
                              <td className="px-3 py-2 font-medium" style={{ color: "var(--app-text)" }}>
                                {v.attributeValue}
                              </td>
                              <td className="px-3 py-2 font-bold" style={{ color: "var(--brand-saffron)" }}>
                                ₹{v.price}
                              </td>
                              <td className="px-3 py-2">
                                {v.stock !== null ? (
                                  <span className="font-semibold">{v.stock} units</span>
                                ) : (
                                  <span className="text-gray-400">On-demand</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Price & Stock History Section */}
            <div className="pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-6 gap-2 text-xs" style={{ color: "var(--app-text-muted)" }}>
                  <Loader2 className="h-4 w-4 animate-spin text-brand-saffron" />
                  <span>Loading product history logs...</span>
                </div>
              ) : (
                <ProductHistoryChart priceHistory={priceHistory} stockHistory={stockHistory} />
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-black/5 border-t flex items-center justify-between" style={{ borderColor: "var(--app-border)" }}>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete this product?")) {
                  onDelete?.(product.id);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Delete Product
            </button>
            <button
              onClick={onClose}
              className="btn-ghost text-xs px-4 py-2 font-medium"
            >
              Close Details
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
