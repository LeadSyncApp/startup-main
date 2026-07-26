/**
 * Inventory Page - Product listing, intake, and confirmation screens
 * Business-agnostic orchestrator for inventory management
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductData } from "./InventoryIntakeScreen";
import { InventoryIntakeScreen } from "./InventoryIntakeScreen";
import { InventoryConfirmationScreen } from "./InventoryConfirmationScreen";
import { InventoryListScreen } from "./InventoryListScreen";

interface InventoryPageProps {
  companyId?: string;
  businessType?: string;
}

export function InventoryPage({ companyId, businessType }: InventoryPageProps) {
  const [step, setStep] = useState<"list" | "intake" | "confirm">("list");
  const [products, setProducts] = useState<ProductData[]>([]);

  const handleProceedToConfirm = (parsedProducts: ProductData[]) => {
    setProducts(parsedProducts);
    setStep("confirm");
  };

  const handleConfirm = async (confirmedProducts: ProductData[]) => {
    console.log("Products confirmed:", confirmedProducts);
    setStep("list");
  };

  const handleBack = () => {
    setStep("list");
  };

  const handleAddNew = () => {
    setProducts([]);
    setStep("intake");
  };

  const handleSelectProduct = (product: any) => {
    // Reconstruct variant_dimensions from saved product's variantAttributeNames + per-variant attributes
    const savedAttrNames: string[] = product.variantAttributeNames || [];

    // Collect ALL attribute keys from variants (handles stale variantAttributeNames)
    const allAttrKeys = new Set<string>();
    for (const v of (product.variants || [])) {
      if (v.attributes && typeof v.attributes === "object") {
        Object.keys(v.attributes).forEach(k => allAttrKeys.add(k));
      }
    }
    // Merge saved names with actual attribute keys to cover stale metadata
    const mergedAttrNames = [...new Set([...savedAttrNames, ...allAttrKeys])];

    const variantDimensions: Array<{ name: string; options: string[] }> = [];

    if (mergedAttrNames.length > 0 && product.variants?.length > 0) {
      for (const dimName of mergedAttrNames) {
        const optionsSet = new Set<string>();
        for (const v of product.variants) {
          const attrs = v.attributes;
          if (attrs && typeof attrs === "object" && dimName in attrs) {
            const val = String(attrs[dimName]);
            if (val) optionsSet.add(val);
          }
        }
        variantDimensions.push({ name: dimName, options: Array.from(optionsSet) });
      }
    }

    const variants = (product.variants || []).map((v: any) => ({
      attribute_name: product.variantAttributeName || "",
      attribute_value: v.attributeValue,
      price_override: v.price,
      stock: v.stock,
      ...(v.attributes && typeof v.attributes === "object" ? { attributes: v.attributes } : {}),
    }));

    setProducts([{
      id: product.id,
      brand: null,
      product_type: product.name,
      variants,
      variant_dimensions: variantDimensions.length > 0 ? variantDimensions : undefined,
      variantAttributeNames: mergedAttrNames.length > 0 ? mergedAttrNames : undefined,
      attribute_name: product.variantAttributeName,
      description: product.description || null,
      price_inr: product.basePrice,
      raw_source_fragment: product.name,
      hasVariants: product.hasVariants,
      imageUrl: product.imageUrl,
      images: product.images || [],
      customFieldValues: product.customFieldValues || {},
    }]);
    setStep("confirm");
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--app-bg)' }}>
      <AnimatePresence mode="wait">
        {step === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <InventoryListScreen
              companyId={companyId}
              onAddNew={handleAddNew}
              onSelectProduct={handleSelectProduct}
            />
          </motion.div>
        )}
        {step === "intake" && (
          <motion.div
            key="intake"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <InventoryIntakeScreen
              companyId={companyId}
              onProceedToConfirm={handleProceedToConfirm}
            />
          </motion.div>
        )}
        {step === "confirm" && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <InventoryConfirmationScreen
              companyId={companyId}
              businessType={businessType}
              products={products}
              onConfirm={handleConfirm}
              onBack={handleBack}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
