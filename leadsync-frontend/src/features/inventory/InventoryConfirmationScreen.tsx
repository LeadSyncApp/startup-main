/**
 * Inventory Confirmation Screen - Editable product cards
 * Shows raw_source_fragment for context, price_inr is visually prominent and editable
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductData } from "./InventoryIntakeScreen";
import { Check, X, Save, ShoppingBag } from "lucide-react";

interface InventoryConfirmationScreenProps {
  companyId?: string;
  products: ProductData[];
  onConfirm: (products: ProductData[]) => void;
  onBack: () => void;
}

export function InventoryConfirmationScreen({
  companyId,
  products: initialProducts,
  onConfirm,
  onBack
}: InventoryConfirmationScreenProps) {
  const [products, setProducts] = useState<ProductData[]>(initialProducts);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update products when initialProducts change
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const handlePriceChange = (idx: number, price: string) => {
    const newProducts = [...products];
    const priceNum = price === "" ? null : parseFloat(price) || null;
    newProducts[idx] = { ...newProducts[idx], price_inr: priceNum };
    setProducts(newProducts);
  };

  const handleBrandChange = (idx: number, brand: string) => {
    const newProducts = [...products];
    newProducts[idx] = { ...newProducts[idx], brand: brand || null };
    setProducts(newProducts);
  };

  const handleProductTypeChange = (idx: number, productType: string) => {
    const newProducts = [...products];
    newProducts[idx] = { ...newProducts[idx], product_type: productType };
    setProducts(newProducts);
  };

  const handleColorsChange = (idx: number, colorsStr: string) => {
    const newProducts = [...products];
    const colors = colorsStr.split(",").map(c => c.trim()).filter(c => c);
    newProducts[idx] = { ...newProducts[idx], colors };
    setProducts(newProducts);
  };

  const handleSizesChange = (idx: number, sizesStr: string) => {
    const newProducts = [...products];
    const sizes = sizesStr.split(",").map(s => s.trim()).filter(s => s);
    newProducts[idx] = { ...newProducts[idx], sizes };
    setProducts(newProducts);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch(`/api/companies/${companyId}/inventory/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products })
      });

      if (!response.ok) throw new Error("Failed to save products");

      setSaveSuccess(true);
      onConfirm(products);
    } catch (err: any) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (products.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-brand-saffron" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--app-text)' }}>
            No Products to Confirm
          </h2>
          <p style={{ color: 'var(--app-text-muted)' }}>
            Parse some inventory text first to see products here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
            Confirm Your Products
          </h1>
        </div>
        <button
          onClick={onBack}
          className="btn-ghost text-sm flex items-center gap-2"
        >
          <X className="h-4 w-4" />
          Back
        </button>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {products.map((product, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-5 rounded-xl border"
              style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brand */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Brand
                  </label>
                  <input
                    type="text"
                    value={product.brand || ""}
                    onChange={(e) => handleBrandChange(idx, e.target.value)}
                    placeholder="Recommended — helps avoid duplicate listings later"
                    className="w-full px-3 py-2 text-sm rounded-lg border"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* Product Type */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Product Type
                  </label>
                  <input
                    type="text"
                    value={product.product_type}
                    onChange={(e) => handleProductTypeChange(idx, e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* Colors */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Colors (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={product.colors.join(", ")}
                    onChange={(e) => handleColorsChange(idx, e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* Sizes */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Sizes (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={product.sizes.join(", ")}
                    onChange={(e) => handleSizesChange(idx, e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* Price - Prominently displayed */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Price (₹ INR)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: 'var(--brand-saffron)' }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      value={product.price_inr ?? ""}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                      placeholder="Enter price"
                      className="flex-1 px-4 py-3 text-2xl font-bold rounded-lg border-2 focus:border-brand-saffron transition-all"
                      style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Raw source fragment - for context */}
              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  <span className="font-medium">Source:</span> "{product.raw_source_fragment}"
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary flex items-center gap-2 text-lg px-6 py-3"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white" />
              Saving...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="h-5 w-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Confirm & Save Products
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}