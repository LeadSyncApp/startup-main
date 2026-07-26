import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, X, Package, CreditCard, Loader2, IndianRupee, ChevronRight, Plus, Trash2, ShoppingCart } from "lucide-react";
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
  attributes?: Record<string, string> | null;
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
  variantAttributeNames?: string[];
  variants: ProductVariant[];
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  imageUrl: string | null;
  variantId?: string;
  variantAttributeHeader?: string;
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
}

export function formatVariantLabel(variant: ProductVariant, product?: PickerProduct | null): string {
  if (variant.attributes && typeof variant.attributes === "object") {
    if (product?.variantAttributeNames && product.variantAttributeNames.length > 0) {
      const parts = product.variantAttributeNames
        .map((dim) => variant.attributes?.[dim])
        .filter((val): val is string => Boolean(val));
      if (parts.length > 0) return parts.join(", ");
    }
    const values = Object.values(variant.attributes).filter(Boolean);
    if (values.length > 0) return values.join(", ");
  }
  if (variant.attributeValue) {
    return variant.attributeValue.replace(/\s*[-/]\s*/g, ", ");
  }
  return "Variant";
}

export function formatVariantAttributeHeader(product: PickerProduct): string {
  if (product.variantAttributeNames && product.variantAttributeNames.length > 0) {
    return product.variantAttributeNames.join(" / ");
  }
  return product.variantAttributeName || "variant";
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

  // Multi-item Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCartView, setShowCartView] = useState(false);

  // Catalog Flow item detail selection state
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isConfirmingCatalog, setIsConfirmingCatalog] = useState(false);
  const [showVariantConfirm, setShowVariantConfirm] = useState(false);

  // Custom Amount state
  const [customAmount, setCustomAmount] = useState("");
  const [customNote, setCustomNote] = useState("");

  useEffect(() => {
    if (tab === "catalog" && !selectedProduct && !showCartView) {
      searchInputRef.current?.focus();
    }
  }, [tab, selectedProduct, showCartView]);

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
    setShowCartView(false);
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

  const resetItemSelection = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setIsConfirmingCatalog(false);
    setShowVariantConfirm(false);
    setQuantity(1);
  };

  const handleAddToCart = (keepSearching: boolean) => {
    if (!selectedProduct) return;

    const unitPrice = selectedVariant ? selectedVariant.price : selectedProduct.basePrice;
    const attrHeader = formatVariantAttributeHeader(selectedProduct);
    const variantLabel = selectedVariant
      ? formatVariantLabel(selectedVariant, selectedProduct)
      : undefined;

    const newItemId = `${selectedProduct.id}_${selectedVariant?.id || "base"}_${Date.now()}`;

    const newItem: CartItem = {
      id: newItemId,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      imageUrl: selectedProduct.imageUrl,
      variantId: selectedVariant?.id,
      variantAttributeHeader: selectedVariant ? attrHeader : undefined,
      variantLabel: variantLabel,
      quantity: Math.max(1, quantity),
      unitPrice
    };

    setCartItems(prev => {
      // If same product & variant already in cart, increment quantity
      const existingIdx = prev.findIndex(item => item.productId === newItem.productId && item.variantId === newItem.variantId);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += newItem.quantity;
        return updated;
      }
      return [...prev, newItem];
    });

    resetItemSelection();

    if (keepSearching) {
      setShowCartView(false);
      setSearchTerm("");
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setShowCartView(true);
    }
  };

  const handleUpdateCartQuantity = (id: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const handleGenerateCatalog = async () => {
    if (cartItems.length === 0) return;
    setGeneratingLink(true);
    try {
      const payloadProducts = cartItems.map(item => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        quantity: item.quantity
      }));

      const itemSummaryLines = cartItems.map(item => {
        const variantText = item.variantLabel ? ` (${item.variantLabel})` : "";
        return `${item.quantity}x ${item.productName}${variantText}`;
      });

      const note = `Order for ${cartItems.length} item(s): ${itemSummaryLines.join(", ")}`;

      const payload = {
        conversationId,
        products: payloadProducts,
        note
      };

      const res = await authedFetch(`/api/orders/payment-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error("Failed to generate payment request");
      
      const data = await res.json();
      
      const payloadTag = data.paymentPayload ? `[PAYMENT_REQUEST:${encodeURIComponent(JSON.stringify(data.paymentPayload))}]` : `[ORDER:${data.order?.id || ""}]`;
      
      const formattedItems = cartItems.map(item => {
        const vText = item.variantLabel ? ` (${item.variantLabel})` : "";
        return `• ${item.productName}${vText} × ${item.quantity} — ₹${item.unitPrice * item.quantity}`;
      }).join("\n");

      const message = `💳 PAYMENT REQUEST — ₹${cartTotal}\n${formattedItems}\n\nTotal Amount: ₹${cartTotal}\nPay via Link: ${data.upiLink}\n${payloadTag}`;
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
      
      const payloadTag = data.paymentPayload ? `[PAYMENT_REQUEST:${encodeURIComponent(JSON.stringify(data.paymentPayload))}]` : `[ORDER:${data.order?.id || ""}]`;
      const message = `💳 PAYMENT REQUEST — ₹${customAmount}\n• Description: ${customNote || "Custom Payment"}\n• Amount: ₹${customAmount}\n\nPay via Link: ${data.upiLink}\n${payloadTag}`;
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
        className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--app-border)]">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-saffron" />
            <h3 className="text-sm font-black text-[var(--app-text)]">
              Create Payment Request
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {cartItems.length > 0 && tab === "catalog" && (
              <button
                onClick={() => { resetItemSelection(); setShowCartView(!showCartView); }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                  showCartView
                    ? "bg-brand-saffron text-brand-navy"
                    : "bg-[var(--app-surface-alt)] text-[var(--app-text)] hover:bg-[var(--app-bg-soft)] border border-[var(--app-border)]"
                }`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Cart ({cartItems.length})
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--app-bg-soft)] transition cursor-pointer"
            >
              <X className="h-4 w-4 text-[var(--app-text-muted)]" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--app-border)]">
          <button
            onClick={() => { setTab("catalog"); setShowCartView(false); }}
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
            {/* Search Input (visible when not viewing cart summary and not configuring item) */}
            {!selectedProduct && !showCartView && (
              <div className="px-4 py-3 border-b border-[var(--app-border)] flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--app-surface-alt)] border border-[var(--app-border)]">
                  <Search className="h-4 w-4 text-[var(--app-text-muted)]" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search products to add..."
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
                {cartItems.length > 0 && (
                  <button
                    onClick={() => setShowCartView(true)}
                    className="px-3 py-2 bg-brand-saffron/10 text-brand-saffron hover:bg-brand-saffron/20 border border-brand-saffron/30 rounded-lg text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    View Cart ({cartItems.length})
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {/* CART VIEW MODE */}
              {showCartView && !selectedProduct && (
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-[var(--app-text-muted)] tracking-wider">
                      Itemized Cart ({cartItems.length} items)
                    </h4>
                    <button
                      onClick={() => { setShowCartView(false); resetItemSelection(); }}
                      className="flex items-center gap-1 text-xs text-brand-saffron font-bold hover:underline cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Another Item
                    </button>
                  </div>

                  {cartItems.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-[var(--app-text-muted)]" />
                      <p className="text-xs text-[var(--app-text-muted)]">Your payment request cart is empty</p>
                      <button
                        onClick={() => setShowCartView(false)}
                        className="mt-3 px-4 py-1.5 bg-brand-saffron text-brand-navy rounded-lg text-xs font-black"
                      >
                        Browse Catalog
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-[var(--app-surface-alt)] border border-[var(--app-border)]"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.productName} className="w-10 h-10 rounded-lg object-cover bg-[var(--app-surface)] shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[var(--app-surface)] flex items-center justify-center shrink-0">
                                <Package className="h-5 w-5 text-[var(--app-text-muted)]" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-[var(--app-text)] truncate">{item.productName}</p>
                              {item.variantLabel && (
                                <p className="text-[11px] text-[var(--app-text-muted)] truncate">{item.variantLabel}</p>
                              )}
                              <p className="text-xs font-black text-brand-saffron mt-0.5">₹{item.unitPrice} each</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 ml-2 shrink-0">
                            {/* Quantity buttons */}
                            <div className="flex items-center gap-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-md px-1 py-0.5">
                              <button
                                onClick={() => handleUpdateCartQuantity(item.id, -1)}
                                className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[var(--app-text)] hover:bg-[var(--app-bg-soft)] rounded cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-xs font-bold px-1.5 text-[var(--app-text)]">{item.quantity}</span>
                              <button
                                onClick={() => handleUpdateCartQuantity(item.id, 1)}
                                className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[var(--app-text)] hover:bg-[var(--app-bg-soft)] rounded cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-xs font-black text-[var(--app-text)] w-14 text-right">
                              ₹{item.unitPrice * item.quantity}
                            </span>
                            <button
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Summary & Checkout */}
                      <div className="border-t border-[var(--app-border)] pt-3 mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--app-text-muted)] font-bold">Combined Order Total</span>
                          <span className="text-xl font-black text-brand-saffron">₹{cartTotal}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setShowCartView(false); resetItemSelection(); }}
                            className="flex-1 py-2 bg-[var(--app-surface-alt)] hover:bg-[var(--app-bg-soft)] text-[var(--app-text)] border border-[var(--app-border)] rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add Another Item
                          </button>

                          <button
                            onClick={handleGenerateCatalog}
                            disabled={generatingLink || cartItems.length === 0}
                            className="flex-1 py-2 bg-brand-navy hover:bg-brand-navy/80 text-white rounded-lg font-black text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {generatingLink ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CreditCard className="h-4 w-4" />
                            )}
                            Send Request (₹{cartTotal})
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SEARCH RESULTS MODE */}
              {!loading && !selectedProduct && !showCartView && products.length === 0 && (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 mx-auto mb-2 text-[var(--app-text-muted)]" />
                  <p className="text-xs text-[var(--app-text-muted)]">
                    {searchTerm ? "No products found" : "No products available in inventory"}
                  </p>
                </div>
              )}

              {loading && !selectedProduct && !showCartView && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-saffron" />
                  <span className="ml-2 text-xs text-[var(--app-text-muted)]">Searching...</span>
                </div>
              )}

              {!loading && !selectedProduct && !showCartView && products.map((product) => (
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
                          {product.variants.length} {formatVariantAttributeHeader(product)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[var(--app-text-muted)] shrink-0" />
                </button>
              ))}

              {/* VARIANT SELECTION MODE */}
              {selectedProduct && !isConfirmingCatalog && !showVariantConfirm && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => { setSelectedProduct(null); }}
                      className="text-xs text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition cursor-pointer"
                    >
                      ← Back to search
                    </button>
                    {cartItems.length > 0 && (
                      <span className="text-xs text-brand-saffron font-bold">
                        Cart total: ₹{cartTotal} ({cartItems.length} items)
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-bold text-[var(--app-text)]">
                    Tap a {formatVariantAttributeHeader(selectedProduct).toLowerCase()} option to continue
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
                        <span className="text-sm font-bold text-[var(--app-text)]">{formatVariantLabel(variant, selectedProduct)}</span>
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

              {/* VARIANT CONFIRM MODE */}
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
                          {formatVariantAttributeHeader(selectedProduct)}: {formatVariantLabel(selectedVariant, selectedProduct)}
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

              {/* QUANTITY & ADD TO CART MODE */}
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
                          {formatVariantAttributeHeader(selectedProduct)}: {formatVariantLabel(selectedVariant, selectedProduct)}
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
                    <span className="text-xs text-[var(--app-text-muted)] font-bold">Item Total</span>
                    <span className="text-lg font-black text-brand-saffron">
                      ₹{(selectedVariant ? selectedVariant.price : selectedProduct.basePrice) * quantity}
                    </span>
                  </div>

                  {/* Multi-item Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => handleAddToCart(true)}
                      className="py-2.5 bg-[var(--app-surface-alt)] hover:bg-[var(--app-bg-soft)] text-[var(--app-text)] border border-[var(--app-border)] rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5 text-brand-saffron" />
                      Add & Add Another Item
                    </button>

                    <button
                      onClick={() => handleAddToCart(false)}
                      className="py-2.5 bg-brand-saffron hover:bg-brand-saffron/90 text-brand-navy rounded-lg font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Add to Request ({cartItems.length + 1} items)
                    </button>
                  </div>
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
              Send Payment Request{customAmount && parseFloat(customAmount) > 0 ? ` (₹${customAmount})` : ""}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
