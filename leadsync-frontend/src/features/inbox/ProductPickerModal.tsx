/**
 * Product Picker Modal - In-chat product selection for staff
 * Searchable list of products with variant selection
 * Generates payment links and inserts into chat
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, X, Package, CreditCard, Loader2 } from "lucide-react";
import { authedFetch } from "../../api/client";

const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(stock: number | null): string | null {
  if (stock === null) return null;
  if (stock === 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

interface ProductVariant {
  id: string;
  attributeValue: string;
  price: number;
  stock: number | null;
}

interface PickerProduct {
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
}

interface ProductPickerModalProps {
  onClose: () => void;
  onProductSelected: (message: string) => void;
}

export function ProductPickerModal({
  onClose,
  onProductSelected
}: ProductPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PickerProduct | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (!searchTerm.trim()) {
      setProducts([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await authedFetch(
          `/api/companies/search?q=${encodeURIComponent(searchTerm)}`
        );
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  const handleProductClick = (product: PickerProduct) => {
    if (product.hasVariants && product.variants.length > 0) {
      setSelectedProduct(product);
    } else {
      handleSelect(product, null);
    }
  };

  const handleSelect = async (product: PickerProduct, variant: ProductVariant | null) => {
    setGeneratingLink(true);
    try {
      const price = variant ? variant.price : product.basePrice;
      const attrNames = (product as any).variantAttributeNames?.length > 0 
        ? (product as any).variantAttributeNames.join(" / ")
        : (product.variantAttributeName || "Variant");
      const variantLabel = variant
        ? ` (${attrNames}: ${variant.attributeValue})`
        : "";
      const name = product.name;

      // Build a formatted product message for the chat
      const message = `🛍️ *${name}*${variantLabel} — ₹${price}\n\nQuantity: 1\nTotal: ₹${price}`;

      onProductSelected(message);
    } catch (err) {
      console.error("Selection failed:", err);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-saffron" />
            <h3 className="text-sm font-black text-[var(--app-text)]">
              {selectedProduct ? "Select Variant" : "Pick a Product"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--app-bg-soft)] transition cursor-pointer"
          >
            <X className="h-4 w-4 text-[var(--app-text-muted)]" />
          </button>
        </div>

        {/* Search */}
        {!selectedProduct && (
          <div className="px-4 py-3 border-b border-[var(--app-border)]">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--app-surface-alt)] border border-[var(--app-border)]">
              <Search className="h-4 w-4 text-[var(--app-text-muted)]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="flex-1 bg-transparent text-sm text-[var(--app-text)] placeholder-[var(--app-text-muted)] outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand-saffron" />
              <span className="ml-2 text-xs text-[var(--app-text-muted)]">Searching...</span>
            </div>
          )}

          {!loading && searchTerm && products.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-8 w-8 mx-auto mb-2 text-[var(--app-text-muted)]" />
              <p className="text-xs text-[var(--app-text-muted)]">No products found</p>
            </div>
          )}

          {!loading && !searchTerm && (
            <div className="text-center py-8">
              <Search className="h-8 w-8 mx-auto mb-2 text-[var(--app-text-muted)]" />
              <p className="text-xs text-[var(--app-text-muted)]">Type to search products</p>
            </div>
          )}

          {/* Product List */}
          {!loading && !selectedProduct && products.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--app-bg-soft)] transition border-b border-[var(--app-border)] cursor-pointer text-left"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-10 h-10 rounded-lg object-cover bg-[var(--app-surface-alt)]"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[var(--app-surface-alt)] flex items-center justify-center">
                  <Package className="h-5 w-5 text-[var(--app-text-muted)]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--app-text)] truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-brand-saffron">₹{product.basePrice}</span>
                  {product.sku && (
                    <span className="text-[10px] font-mono text-[var(--app-text-muted)]">{product.sku}</span>
                  )}
                  {product.hasVariants && (
                    <span className="text-[10px] text-[var(--app-text-muted)]">
                      {product.variants.length} {product.variantAttributeName || "variants"}
                    </span>
                  )}
                </div>
              </div>
              <CreditCard className="h-4 w-4 text-[var(--app-text-muted)] shrink-0" />
            </button>
          ))}

          {/* Variant Selection */}
          {selectedProduct && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => { setSelectedProduct(null); }}
                  className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
                >
                  ← Back to search
                </button>
              </div>

              <p className="text-xs text-[var(--app-text-muted)]">
                Select {selectedProduct.variantAttributeName || "variant"} for{" "}
                <span className="text-[var(--app-text)] font-bold">{selectedProduct.name}</span>
              </p>

              {selectedProduct.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => handleSelect(selectedProduct, variant)}
                  disabled={variant.stock === 0}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition cursor-pointer ${
                    variant.stock === 0
                      ? "opacity-50 cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-alt)]"
                      : "border-[var(--app-border)] bg-[var(--app-surface-alt)] hover:border-brand-saffron hover:bg-[var(--app-bg-soft)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[var(--app-text)]">{variant.attributeValue}</span>
                    {variant.stock !== null && (
                      (() => {
                        const status = getStockStatus(variant.stock);
                        const colors: Record<string, { bg: string; text: string; border: string }> = {
                          IN_STOCK: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
                          LOW_STOCK: { bg: "rgba(245, 158, 11, 0.15)", text: "#d97706", border: "rgba(245, 158, 11, 0.3)" },
                          OUT_OF_STOCK: { bg: "rgba(239, 68, 68, 0.15)", text: "#dc2626", border: "rgba(239, 68, 68, 0.3)" },
                        };
                        const c = status ? colors[status] : colors.OUT_OF_STOCK;
                        return (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                            {status === "IN_STOCK" ? `${variant.stock} in stock` : status === "LOW_STOCK" ? `Low: ${variant.stock} left` : "Out of stock"}
                          </span>
                        );
                      })()
                    )}
                  </div>
                  <span className="text-sm font-bold text-brand-saffron">₹{variant.price}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {generatingLink && (
          <div className="px-4 py-3 border-t border-[var(--app-border)] flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-brand-saffron" />
            <span className="text-xs text-[var(--app-text-muted)]">Generating payment link...</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
