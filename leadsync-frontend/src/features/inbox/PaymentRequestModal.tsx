import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, X, Package, CreditCard, Loader2, IndianRupee, ChevronRight } from "lucide-react";
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

interface PaymentRequestModalProps {
  conversationId: string;
  onClose: () => void;
  onPaymentGenerated: (message: string) => void;
}

export function PaymentRequestModal({
  conversationId,
  onClose,
  onPaymentGenerated
}: PaymentRequestModalProps) {
  const [tab, setTab] = useState<"catalog" | "custom">("catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<PickerProduct | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Catalog Flow details
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isConfirmingCatalog, setIsConfirmingCatalog] = useState(false);
  const [showVariantConfirm, setShowVariantConfirm] = useState(false);

  // Custom Amount state
  const [customAmount, setCustomAmount] = useState("");
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    if (tab === "catalog" && !selectedProduct) {
      searchInputRef.current?.focus();
    }
  }, [tab, selectedProduct]);

  // Fetch helper
  const fetchProducts = async (term: string) => {
    setLoading(true);
    try {
      const res = await authedFetch(
        `/api/companies/search?q=${encodeURIComponent(term)}`
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
  };

  // Debounced search / default product listing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (!searchTerm.trim()) {
      // Load default products immediately on mount / empty search
      fetchProducts("");
      return;
    }

    debounceRef.current = setTimeout(async () => {
      await fetchProducts(searchTerm);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  const handleProductClick = (product: PickerProduct) => {
    if (product.hasVariants && product.variants.length > 0) {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setIsConfirmingCatalog(false);
      setShowVariantConfirm(false);
    } else {
      setSelectedProduct(product);
      setSelectedVariant(null);
      setQuantity(1);
      setIsConfirmingCatalog(true);
    }
  };

  const handleVariantClick = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    setShowVariantConfirm(true);
  };

  const handleVariantContinue = () => {
    setQuantity(1);
    setIsConfirmingCatalog(true);
    setShowVariantConfirm(false);
  };

  const handleGenerateCatalog = async () => {
    if (!selectedProduct) return;
    setGeneratingLink(true);
    try {
      const price = selectedVariant ? selectedVariant.price : selectedProduct.basePrice;
      const variantLabel = selectedVariant
        ? ` (${selectedProduct.variantAttributeName}: ${selectedVariant.attributeValue})`
        : "";
      const name = selectedProduct.name;
      const total = price * quantity;

      const payload = {
        conversationId,
        products: [
          {
            productId: selectedProduct.id,
            variantId: selectedVariant?.id || undefined,
            quantity: quantity
          }
        ],
        note: `Order for ${quantity}x ${name}${variantLabel}`
      };

      const res = await authedFetch(`/api/orders/payment-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to generate payment request");
      
      const data = await res.json();
      
      const message = `🛍️ *${name}*${variantLabel} — ₹${price}\n\nQuantity: ${quantity}\nTotal: ₹${total}\n\nHere is your payment link: ${data.upiLink}\nPlease let us know once paid.`;
      onPaymentGenerated(message);
    } catch (err) {
      console.error("Link generation failed:", err);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleGenerateCustom = async () => {
    if (!customAmount || parseFloat(customAmount) <= 0) return;
    
    setGeneratingLink(true);
    try {
      const payload = {
        conversationId,
        customAmount,
        note: customNote || "Custom Payment"
      };

      const res = await authedFetch(`/api/orders/payment-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to generate payment request");
      
      const data = await res.json();
      
      const message = `💳 *${customNote || "Custom Payment"}* — ₹${customAmount}\n\nHere is your payment link: ${data.upiLink}\nPlease let us know once paid.`;
      onPaymentGenerated(message);
    } catch (err) {
      console.error("Link generation failed:", err);
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
            <CreditCard className="h-4 w-4 text-brand-saffron" />
            <h3 className="text-sm font-black text-[var(--app-text)]">
              Request Payment
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--app-bg-soft)] transition cursor-pointer"
          >
            <X className="h-4 w-4 text-[var(--app-text-muted)]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--app-border)]">
          <button
            onClick={() => setTab("catalog")}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              tab === "catalog"
                ? "bg-[var(--app-surface-alt)] text-brand-saffron border-b-2 border-brand-saffron"
                : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            }`}
          >
            From Catalog
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              tab === "custom"
                ? "bg-[var(--app-surface-alt)] text-brand-saffron border-b-2 border-brand-saffron"
                : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
            }`}
          >
            Custom Amount
          </button>
        </div>

        {/* Tab Content */}
        {tab === "catalog" && (
          <div className="flex-1 flex flex-col min-h-0">
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

            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-saffron" />
                  <span className="ml-2 text-xs text-[var(--app-text-muted)]">Searching...</span>
                </div>
              )}

              {!loading && !selectedProduct && products.length === 0 && (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 mx-auto mb-2 text-[var(--app-text-muted)]" />
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {searchTerm ? "No products found" : "No products available in inventory"}
                  </p>
                </div>
              )}

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

              {selectedProduct && !isConfirmingCatalog && !showVariantConfirm && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => { setSelectedProduct(null); }}
                      className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
                    >
                      ← Back to search
                    </button>
                  </div>

                  <p className="text-xs font-bold text-[var(--app-text)]">
                    Tap a {selectedProduct.variantAttributeName?.toLowerCase() || "variant"} to continue
                  </p>

                  {selectedProduct.variants.map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => handleVariantClick(variant)}
                      disabled={variant.stock === 0}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition cursor-pointer active:scale-[0.98] ${
                        variant.stock === 0
                          ? "opacity-40 cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-alt)]"
                          : "border-[var(--app-border)] bg-[var(--app-surface-alt)] hover:border-brand-saffron hover:bg-[var(--app-bg-soft)] hover:shadow-sm hover:shadow-brand-saffron/10"
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-brand-saffron">₹{variant.price}</span>
                        <ChevronRight className="h-4 w-4 text-[var(--app-text-muted)]" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && selectedVariant && showVariantConfirm && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setShowVariantConfirm(false); setSelectedVariant(null); }}
                      className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
                    >
                      ← Back to variants
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-[var(--app-surface-alt)] p-3 rounded-lg border border-[var(--app-border)]">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-12 h-12 rounded-lg object-cover bg-[var(--app-surface-alt)]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[var(--app-surface-alt)] flex items-center justify-center">
                        <Package className="h-6 w-6 text-[var(--app-text-muted)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-[var(--app-text)] truncate">{selectedProduct.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-[var(--app-text-muted)]">
                          {selectedProduct.variantAttributeName}: {selectedVariant.attributeValue}
                        </p>
                        {selectedProduct.sku && (
                          <span className="text-[10px] font-mono text-[var(--app-text-muted)]">{selectedProduct.sku}</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-brand-saffron mt-1">
                        ₹{selectedVariant.price}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleVariantContinue}
                    className="w-full py-2 bg-brand-saffron hover:bg-brand-saffron/80 text-brand-navy rounded-lg font-black text-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    Continue to Quantity
                  </button>
                </div>
              )}

              {isConfirmingCatalog && selectedProduct && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      onClick={() => {
                        if (selectedProduct.hasVariants && selectedProduct.variants.length > 0) {
                          setIsConfirmingCatalog(false);
                          setShowVariantConfirm(true);
                        } else {
                          setIsConfirmingCatalog(false);
                          setSelectedProduct(null);
                        }
                      }}
                      className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
                    >
                      ← Back
                    </button>
                  </div>

                  <div className="flex items-center gap-3 bg-[var(--app-surface-alt)] p-3 rounded-lg border border-[var(--app-border)]">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-12 h-12 rounded-lg object-cover bg-[var(--app-surface-alt)]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[var(--app-surface-alt)] flex items-center justify-center">
                        <Package className="h-6 w-6 text-[var(--app-text-muted)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-[var(--app-text)] truncate">{selectedProduct.name}</h4>
                      {selectedVariant && (
                        <p className="text-xs text-[var(--app-text-muted)] mt-0.5">
                          {selectedProduct.variantAttributeName}: {selectedVariant.attributeValue}
                        </p>
                      )}
                      <p className="text-xs font-bold text-brand-saffron mt-1">
                        Unit Price: ₹{selectedVariant ? selectedVariant.price : selectedProduct.basePrice}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-[var(--app-text-muted)] mb-2">Quantity</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        className="w-10 h-10 rounded-lg bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] text-[var(--app-text)] font-bold text-lg flex items-center justify-center cursor-pointer select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 text-center py-2 bg-[var(--app-surface-alt)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] font-bold text-sm outline-none focus:border-brand-saffron"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(q => q + 1)}
                        className="w-10 h-10 rounded-lg bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] text-[var(--app-text)] font-bold text-lg flex items-center justify-center cursor-pointer select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[var(--app-border)] pt-3 flex items-center justify-between">
                    <span className="text-xs text-[var(--app-text-muted)] font-bold">Calculated Total</span>
                    <span className="text-lg font-black text-brand-saffron">
                      ₹{(selectedVariant ? selectedVariant.price : selectedProduct.basePrice) * quantity}
                    </span>
                  </div>

                  <button
                    onClick={handleGenerateCatalog}
                    disabled={generatingLink}
                    className="w-full py-2 bg-brand-navy hover:bg-brand-navy/80 text-white rounded-lg font-black text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {generatingLink ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Generate Link
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "custom" && (
          <div className="p-4 space-y-4 flex-1">
            <div>
              <label className="block text-xs font-black text-[var(--app-text-muted)] mb-1">Amount (₹)</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-[var(--app-text-muted)]" />
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 bg-[var(--app-surface-alt)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-sm outline-none focus:border-brand-saffron"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-black text-[var(--app-text-muted)] mb-1">Note / Description</label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g. Custom Shipping Charge"
                className="w-full px-3 py-2 bg-[var(--app-surface-alt)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-sm outline-none focus:border-brand-saffron"
              />
            </div>
            <button
              onClick={handleGenerateCustom}
              disabled={!customAmount || parseFloat(customAmount) <= 0 || generatingLink}
              className="w-full py-2 bg-brand-navy hover:bg-brand-navy/80 text-white rounded-lg font-black text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generatingLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Generate Link
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
