import { motion } from "framer-motion";
import { Package, AlertTriangle, IndianRupee } from "lucide-react";

interface ProductVariant {
  id: string;
  attributeValue: string;
  price: number;
  stock: number | null;
  stockStatus?: string | null;
}

interface SavedProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  categories: string[];
  sku: string | null;
  basePrice: number;
  imageUrl: string | null;
  hasVariants: boolean;
  variantAttributeName: string | null;
  variants: ProductVariant[];
  stockStatus?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface InventoryStatsHeaderProps {
  products: SavedProduct[];
}

export function InventoryStatsHeader({ products }: InventoryStatsHeaderProps) {
  const totalProducts = products.length;

  let lowStockCount = 0;
  let totalValuation = 0;

  for (const product of products) {
    // Check if product or any variant has low or out of stock
    const isLowOrOut =
      product.stockStatus === "LOW_STOCK" ||
      product.stockStatus === "OUT_OF_STOCK" ||
      product.variants.some(v => v.stockStatus === "LOW_STOCK" || v.stockStatus === "OUT_OF_STOCK");

    if (isLowOrOut) {
      lowStockCount++;
    }

    // Valuation calculation
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        const stockQty = variant.stock ?? 0;
        const price = variant.price > 0 ? variant.price : product.basePrice;
        totalValuation += price * stockQty;
      }
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const statCards = [
    {
      title: "Total Products",
      value: totalProducts,
      subtitle: `${totalProducts} item${totalProducts !== 1 ? "s" : ""} in catalog`,
      icon: Package,
      iconColor: "text-brand-saffron",
      bgColor: "bg-brand-saffron-soft",
    },
    {
      title: "Low / Out of Stock",
      value: lowStockCount,
      subtitle: lowStockCount > 0 ? `${lowStockCount} need restocking` : "All items well stocked",
      icon: AlertTriangle,
      iconColor: lowStockCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
      bgColor: lowStockCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
    },
    {
      title: "Total Inventory Value",
      value: formatCurrency(totalValuation),
      subtitle: "Sum of variant price × stock",
      icon: IndianRupee,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
      {statCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-5 rounded-2xl border shadow-sm transition-all"
            style={{ backgroundColor: "var(--app-surface)", borderColor: "var(--app-border)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--app-text-muted)" }}>
                  {card.title}
                </p>
                <h3 className="text-2xl font-bold font-sans tracking-tight" style={{ color: "var(--app-text)" }}>
                  {card.value}
                </h3>
                <p className="text-xs mt-1 font-medium" style={{ color: "var(--app-text-muted)" }}>
                  {card.subtitle}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${card.bgColor} ${card.iconColor}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
