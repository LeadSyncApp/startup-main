/**
 * Inventory Intake Screen - Free-text inventory input
 * Calls POST /companies/:id/inventory/parse endpoint
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Edit3, CheckCircle, AlertCircle } from "lucide-react";

export interface ProductData {
  brand: string | null;
  product_type: string;
  colors: string[];
  sizes: string[];
  price_inr: number | null;
  raw_source_fragment: string;
}

interface IntakeResponse {
  products: ProductData[];
  unparsed_notes: string | null;
}

interface InventoryIntakeScreenProps {
  companyId?: string;
  onProceedToConfirm: (products: ProductData[]) => void;
}

export function InventoryIntakeScreen({ companyId, onProceedToConfirm }: InventoryIntakeScreenProps) {
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<IntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) {
      setError("Please enter some inventory text to parse");
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}/inventory/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to parse inventory");
      }

      const result: IntakeResponse = await response.json();
      setParseResult(result);
      
      if (result.products.length > 0) {
        onProceedToConfirm(result.products);
      }
    } catch (err: any) {
      console.error("Parse API failed:", err.message);
      setError(err.message || "Failed to parse inventory. Please try again.");
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-brand-saffron-soft text-brand-saffron flex items-center justify-center">
          <Package className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
          Add Your Products
        </h1>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>
            Product Description (Free Text)
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your product descriptions here... e.g., 'Otto full hand shirt black white navy M L XL 899 rupees'"
            className="mt-2 w-full h-32 px-4 py-3 rounded-xl border focus:ring-2 focus:ring-brand-saffron focus:border-transparent transition-all"
            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          />
        </label>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleParse}
          disabled={isParsing}
          className="btn-primary flex items-center gap-2"
        >
          {isParsing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
              Parsing...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Parse Inventory
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {parseResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mt-8 space-y-4"
          >
            <h2 className="text-lg font-semibold" style={{ color: 'var(--app-text)' }}>
              Parsed Products ({parseResult.products.length})
            </h2>

            <div className="grid gap-4">
              {parseResult.products.map((product, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border"
                  style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-medium" style={{ color: 'var(--app-text)' }}>
                        {product.brand && <span className="text-brand-saffron">{product.brand} </span>}
                        {product.product_type}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                        {product.colors.length > 0 && (
                          <span>Colors: {product.colors.join(", ")}</span>
                        )}
                        {product.sizes.length > 0 && (
                          <span>Sizes: {product.sizes.join(", ")}</span>
                        )}
                      </div>
                      {product.price_inr !== null && (
                        <p className="text-lg font-bold" style={{ color: 'var(--brand-saffron)' }}>
                          ₹{product.price_inr}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onProceedToConfirm(parseResult.products)}
                      className="btn-ghost text-xs"
                    >
                      <Edit3 className="h-3 w-3 mr-1" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}