/**
 * Inventory Confirmation Screen - 2-Column Product Layout with Financial Summaries & Sectioned Cards
 * Business-agnostic: supports Retail, Restaurant, Services, Salons, Freelancers, Tutors, etc.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Save,
  ShoppingBag,
  Plus,
  Trash2,
  AlertTriangle,
  History,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  DollarSign,
  Package,
  Layers,
  ArrowLeft,
  Tag,
  FileText,
  Braces
} from "lucide-react";
import { ProductData, ProductVariantData } from "./InventoryIntakeScreen";
import { ProductField } from "./ProductFieldEditor";
import { useAuth } from "../auth-tenancy/AuthContext";
import { authedFetch } from "../../api/client";
import { VoiceMicButton } from "./components/VoiceMicButton";

interface InventoryConfirmationScreenProps {
  companyId?: string;
  businessType?: string;
  products: ProductData[];
  onConfirm: (products: ProductData[]) => void;
  onBack: () => void;
}

const LOW_STOCK_THRESHOLD = 5;

function getStockStatus(stock: number | null): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | null {
  if (stock === null) return null;
  if (stock === 0) return "OUT_OF_STOCK";
  if (stock <= LOW_STOCK_THRESHOLD) return "LOW_STOCK";
  return "IN_STOCK";
}

export interface SpreadsheetTableData {
  columns: string[];
  rows: ProductVariantData[];
}

export function buildInitialSpreadsheetData(product: ProductData): SpreadsheetTableData {
  const columns: string[] = [];
  const optionMap = new Map<string, string[]>();

  const addDimension = (name: string, opts: string[]) => {
    if (!name || !opts || opts.length === 0) return;
    let colName = name;
    if (columns.includes(colName)) {
      colName = `${name} (${opts[0]})`;
    }
    columns.push(colName);
    optionMap.set(colName, opts);
  };

  // 1. Process variant_dimensions (with automatic numeric vs letter size splitting safeguard)
  if (product.variant_dimensions && product.variant_dimensions.length > 0) {
    for (const dim of product.variant_dimensions) {
      if (dim.name && dim.options && dim.options.length > 0) {
        const numOpts = dim.options.filter(o => /^\d+(\.\d+)?$/.test(o.trim()));
        const alphaOpts = dim.options.filter(o => !/^\d+(\.\d+)?$/.test(o.trim()));

        // If mixed numeric (32) and alpha (S, M, L) present in single dim array -> split into 2 separate columns!
        if (numOpts.length > 0 && alphaOpts.length > 0) {
          addDimension(dim.name, numOpts);
          addDimension(dim.name.toLowerCase() === "size" ? "Fit" : `${dim.name} Type`, alphaOpts);
        } else {
          addDimension(dim.name, dim.options);
        }
      }
    }
  }

  // 2. Process base_specifications separately (do NOT merge values into one column)
  if (product.base_specifications) {
    for (const [k, v] of Object.entries(product.base_specifications)) {
      if (!v) continue;
      addDimension(k, [v]);
    }
  }

  // 3. Fallback to keys in product.variants if columns still empty
  if (columns.length === 0 && product.variants && product.variants.length > 0) {
    const keys = new Set<string>();
    product.variants.forEach(v => {
      if (v.attributes) {
        Object.keys(v.attributes).forEach(k => keys.add(k));
      }
    });
    if (keys.size > 0) {
      columns.push(...Array.from(keys));
    }
  }

  // 4. If product.variants already has populated rows with attributes matching existing state
  if (product.variants && product.variants.length > 0 && product.variants.some(v => v.attributes && Object.keys(v.attributes).length > 0)) {
    const rows = product.variants.map(v => {
      const attributes: Record<string, string> = { ...(v.attributes || {}) };
      columns.forEach(col => {
        if (!(col in attributes)) attributes[col] = "";
      });
      return {
        ...v,
        attributes,
        price_override: v.price_override ?? product.price_inr,
        stock: v.stock ?? null
      };
    });
    return { columns, rows };
  }

  // 5. Compute Cartesian product across optionMap
  if (columns.length > 0 && optionMap.size > 0) {
    const optionArrays = columns.map(col => optionMap.get(col) || []);
    if (optionArrays.every(arr => arr.length > 0)) {
      const cartesian = (args: string[][]): string[][] =>
        args.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())), [[]] as string[][]);

      const combinations = cartesian(optionArrays);
      const rows: ProductVariantData[] = combinations.map(combo => {
        const attributes: Record<string, string> = {};
        columns.forEach((col, idx) => {
          attributes[col] = combo[idx];
        });
        const compositeLabel = combo.join(" - ");
        return {
          attribute_value: compositeLabel,
          attributes,
          price_override: product.price_inr ?? null,
          stock: null // Stock is always blank by default!
        };
      });
      return { columns, rows };
    }
  }

  // Fallback: return empty columns and existing rows
  return { columns, rows: product.variants || [] };
}

function VariantSpreadsheetTable({
  productIdx,
  product,
  onUpdateProduct
}: {
  productIdx: number;
  product: ProductData;
  onUpdateProduct: (idx: number, updates: Partial<ProductData>) => void;
}) {
  const [tableData, setTableData] = useState<SpreadsheetTableData>(() => buildInitialSpreadsheetData(product));
  const [newColInput, setNewColInput] = useState("");

  useEffect(() => {
    const initial = buildInitialSpreadsheetData(product);
    setTableData(initial);
    if (!product.variants || product.variants.length === 0) {
      onUpdateProduct(productIdx, {
        variants: initial.rows,
        hasVariants: initial.rows.length > 0
      });
    }
  }, [product.product_type, product.raw_source_fragment]);

  const updateTableState = (newCols: string[], newRows: ProductVariantData[]) => {
    setTableData({ columns: newCols, rows: newRows });
    const variantDimensions = newCols.map(col => ({
      name: col,
      options: [...new Set(newRows.map(r => r.attributes?.[col]).filter(Boolean))] as string[]
    }));
    onUpdateProduct(productIdx, {
      variants: newRows,
      hasVariants: newRows.length > 0,
      variantAttributeNames: newCols.length > 0 ? newCols : undefined,
      variant_dimensions: variantDimensions.length > 0 ? variantDimensions : undefined
    });
  };

  const handleCellChange = (rIdx: number, colName: string, newVal: string) => {
    const updatedRows = tableData.rows.map((row, i) => {
      if (i === rIdx) {
        const updatedAttrs = { ...(row.attributes || {}), [colName]: newVal };
        const updatedComposite = tableData.columns
          .map(c => updatedAttrs[c])
          .filter(Boolean)
          .join(" - ");
        return {
          ...row,
          attributes: updatedAttrs,
          attribute_value: updatedComposite || "Variant"
        };
      }
      return row;
    });
    updateTableState(tableData.columns, updatedRows);
  };

  const handlePriceChange = (rIdx: number, val: string) => {
    const priceNum = val === "" ? null : parseFloat(val) || null;
    const updatedRows = tableData.rows.map((row, i) =>
      i === rIdx ? { ...row, price_override: priceNum } : row
    );
    updateTableState(tableData.columns, updatedRows);
  };

  const handleStockChange = (rIdx: number, val: string) => {
    const stockNum = val === "" ? null : parseInt(val) || null;
    const updatedRows = tableData.rows.map((row, i) =>
      i === rIdx ? { ...row, stock: stockNum } : row
    );
    updateTableState(tableData.columns, updatedRows);
  };

  const handleAddColumn = () => {
    const name = newColInput.trim();
    if (!name || tableData.columns.includes(name)) return;
    const updatedCols = [...tableData.columns, name];
    const updatedRows = tableData.rows.map(row => ({
      ...row,
      attributes: { ...(row.attributes || {}), [name]: "" }
    }));
    setNewColInput("");
    updateTableState(updatedCols, updatedRows);
  };

  const handleDeleteColumn = (colName: string) => {
    const updatedCols = tableData.columns.filter(c => c !== colName);
    const updatedRows = tableData.rows.map(row => {
      const attrs = { ...(row.attributes || {}) };
      delete attrs[colName];
      const updatedComposite = updatedCols.map(c => attrs[c]).filter(Boolean).join(" - ");
      return {
        ...row,
        attributes: attrs,
        attribute_value: updatedComposite || "Variant"
      };
    });
    updateTableState(updatedCols, updatedRows);
  };

  const handleAddRow = () => {
    const blankAttrs: Record<string, string> = {};
    tableData.columns.forEach(c => { blankAttrs[c] = ""; });
    const newRow: ProductVariantData = {
      attribute_value: "New Variant",
      attributes: blankAttrs,
      price_override: product.price_inr ?? null,
      stock: null
    };
    updateTableState(tableData.columns, [...tableData.rows, newRow]);
  };

  const handleDeleteRow = (rIdx: number) => {
    const updatedRows = tableData.rows.filter((_, i) => i !== rIdx);
    updateTableState(tableData.columns, updatedRows);
  };

  return (
    <div className="space-y-4 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
      {/* SPREADSHEET HEADER BANNER */}
      <div className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-saffron" />
          <h4 className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--app-text)' }}>
            Product Variant Matrix — Plain Editable Table ({tableData.rows.length} rows)
          </h4>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          Spreadsheet Active
        </span>
      </div>

      {/* SPREADSHEET TABLE GRID */}
      <div className="overflow-x-auto rounded-xl border shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
              <th className="p-3 font-extrabold text-[11px] uppercase tracking-wider w-10 text-center" style={{ color: 'var(--app-text-muted)' }}>
                #
              </th>
              {tableData.columns.map(col => (
                <th key={col} className="p-3 font-extrabold text-[11px] uppercase tracking-wider group border-r min-w-[120px]" style={{ borderColor: 'var(--app-border)', color: 'var(--brand-saffron)' }}>
                  <div className="flex items-center justify-between gap-1">
                    <span>{col}</span>
                    <button
                      onClick={() => handleDeleteColumn(col)}
                      className="opacity-40 hover:opacity-100 hover:text-red-500 cursor-pointer transition-opacity"
                      title={`Delete '${col}' column`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="p-3 font-extrabold text-[11px] uppercase tracking-wider border-r w-32" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                Price (₹)
              </th>
              <th className="p-3 font-extrabold text-[11px] uppercase tracking-wider border-r w-44" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                Stock Qty
              </th>
              <th className="p-3 font-extrabold text-[11px] uppercase tracking-wider w-16 text-center" style={{ color: 'var(--app-text-muted)' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, rIdx) => {
              const stockStatus = getStockStatus(row.stock);
              return (
                <tr key={rIdx} className="border-b hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--app-border)' }}>
                  <td className="p-2.5 text-center font-bold opacity-50 text-[10px]">
                    {rIdx + 1}
                  </td>
                  {tableData.columns.map(col => (
                    <td key={col} className="p-2 border-r min-w-[120px]" style={{ borderColor: 'var(--app-border)' }}>
                      <input
                        type="text"
                        value={row.attributes?.[col] ?? ""}
                        onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                        placeholder={`Enter ${col}...`}
                        className="w-full px-2 py-1 text-xs font-semibold rounded border border-transparent hover:border-[var(--app-border)] focus:border-brand-saffron focus:bg-[var(--app-bg)] outline-none transition-all"
                        style={{ color: 'var(--app-text)', backgroundColor: 'transparent' }}
                      />
                    </td>
                  ))}
                  {/* PRICE OVERRIDE CELL */}
                  <td className="p-2 border-r w-32" style={{ borderColor: 'var(--app-border)' }}>
                    <input
                      type="number"
                      value={row.price_override ?? ""}
                      onChange={(e) => handlePriceChange(rIdx, e.target.value)}
                      placeholder={`₹${product.price_inr ?? 0}`}
                      className="w-full px-2 py-1 text-xs font-bold rounded border border-transparent hover:border-[var(--app-border)] focus:border-brand-saffron focus:bg-[var(--app-bg)] outline-none transition-all"
                      style={{ color: 'var(--app-text)', backgroundColor: 'transparent' }}
                    />
                  </td>
                  {/* STOCK QTY CELL (ALWAYS BLANK BY DEFAULT) */}
                  <td className="p-2 border-r w-44" style={{ borderColor: 'var(--app-border)' }}>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={row.stock ?? ""}
                        onChange={(e) => handleStockChange(rIdx, e.target.value)}
                        placeholder="Blank"
                        className="w-20 px-2 py-1 text-xs font-bold rounded border border-transparent hover:border-[var(--app-border)] focus:border-brand-saffron focus:bg-[var(--app-bg)] outline-none transition-all"
                        style={{ color: 'var(--app-text)', backgroundColor: 'transparent' }}
                      />
                      {stockStatus && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                          stockStatus === "IN_STOCK" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                          stockStatus === "LOW_STOCK" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                          "bg-red-500/10 text-red-600 border-red-500/20"
                        }`}>
                          {stockStatus === "IN_STOCK" ? "In Stock" : stockStatus === "LOW_STOCK" ? "Low Stock" : "Out"}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* DELETE ROW CELL */}
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleDeleteRow(rIdx)}
                      className="p-1 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                      title="Delete Row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {tableData.rows.length === 0 && (
              <tr>
                <td colSpan={tableData.columns.length + 4} className="p-4 text-center text-xs italic" style={{ color: 'var(--app-text-muted)' }}>
                  No variant rows configured. Click "+ Add Row" below to create one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SPREADSHEET TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-saffron hover:opacity-90 transition cursor-pointer flex items-center gap-1 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Row</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newColInput}
            onChange={(e) => setNewColInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddColumn(); } }}
            placeholder="New Column Name (e.g. Fit, Material)..."
            className="px-2.5 py-1.5 text-xs font-semibold rounded border outline-none min-w-[180px]"
            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          />
          <button
            onClick={handleAddColumn}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border hover:bg-black/5 transition cursor-pointer flex items-center gap-1"
            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          >
            <Plus className="h-3.5 w-3.5 text-brand-saffron" />
            <span>Add Column</span>
          </button>
        </div>
      </div>
    </div>
  );
}


export function InventoryConfirmationScreen({
  companyId,
  businessType,
  products: initialProducts,
  onConfirm,
  onBack
}: InventoryConfirmationScreenProps) {
  const isRestaurant = businessType === "RESTAURANT";


  const [products, setProducts] = useState<ProductData[]>(initialProducts);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{ name: string; existingId: string }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [categoryInput, setCategoryInput] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [categoryFocusIndex, setCategoryFocusIndex] = useState<number | null>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [historyOpenProductId, setHistoryOpenProductId] = useState<string | null>(null);
  const [histories, setHistories] = useState<Record<string, { priceHistory: any[], stockHistory: any[] }>>({});
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [productFieldDefs, setProductFieldDefs] = useState<ProductField[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const existingCategories = useMemo(() => {
    return [...new Set((products || []).flatMap((p: any) => p.categories || []))].sort() as string[];
  }, [products]);

  // Fetch product field definitions
  useEffect(() => {
    if (!companyId) return;
    authedFetch(`/api/companies/${companyId}/product-fields`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setProductFieldDefs(data || []))
      .catch(() => {});
  }, [companyId, token]);

  // Financial Summary Computations across all products in queue
  const totalProductsCount = products.length;
  
  const totalCombinedValue = products.reduce((acc, p) => {
    if (p.hasVariants && p.variants && p.variants.length > 0) {
      const variantValue = p.variants.reduce((vAcc, v) => {
        const price = v.price_override ?? p.price_inr ?? 0;
        const qty = v.stock ?? 1;
        return vAcc + (price * qty);
      }, 0);
      return acc + variantValue;
    } else {
      const price = p.price_inr ?? 0;
      return acc + price;
    }
  }, 0);

  const avgUnitPrice = totalProductsCount > 0
    ? Math.round(products.reduce((acc, p) => acc + (p.price_inr ?? 0), 0) / totalProductsCount)
    : 0;

  const totalVariantsCount = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);

  const lowStockAlertCount = products.reduce((acc, p) => {
    if (p.variants && p.variants.length > 0) {
      const lowCount = p.variants.filter(v => v.stock !== null && v.stock <= LOW_STOCK_THRESHOLD).length;
      return acc + lowCount;
    }
    return acc;
  }, 0);

  const updateProduct = (idx: number, updates: Partial<ProductData>) => {
    const newProducts = [...products];
    newProducts[idx] = { ...newProducts[idx], ...updates };
    setProducts(newProducts);
  };

  const handleVoiceExtractionForProduct = (idx: number, extracted: any) => {
    if (!extracted) return;
    const current = products[idx];
    if (!current) return;

    const updates: Partial<ProductData> = {};

    if (extracted.product_name) {
      updates.product_type = extracted.product_name;
    }
    if (typeof extracted.price === "number") {
      updates.price_inr = extracted.price;
    }
    if (extracted.description) {
      updates.description = extracted.description;
    }

    if (extracted.category) {
      const existingCats = current.categories || [];
      if (!existingCats.includes(extracted.category)) {
        updates.categories = [...existingCats, extracted.category];
      }
    }

    const currentCustom = { ...(current.customFieldValues || {}) };
    if (extracted.fabric_type) {
      currentCustom["Fabric Type"] = extracted.fabric_type;
      currentCustom["fabric_type"] = extracted.fabric_type;
      updates.customFieldValues = currentCustom;
    }

    if (typeof extracted.stock === "number") {
      let variants = [...(current.variants || [])];
      if (variants.length === 0) {
        variants = [
          {
            attribute_name: "Default",
            attribute_value: "Standard",
            price_override: extracted.price ?? current.price_inr ?? null,
            stock: extracted.stock,
          },
        ];
        updates.hasVariants = true;
      } else {
        variants[0] = {
          ...variants[0],
          stock: extracted.stock,
        };
      }
      updates.variants = variants;
    }

    updateProduct(idx, updates);
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

  const addCategory = (idx: number, cat: string) => {
    const trimmed = cat.trim();
    if (!trimmed) return;
    const product = products[idx];
    const current = product.categories || [];
    if (current.includes(trimmed)) return;
    updateProduct(idx, { categories: [...current, trimmed] });
  };

  const removeCategory = (idx: number, cat: string) => {
    const product = products[idx];
    updateProduct(idx, { categories: (product.categories || []).filter(c => c !== cat) });
  };

  const handleCategoryKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCategory(idx, categoryInput);
      setCategoryInput("");
    }
    if (e.key === "Backspace" && !categoryInput) {
      const product = products[idx];
      const cats = product.categories || [];
      if (cats.length > 0) removeCategory(idx, cats[cats.length - 1]);
    }
  };

  const handleUploadImage = async (productIdx: number, file: File) => {
    const product = products[productIdx];
    if (!product || !product.id) {
      alert("Please save/confirm the basic details of this product first before uploading gallery images.");
      return;
    }
    
    setUploadingProductId(product.id);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory/${product.id}/images`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to upload image");
      }

      const data = await response.json();
      const updatedProducts = [...products];
      const currentImages = (product as any).images || [];
      updatedProducts[productIdx] = {
        ...product,
        images: [...currentImages, data.image],
        imageUrl: currentImages.length === 0 ? data.image.url : product.imageUrl
      } as any;
      setProducts(updatedProducts);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(err.message || "Failed to upload image");
    } finally {
      setUploadingProductId(null);
    }
  };

  const handleDeleteImage = async (productIdx: number, imageId: string) => {
    const product = products[productIdx];
    if (!product.id) return;

    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory/${product.id}/images/${imageId}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error("Failed to delete image");

      const updatedProducts = [...products];
      const currentImages = (product as any).images || [];
      const newImages = currentImages.filter((img: any) => img.id !== imageId);
      
      const orderedImages = newImages.map((img: any, i: number) => ({ ...img, order: i }));
      const newPrimaryUrl = orderedImages[0]?.url || null;

      updatedProducts[productIdx] = {
        ...product,
        images: orderedImages,
        imageUrl: newPrimaryUrl
      } as any;
      setProducts(updatedProducts);
    } catch (err: any) {
      console.error("Delete image error:", err);
      alert("Failed to delete image");
    }
  };

  const handleMoveImage = async (productIdx: number, imageIdx: number, direction: "left" | "right") => {
    const product = products[productIdx];
    const currentImages = (product as any).images || [];
    if (!product.id || currentImages.length === 0) return;

    const newImages = [...currentImages];
    const targetIdx = direction === "left" ? imageIdx - 1 : imageIdx + 1;
    if (targetIdx < 0 || targetIdx >= newImages.length) return;

    const temp = newImages[imageIdx];
    newImages[imageIdx] = newImages[targetIdx];
    newImages[targetIdx] = temp;

    const orderedImages = newImages.map((img, i) => ({ ...img, order: i }));
    const imageIds = orderedImages.map(img => img.id);

    try {
      const updatedProducts = [...products];
      updatedProducts[productIdx] = {
        ...product,
        images: orderedImages,
        imageUrl: orderedImages[0]?.url || null
      } as any;
      setProducts(updatedProducts);

      const response = await authedFetch(`/api/companies/${companyId}/inventory/${product.id}/images/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds })
      });

      if (!response.ok) throw new Error("Failed to save reorder");
    } catch (err) {
      console.error("Reorder image error:", err);
    }
  };

  const handleToggleHistory = async (productId: string) => {
    if (historyOpenProductId === productId) {
      setHistoryOpenProductId(null);
      return;
    }

    setHistoryOpenProductId(productId);
    if (histories[productId]) return;

    setLoadingHistoryId(productId);
    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory/${productId}/history`);
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setHistories(prev => ({
        ...prev,
        [productId]: {
          priceHistory: data.priceHistory || [],
          stockHistory: data.stockHistory || []
        }
      }));
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoadingHistoryId(null);
    }
  };

  const checkDuplicates = async () => {
    if (!companyId) return false;
    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory/check-duplicates`, {
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

    await checkDuplicates();

    try {
      const response = await authedFetch(`/api/companies/${companyId}/inventory/confirm`, {
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
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center py-16 p-8 rounded-2xl border space-y-4" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
          <div className="h-16 w-16 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)', color: 'var(--brand-saffron)' }}>
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--app-text)' }}>
            No Products to Confirm
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--app-text-muted)' }}>
            You don't have any items pending confirmation. Type your inventory in Step 1 or start a fresh entry.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white inline-flex items-center gap-2 shadow cursor-pointer"
            style={{ backgroundColor: 'var(--brand-saffron)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Intake</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header with Breadcrumb & Multi-Step Progress Tracker */}
      <div className="rounded-2xl p-4 sm:p-6 border backdrop-blur-sm shadow-sm space-y-4" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--app-text-muted)' }}>
          <span className="hover:underline cursor-pointer" onClick={onBack}>Inventory</span>
          <span>/</span>
          <span className="hover:underline cursor-pointer" onClick={onBack}>Intake</span>
          <span>/</span>
          <span className="font-bold text-brand-saffron">Product Confirmation</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border hover:bg-black/5 transition cursor-pointer"
              style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              title="Back to Intake"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: 'var(--app-text)' }}>
                Confirm & Fine-Tune Catalog Items
              </h1>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                Review extracted details, set image galleries, customize variant prices, and adjust stock quantities.
              </p>
            </div>
          </div>

          {/* Stepper Visual Pills */}
          <div className="flex items-center gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border opacity-60 cursor-pointer" onClick={onBack} style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold" style={{ borderColor: 'var(--app-border)' }}>1</span>
              <span>Intake</span>
            </div>
            <span style={{ color: 'var(--app-border)' }}>—</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border font-bold" style={{ backgroundColor: 'rgba(211, 107, 70, 0.12)', borderColor: 'var(--brand-saffron)', color: 'var(--brand-saffron)' }}>
              <span className="h-5 w-5 rounded-full bg-brand-saffron text-white flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Confirm</span>
            </div>
            <span style={{ color: 'var(--app-border)' }}>—</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border opacity-60" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
              <span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold" style={{ borderColor: 'var(--app-border)' }}>3</span>
              <span>Save</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Financial & Queue Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Queue Items */}
        <div className="p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)', color: 'var(--brand-saffron)' }}>
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
              Items to Save
            </p>
            <p className="text-xl font-extrabold" style={{ color: 'var(--app-text)' }}>
              {totalProductsCount} {totalProductsCount === 1 ? 'Product' : 'Products'}
            </p>
          </div>
        </div>

        {/* Metric 2: Total Combined Value */}
        <div className="p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
              Est. Inventory Value
            </p>
            <p className="text-xl font-extrabold" style={{ color: 'var(--app-text)' }}>
              ₹{totalCombinedValue.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Metric 3: Avg Unit Price */}
        <div className="p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
              Avg Unit Price
            </p>
            <p className="text-xl font-extrabold" style={{ color: 'var(--app-text)' }}>
              ₹{avgUnitPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Metric 4: Stock Health Alerts */}
        <div className="p-4 rounded-xl border flex items-center gap-3 shadow-sm" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${lowStockAlertCount > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
              Variant Rows / Alerts
            </p>
            <p className="text-xl font-extrabold flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
              <span>{totalVariantsCount} Rows</span>
              {lowStockAlertCount > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700">
                  {lowStockAlertCount} Low
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Main Product Cards List */}
      <div className="space-y-8">
        <AnimatePresence>
          {products.map((product, idx) => {
            const productImages = (product as any).images || [];
            const primaryImageUrl = productImages[0]?.url || product.imageUrl;

            // Product stock summary computation
            const variantCount = product.variants?.length || 0;
            const totalStockCount = product.variants?.reduce((acc, v) => acc + (v.stock ?? 0), 0) ?? null;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-6 sm:p-8 rounded-2xl border shadow-sm space-y-6"
                style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
              >
                {/* Product Header */}
                <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-lg bg-brand-saffron text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                      #{idx + 1}
                    </span>
                    <div>
                      <h2 className="text-lg font-extrabold flex items-center gap-2" style={{ color: 'var(--app-text)' }}>
                        {product.product_type || "Untitled Item"}
                        {product.customFieldValues?.Brand && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'rgba(211, 107, 70, 0.1)', color: 'var(--brand-saffron)' }}>
                            {product.customFieldValues.Brand}
                          </span>
                        )}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <VoiceMicButton
                      companyId={companyId}
                      buttonText="Fill with voice"
                      compact
                      onExtractionComplete={(res) => handleVoiceExtractionForProduct(idx, res.extracted)}
                    />
                    {product.sku && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded border" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                        SKU: {product.sku}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2-Column Responsive Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* LEFT COLUMN (4 Cols): Media Gallery & Financial Stats */}
                  <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
                    {/* Media Gallery Card */}
                    <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                          <ImageIcon className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                          Product Gallery ({productImages.length}/10)
                        </h3>
                        {primaryImageUrl && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Primary Set
                          </span>
                        )}
                      </div>

                      {/* Primary Cover Image Preview */}
                      <div className="relative aspect-square rounded-xl overflow-hidden border flex items-center justify-center group" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                        {primaryImageUrl ? (
                          <img src={primaryImageUrl} alt={product.product_type} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center p-4 space-y-2" style={{ color: 'var(--app-text-muted)' }}>
                            <ImageIcon className="h-10 w-10 mx-auto opacity-40" />
                            <p className="text-xs font-medium">No cover image uploaded</p>
                          </div>
                        )}
                      </div>

                      {/* Thumbnails & Reorder Strip */}
                      {product.id ? (
                        <div className="flex flex-wrap gap-2 items-center">
                          {productImages.map((img: any, imgIdx: number) => (
                            <div key={img.id} className="relative group w-14 h-14 rounded-lg overflow-hidden border shrink-0" style={{ borderColor: 'var(--app-border)' }}>
                              <img src={img.url} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-0.5">
                                <button
                                  onClick={() => handleDeleteImage(idx, img.id)}
                                  className="self-end p-0.5 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                                <div className="flex justify-between w-full">
                                  <button
                                    disabled={imgIdx === 0}
                                    onClick={() => handleMoveImage(idx, imgIdx, "left")}
                                    className="p-0.5 bg-white/80 hover:bg-white text-gray-800 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronLeft className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    disabled={imgIdx === productImages.length - 1}
                                    onClick={() => handleMoveImage(idx, imgIdx, "right")}
                                    className="p-0.5 bg-white/80 hover:bg-white text-gray-800 rounded disabled:opacity-30 cursor-pointer"
                                  >
                                    <ChevronRight className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                              <span className="absolute top-0.5 left-0.5 bg-black/70 text-white text-[8px] font-bold px-1 rounded">
                                #{imgIdx + 1}
                              </span>
                            </div>
                          ))}

                          {productImages.length < 10 && (
                            <label className="flex flex-col items-center justify-center w-14 h-14 rounded-lg border border-dashed hover:bg-black/5 transition cursor-pointer shrink-0" style={{ borderColor: 'var(--app-border)' }}>
                              {uploadingProductId === product.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-brand-saffron" />
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 opacity-50" />
                                  <span className="text-[9px] opacity-70 mt-0.5">Add</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                disabled={uploadingProductId !== null}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadImage(idx, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] italic" style={{ color: 'var(--app-text-muted)' }}>
                          💡 Save products to enable high-resolution image gallery uploads.
                        </p>
                      )}
                    </div>

                    {/* Product Financial Quick Stat Card */}
                    <div className="p-5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                      <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--app-text)' }}>
                        <DollarSign className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                        Financial Overview
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span style={{ color: 'var(--app-text-muted)' }}>Base Unit Price:</span>
                          <span className="font-extrabold text-base text-brand-saffron">
                            ₹{product.price_inr ?? 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span style={{ color: 'var(--app-text-muted)' }}>Configured Variants:</span>
                          <span className="font-bold">{variantCount} {variantCount === 1 ? 'row' : 'rows'}</span>
                        </div>
                        {totalStockCount !== null && (
                          <div className="flex justify-between items-center text-xs">
                            <span style={{ color: 'var(--app-text-muted)' }}>Total Stock Units:</span>
                            <span className="font-bold">{totalStockCount} units</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN (8 Cols): Distinct Sectioned Visual Cards */}
                  <div className="lg:col-span-8 space-y-6">
                    
                    {/* SECTION CARD 1: Basic Information */}
                    <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
                        <FileText className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                        <h3 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: 'var(--app-text)' }}>
                          1. Basic Information
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Product / Service Name */}
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                            Product / Service Title *
                          </label>
                          <input
                            type="text"
                            value={product.product_type}
                            onChange={(e) => handleProductTypeChange(idx, e.target.value)}
                            placeholder="Product or service name"
                            className="w-full px-3.5 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-brand-saffron focus:outline-none transition-all"
                            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          />
                        </div>

                        {/* Categories Manager */}
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                            Categories & Tags
                          </label>
                          <div
                            className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-lg border min-h-[42px] cursor-text"
                            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                            onClick={() => categoryInputRef.current?.focus()}
                          >
                            {(product.categories || []).map((cat) => (
                              <span key={cat} className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}>
                                {cat}
                                <button onClick={(e) => { e.stopPropagation(); removeCategory(idx, cat); }} className="cursor-pointer hover:opacity-70">
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <div className="relative flex-1 min-w-[130px]">
                              <input
                                ref={categoryInputRef}
                                type="text"
                                value={idx === categoryFocusIndex ? categoryInput : ""}
                                onChange={(e) => { setCategoryFocusIndex(idx); setCategoryInput(e.target.value); setShowCategorySuggestions(true); }}
                                onFocus={() => { setCategoryFocusIndex(idx); setShowCategorySuggestions(true); }}
                                onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                                onKeyDown={(e) => handleCategoryKeyDown(idx, e)}
                                placeholder="Add category (press Enter)..."
                                className="w-full bg-transparent text-xs outline-none"
                                style={{ color: 'var(--app-text)' }}
                              />
                              {showCategorySuggestions && categoryFocusIndex === idx && existingCategories.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 max-h-32 overflow-y-auto rounded-lg border z-20 shadow-lg" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                  {existingCategories
                                    .filter(c => !(product.categories || []).includes(c) && c.toLowerCase().includes(categoryInput.toLowerCase()))
                                    .slice(0, 10)
                                    .map((cat) => (
                                      <button
                                        key={cat}
                                        onMouseDown={(e) => { e.preventDefault(); addCategory(idx, cat); setCategoryInput(""); }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--app-bg)] transition cursor-pointer"
                                        style={{ color: 'var(--app-text)' }}
                                      >
                                        + {cat}
                                      </button>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* SKU */}
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                            SKU Code
                          </label>
                          <input
                            type="text"
                            value={product.sku || ""}
                            onChange={(e) => updateProduct(idx, { sku: e.target.value || undefined })}
                            placeholder="Auto-generated if empty"
                            className="w-full px-3.5 py-2 text-sm rounded-lg border font-mono focus:ring-2 focus:ring-brand-saffron focus:outline-none transition-all"
                            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          />
                        </div>

                        {/* LEGACY - remove after cutover verified: Restaurant Availability Toggle */}
                        {isRestaurant && (
                          <div className="flex items-center justify-between p-3 rounded-lg border" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                            <div>
                              <span className="text-xs font-bold block" style={{ color: 'var(--app-text)' }}>
                                Menu Item Availability <span className="text-[9px] font-normal opacity-50">(Legacy)</span>
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                                {(product.isAvailable ?? true) ? "Available for ordering" : "Currently sold out"}
                              </span>
                            </div>
                            <button
                              onClick={() => handleAvailabilityChange(idx, !(product.isAvailable ?? true))}
                              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                                (product.isAvailable ?? true) ? 'bg-emerald-500' : 'bg-gray-400'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                  (product.isAvailable ?? true) ? 'translate-x-5' : ''
                                }`}
                              />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION CARD 1b: Dynamic Product Fields (from ProductFieldDefinition) */}
                    {productFieldDefs.filter(f => f.appliesTo === "product").length > 0 && (
                      <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
                          <Braces className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                          <h3 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: 'var(--app-text)' }}>
                            Custom Product Fields
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {productFieldDefs
                            .filter(f => f.appliesTo === "product")
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map((field) => {
                              const currentValues = product.customFieldValues || {};
                              const currentValue = currentValues[field.fieldName] || "";

                              const handleCustomFieldChange = (value: string) => {
                                const updatedValues = { ...currentValues, [field.fieldName]: value };
                                updateProduct(idx, { customFieldValues: updatedValues });
                              };

                              if (field.fieldType === "boolean") {
                                return (
                                  <div key={field.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                    <span className="text-xs font-bold" style={{ color: 'var(--app-text)' }}>{field.fieldName}</span>
                                    <button
                                      onClick={() => handleCustomFieldChange(currentValue === "true" ? "false" : "true")}
                                      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                                        currentValue === "true" ? 'bg-emerald-500' : 'bg-gray-400'
                                      }`}
                                    >
                                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                        currentValue === "true" ? 'translate-x-5' : ''
                                      }`} />
                                    </button>
                                  </div>
                                );
                              }

                              if (field.fieldType === "select" && field.options.length > 0) {
                                return (
                                  <div key={field.id}>
                                    <label className="block text-xs font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                                      {field.fieldName}
                                    </label>
                                    <select
                                      value={currentValue}
                                      onChange={(e) => handleCustomFieldChange(e.target.value)}
                                      className="w-full px-3.5 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-brand-saffron focus:outline-none transition-all"
                                      style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                                    >
                                      <option value="">Select...</option>
                                      {field.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              }

                              return (
                                <div key={field.id}>
                                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                                    {field.fieldName}
                                  </label>
                                  <input
                                    type={field.fieldType === "number" ? "number" : "text"}
                                    value={currentValue}
                                    onChange={(e) => handleCustomFieldChange(e.target.value)}
                                    placeholder={`Enter ${field.fieldName}...`}
                                    className="w-full px-3.5 py-2 text-sm rounded-lg border focus:ring-2 focus:ring-brand-saffron focus:outline-none transition-all"
                                    style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                                  />
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* SECTION CARD 2: Pricing & Variant Matrix (2-Part Flow) */}
                    <div className="p-5 rounded-xl border space-y-4" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--app-border)' }}>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                          <h3 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: 'var(--app-text)' }}>
                            2. Pricing & Variant Management
                          </h3>
                        </div>
                      </div>

                      {/* Base Price Field */}
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                          Base Price (₹ INR) *
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-extrabold" style={{ color: 'var(--brand-saffron)' }}>₹</span>
                          <input
                            type="number"
                            value={product.price_inr ?? ""}
                            onChange={(e) => handlePriceChange(idx, e.target.value)}
                            placeholder="0.00"
                            className="flex-1 px-4 py-2.5 text-xl font-extrabold rounded-lg border focus:ring-2 focus:ring-brand-saffron focus:outline-none transition-all"
                            style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                          />
                        </div>
                      </div>

                      {/* UNPARSED NOTES / OVERFLOW WARNING BANNER */}
                      {product.unparsed_notes && (
                        <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5">
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">AI Extraction Notice</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">{product.unparsed_notes}</p>
                          </div>
                        </div>
                      )}

                      {/* SPREADSHEET VARIANT TABLE SECTION */}
                      <VariantSpreadsheetTable
                        productIdx={idx}
                        product={product}
                        onUpdateProduct={updateProduct}
                      />
                    </div>

                    {/* SECTION CARD 3: Audit & History Timeline Log (for saved items) */}
                    {product.id && (
                      <div className="p-5 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                        <button
                          onClick={() => handleToggleHistory(product.id!)}
                          className="w-full flex items-center justify-between text-xs font-extrabold uppercase tracking-wider cursor-pointer"
                          style={{ color: 'var(--app-text)' }}
                        >
                          <span className="flex items-center gap-2">
                            <History className="h-4 w-4" style={{ color: 'var(--brand-saffron)' }} />
                            Audit & Activity Log
                          </span>
                          <span className="text-xs text-brand-saffron underline">
                            {historyOpenProductId === product.id ? "Hide Log" : "View Log"}
                          </span>
                        </button>

                        {historyOpenProductId === product.id && (
                          <div className="mt-3 pl-4 border-l-2 border-dashed ml-2 space-y-3 pt-2" style={{ borderColor: 'var(--app-border)' }}>
                            {loadingHistoryId === product.id ? (
                              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-saffron" />
                                <span>Fetching timeline...</span>
                              </div>
                            ) : (() => {
                              const productHistory = histories[product.id!];
                              if (!productHistory) return null;

                              const events = [
                                ...(productHistory.priceHistory || []).map(p => ({
                                  type: 'price',
                                  date: new Date(p.changedAt),
                                  content: `Price updated from ₹${p.oldPrice} to ₹${p.newPrice}`,
                                  actor: p.actorName || 'System'
                                })),
                                ...(productHistory.stockHistory || []).map(s => ({
                                  type: 'stock',
                                  date: new Date(s.changedAt),
                                  content: `Stock updated from ${s.oldStock ?? 'none'} to ${s.newStock}`,
                                  actor: s.actorName || 'System'
                                }))
                              ].sort((a, b) => b.date.getTime() - a.date.getTime());

                              if (events.length === 0) {
                                return (
                                  <p className="text-xs italic" style={{ color: 'var(--app-text-muted)' }}>
                                    No changes recorded yet for this product.
                                  </p>
                                );
                              }

                              return events.map((event, evIdx) => (
                                <div key={evIdx} className="relative flex flex-col space-y-0.5">
                                  <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-brand-saffron" />
                                  <p className="text-xs font-semibold" style={{ color: 'var(--app-text)' }}>
                                    {event.content}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--app-text-muted)' }}>
                                    <span>{event.date.toLocaleString()}</span>
                                    <span>•</span>
                                    <span>By: {event.actor}</span>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION CARD 4: Raw AI Fragment */}
                    <div className="p-4 rounded-xl border" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                        <span className="font-bold text-brand-saffron mr-1">Raw AI Source Fragment:</span>
                        "{product.raw_source_fragment}"
                      </p>
                    </div>

                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Duplicate Warning Banner */}
      {showDuplicateWarning && duplicates.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {duplicates.length} product(s) already exist in catalog and will be updated:
            </p>
            <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
              {duplicates.map((d, i) => (
                <li key={i}>{d.name}</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setShowDuplicateWarning(false)} className="text-amber-600 hover:text-amber-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bottom Save Action Bar */}
      <div className="rounded-2xl p-4 sm:p-6 border backdrop-blur-sm shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4" style={{ backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Intake</span>
        </button>

        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: 'var(--brand-saffron)' }}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving Products to Catalog...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check className="h-4 w-4" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Confirm & Save {products.length} {products.length === 1 ? 'Product' : 'Products'}</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
