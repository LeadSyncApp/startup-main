/**
 * Inventory Page - Product listing, intake, and confirmation screens
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductData } from "./InventoryIntakeScreen";
import { InventoryIntakeScreen } from "./InventoryIntakeScreen";
import { InventoryConfirmationScreen } from "./InventoryConfirmationScreen";
import { InventoryListScreen } from "./InventoryListScreen";

interface InventoryPageProps {
  companyId?: string;
}

export function InventoryPage({ companyId }: InventoryPageProps) {
  const [step, setStep] = useState<"list" | "intake" | "confirm">("list");
  const [products, setProducts] = useState<ProductData[]>([]);

  const handleProceedToConfirm = (parsedProducts: ProductData[]) => {
    setProducts(parsedProducts);
    setStep("confirm");
  };

  const handleConfirm = async (confirmedProducts: ProductData[]) => {
    console.log("Products confirmed:", confirmedProducts);
    // Return to list view after successful confirmation
    setStep("list");
  };

  const handleBack = () => {
    setStep("list");
  };

  const handleAddNew = () => {
    setProducts([]);
    setStep("intake");
  };

  const handleSelectProduct = (product: { brand: string | null; product_type: string; colors: string[]; sizes: string[]; price_inr: number | null }) => {
    setProducts([{
      brand: product.brand,
      product_type: product.product_type,
      colors: product.colors,
      sizes: product.sizes,
      price_inr: product.price_inr,
      raw_source_fragment: `${product.brand ? product.brand + " " : ""}${product.product_type}`,
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
