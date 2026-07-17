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
    // Convert SavedProduct back to ProductData for the confirmation screen
    const variants = (product.variants || []).map((v: any) => ({
      attribute_name: product.variantAttributeName || "",
      attribute_value: v.attributeValue,
      price_override: v.price,
      stock: v.stock,
    }));

    setProducts([{
      brand: null,
      product_type: product.name,
      variants,
      attribute_name: product.variantAttributeName,
      description: product.description || null,
      price_inr: product.basePrice,
      raw_source_fragment: product.name,
      hasVariants: product.hasVariants,
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
