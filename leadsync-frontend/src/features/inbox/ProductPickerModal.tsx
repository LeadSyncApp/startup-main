/**
 * Product Picker Modal - In-chat product selection for staff
 * Searchable list of products with variant selection
 * Generates payment links and inserts into chat
 */

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, X, Package, CreditCard, Loader2 } from "lucide-react";
import { authedFetch } from "../../api/client";

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
      const variantLabel = variant
        ? ` (${product.variantAttributeName}: ${variant.attributeValue})`
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
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-brand-saffron" />
            <h3 className="text-sm font-black text-white">
              {selectedProduct ? "Select Variant" : "Pick a Product"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Search */}
        {!selectedProduct && (
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer"
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
              <span className="ml-2 text-xs text-slate-400">Searching...</span>
            </div>
          )}

          {!loading && searchTerm && products.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs text-slate-500">No products found</p>
            </div>
          )}

          {!loading && !searchTerm && (
            <div className="text-center py-8">
              <Search className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs text-slate-500">Type to search products</p>
            </div>
          )}

          {/* Product List */}
          {!loading && !selectedProduct && products.map((product) => (
            <button
              key={product.id}
              onClick={() => handleProductClick(product)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition border-b border-slate-800/50 cursor-pointer text-left"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-10 h-10 rounded-lg object-cover bg-slate-800"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Package className="h-5 w-5 text-slate-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-brand-saffron">₹{product.basePrice}</span>
                  {product.hasVariants && (
                    <span className="text-[10px] text-slate-500">
                      {product.variants.length} {product.variantAttributeName || "variants"}
                    </span>
                  )}
                </div>
              </div>
              <CreditCard className="h-4 w-4 text-slate-600 shrink-0" />
            </button>
          ))}

          {/* Variant Selection */}
          {selectedProduct && (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => { setSelectedProduct(null); }}
                  className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  ← Back to search
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Select {selectedProduct.variantAttributeName || "variant"} for{" "}
                <span className="text-white font-bold">{selectedProduct.name}</span>
              </p>

              {selectedProduct.variants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => handleSelect(selectedProduct, variant)}
                  disabled={variant.stock === 0}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition cursor-pointer ${
                    variant.stock === 0
                      ? "opacity-50 cursor-not-allowed border-slate-800 bg-slate-900/50"
                      : "border-slate-700 bg-slate-800/50 hover:border-brand-saffron hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{variant.attributeValue}</span>
                    {variant.stock !== null && (
                      <span className="text-[10px] text-slate-500">
                        {variant.stock > 0 ? `${variant.stock} in stock` : "Out of stock"}
                      </span>
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
          <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-brand-saffron" />
            <span className="text-xs text-slate-400">Generating payment link...</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
