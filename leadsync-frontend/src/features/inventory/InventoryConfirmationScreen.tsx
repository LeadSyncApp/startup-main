/**
 * Inventory Confirmation Screen - Editable product cards with flexible variants
 * Business-agnostic: works for retail, services, food, freelancers, salons, tutors, etc.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Save, ShoppingBag, Plus, Trash2, AlertTriangle } from "lucide-react";
import { ProductData, ProductVariantData } from "./InventoryIntakeScreen";

interface InventoryConfirmationScreenProps {
  companyId?: string;
  businessType?: string;
  products: ProductData[];
  onConfirm: (products: ProductData[]) => void;
  onBack: () => void;
}

const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(stock: number | null): string | null {
  if (stock === null) return null;
  if (stock === 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

export function InventoryConfirmationScreen({
  companyId,
  businessType,
  products: initialProducts,
  onConfirm,
  onBack
}: InventoryConfirmationScreenProps) {
  const isRestaurant = businessType === "RESTAURANT";
  const isServices = businessType === "SERVICES";
  const variantLabelHint = isRestaurant
    ? "Portion, Duration, etc."
    : isServices
    ? "Duration, etc."
    : "Size, Color, etc.";
  const [products, setProducts] = useState<ProductData[]>(initialProducts);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{ name: string; existingId: string }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const updateProduct = (idx: number, updates: Partial<ProductData>) => {
    const newProducts = [...products];
    newProducts[idx] = { ...newProducts[idx], ...updates };
    setProducts(newProducts);
  };

  const handleBrandChange = (idx: number, brand: string) => {
    updateProduct(idx, { brand: brand || null });
  };

  const handleAvailabilityChange = (idx: number, isAvailable: boolean) => {
    updateProduct(idx, { isAvailable });
  };

  const handleProductTypeChange = (idx: number, productType: string) => {
    updateProduct(idx, { product_type: productType });
  };

  const handlePriceChange = (idx: number, price: string) => {
    const priceNum = price === "" ? null : parseFloat(price) || null;
    updateProduct(idx, { price_inr: priceNum });
  };

  const handleHasVariantsToggle = (idx: number) => {
    const product = products[idx];
    const newHasVariants = !product.hasVariants;
    updateProduct(idx, {
      hasVariants: newHasVariants,
      attribute_name: newHasVariants ? (product.attribute_name || "") : null,
      variants: newHasVariants ? product.variants : []
    });
  };

  const handleAttributeNameChange = (idx: number, attrName: string) => {
    updateProduct(idx, { attribute_name: attrName });
  };

  const addVariant = (idx: number) => {
    const product = products[idx];
    const newVariant: ProductVariantData = {
      attribute_name: product.attribute_name || "",
      attribute_value: "",
      price_override: product.price_inr,
      stock: null
    };
    updateProduct(idx, {
      variants: [...product.variants, newVariant]
    });
  };

  const updateVariant = (productIdx: number, variantIdx: number, updates: Partial<ProductVariantData>) => {
    const product = products[productIdx];
    const newVariants = [...product.variants];
    newVariants[variantIdx] = { ...newVariants[variantIdx], ...updates };
    updateProduct(productIdx, { variants: newVariants });
  };

  const removeVariant = (productIdx: number, variantIdx: number) => {
    const product = products[productIdx];
    const newVariants = product.variants.filter((_, i) => i !== variantIdx);
    updateProduct(productIdx, { variants: newVariants });
  };

  const checkDuplicates = async () => {
    if (!companyId) return;
    try {
      const response = await fetch(`/api/companies/${companyId}/inventory/check-duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.duplicates && data.duplicates.length > 0) {
          setDuplicates(data.duplicates);
          setShowDuplicateWarning(true);
          return true;
        }
      }
    } catch (err) {
      console.error("Duplicate check failed:", err);
    }
    return false;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    // Check for duplicates first
    await checkDuplicates();

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
                {/* Brand — only shown for RETAIL business type */}
                {!isRestaurant && !isServices && (
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                      Brand
                    </label>
                    <input
                      type="text"
                      value={product.brand || ""}
                      onChange={(e) => handleBrandChange(idx, e.target.value)}
                      placeholder="Optional — helps avoid duplicate listings"
                      className="w-full px-3 py-2 text-sm rounded-lg border"
                      style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    />
                  </div>
                )}

                {/* Product Type / Name */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Product / Service Name
                  </label>
                  <input
                    type="text"
                    value={product.product_type}
                    onChange={(e) => handleProductTypeChange(idx, e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Description / Attributes (color, material, etc.)
                  </label>
                  <input
                    type="text"
                    value={product.description || ""}
                    onChange={(e) => updateProduct(idx, { description: e.target.value || null })}
                    placeholder="e.g. black, cotton, embroidered"
                    className="w-full px-3 py-2 text-sm rounded-lg border"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    SKU (auto-generated if empty)
                  </label>
                  <input
                    type="text"
                    value={product.sku || ""}
                    onChange={(e) => updateProduct(idx, { sku: e.target.value || undefined })}
                    placeholder="e.g. OTTO-SHIRT-BLK"
                    className="w-full px-3 py-2 text-sm rounded-lg border font-mono"
                    style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  />
                </div>

                {/* Price */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                    Base Price (₹ INR)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold" style={{ color: 'var(--brand-saffron)' }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      value={product.price_inr ?? ""}
                      onChange={(e) => handlePriceChange(idx, e.target.value)}
                      placeholder="Enter base price"
                      className="flex-1 px-4 py-3 text-2xl font-bold rounded-lg border-2 focus:border-brand-saffron transition-all"
                      style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Availability toggle — only for RESTAURANT business type */}
              {isRestaurant && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>
                      Availability
                    </label>
                    <button
                      onClick={() => handleAvailabilityChange(idx, !(product.isAvailable ?? true))}
                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                        (product.isAvailable ?? true) ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          (product.isAvailable ?? true) ? 'translate-x-5' : ''
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>
                    {(product.isAvailable ?? true) ? "Available" : "Sold Out"}
                  </p>
                </div>
              )}

              {/* Has Variants Toggle */}
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>
                    Has Variants? ({variantLabelHint})
                  </label>
                  <button
                    onClick={() => handleHasVariantsToggle(idx)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                      product.hasVariants ? 'bg-brand-saffron' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        product.hasVariants ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>

                {product.hasVariants && (
                  <div className="space-y-3">
                    {/* Attribute Name */}
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--app-text-muted)' }}>
                        What varies across these rows? (e.g. {variantLabelHint.split(',')[0]})
                      </label>
                      <input
                        type="text"
                        value={product.attribute_name || ""}
                        onChange={(e) => handleAttributeNameChange(idx, e.target.value)}
                        placeholder="e.g. Size, Color, Plates"
                        className="w-full px-3 py-2 text-sm rounded-lg border"
                        style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                      />
                      <p className="text-[11px] mt-1" style={{ color: 'var(--app-text-muted)', lineHeight: '1.4' }}>
                        All rows below use this same attribute (e.g. all are sizes or all are colors). For multiple attributes like Size AND Color, contact support.
                      </p>
                    </div>


                    {/* Variant Rows */}
                    <div className="space-y-2">
                      {product.variants.map((variant, vIdx) => (
                        <div key={vIdx} className="flex items-center gap-2 p-2 rounded-lg bg-black/5">
                          <div className="flex-1">
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
                              {product.attribute_name || "Value"}
                            </label>
                            <input
                              type="text"
                              value={variant.attribute_value}
                              onChange={(e) => updateVariant(idx, vIdx, { attribute_value: e.target.value })}
                              placeholder={`e.g. 32, M, Red`}
                              className="w-full px-3 py-1.5 text-sm rounded border"
                              style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
                              Price
                            </label>
                            <input
                              type="number"
                              value={variant.price_override ?? ""}
                              onChange={(e) => updateVariant(idx, vIdx, {
                                price_override: e.target.value === "" ? null : parseFloat(e.target.value) || null
                              })}
                              placeholder="₹"
                              className="w-24 px-3 py-1.5 text-sm rounded border"
                              style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
                              Stock
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                value={variant.stock ?? ""}
                                onChange={(e) => updateVariant(idx, vIdx, {
                                  stock: e.target.value === "" ? null : parseInt(e.target.value) || null
                                })}
                                placeholder="#"
                                className="w-20 px-3 py-1.5 text-sm rounded border"
                                style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                              />
                              {(() => {
                                const status = getStockStatus(variant.stock);
                                if (!status) return null;
                                const colors: Record<string, { bg: string; text: string; border: string }> = {
                                  IN_STOCK: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
                                  LOW_STOCK: { bg: "rgba(245, 158, 11, 0.15)", text: "#d97706", border: "rgba(245, 158, 11, 0.3)" },
                                  OUT_OF_STOCK: { bg: "rgba(239, 68, 68, 0.15)", text: "#dc2626", border: "rgba(239, 68, 68, 0.3)" },
                                };
                                const c = colors[status];
                                return (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap" style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                                    {status === "IN_STOCK" ? "In Stock" : status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <button
                            onClick={() => removeVariant(idx, vIdx)}
                            className="p-1.5 text-red-400 hover:text-red-600 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Variant Button */}
                    <button
                      onClick={() => addVariant(idx)}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-dashed hover:bg-black/5 transition cursor-pointer"
                      style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
                    >
                      <Plus className="h-3 w-3" />
                      Add {product.attribute_name || "Variant"}
                    </button>
                  </div>
                )}
              </div>

              {/* Raw source fragment */}
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  <span className="font-medium">Source:</span> "{product.raw_source_fragment}"
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Duplicate Warning */}
      {showDuplicateWarning && duplicates.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg border" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700">
              {duplicates.length} product(s) already exist and will be updated:
            </p>
            <ul className="mt-1 text-xs text-amber-600">
              {duplicates.map((d, i) => (
                <li key={i}>{d.name}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => setShowDuplicateWarning(false)}
            className="ml-auto text-amber-500 hover:text-amber-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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
