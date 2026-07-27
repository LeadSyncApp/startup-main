import React, { useState, useEffect } from "react";
import {
  Braces, Plus, Trash2, BadgeInfo,
  Layers, ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { authedFetch } from "../../api/client";

export interface ProductField {
  id: string;
  fieldName: string;
  fieldType: "text" | "number" | "boolean" | "select";
  appliesTo: "product" | "variant";
  options: string[];
  sortOrder: number;
}

interface ProductFieldEditorProps {
  companyId?: string;
  onFieldsChange?: (fields: ProductField[]) => void;
}

export function ProductFieldEditor({ companyId: propCompanyId, onFieldsChange }: ProductFieldEditorProps) {
  const auth = useAuth();
  const companyId = propCompanyId || auth?.companyId;

  const [fields, setFields] = useState<ProductField[]>([]);
  const [loading, setLoading] = useState(!!companyId);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<ProductField["fieldType"]>("text");
  const [newFieldAppliesTo, setNewFieldAppliesTo] = useState<ProductField["appliesTo"]>("product");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const [newFieldSortOrder, setNewFieldSortOrder] = useState(0);

  useEffect(() => {
    if (companyId) {
      fetchFields();
    } else {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (onFieldsChange) {
      onFieldsChange(fields);
    }
  }, [fields]);

  const fetchFields = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const response = await authedFetch(`/api/companies/${companyId}/product-fields`);
      if (response.ok) {
        const data = await response.json();
        setFields(data);
      }
    } catch (error) {
      console.error("Failed to fetch product fields:", error);
      toast.error("Failed to load product fields");
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      toast.error("Please enter a valid field name");
      return;
    }

    const normalizedKey = newFieldName
      .trim()
      .replace(/[^a-zA-Z0-9_]/g, "")
      .replace(/^[0-9]+/, "");

    if (!normalizedKey) {
      toast.error("Field name should contain alphanumeric characters only.");
      return;
    }

    if (fields.some((f) => f.fieldName.toLowerCase() === normalizedKey.toLowerCase())) {
      toast.error(`A field with name "${normalizedKey}" already exists.`);
      return;
    }

    if (companyId) {
      // API mode
      try {
        const response = await authedFetch(`/api/companies/${companyId}/product-fields`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fieldName: normalizedKey,
            fieldType: newFieldType,
            appliesTo: newFieldAppliesTo,
            options: newFieldType === "select" ? newFieldOptions.split(",").map(o => o.trim()).filter(Boolean) : [],
            sortOrder: newFieldSortOrder,
          }),
        });

        if (response.ok) {
          const newField = await response.json();
          setFields((prev) => [...prev, newField]);
          toast.success(`Field "${normalizedKey}" was created.`);
          resetForm();
        } else {
          const err = await response.json();
          toast.error(err.message || "Failed to create field");
        }
      } catch (error) {
        toast.error("Failed to create field");
      }
    } else {
      // Draft mode (no API)
      const newField: ProductField = {
        id: `draft-${Date.now()}`,
        fieldName: normalizedKey,
        fieldType: newFieldType,
        appliesTo: newFieldAppliesTo,
        options: newFieldType === "select" ? newFieldOptions.split(",").map(o => o.trim()).filter(Boolean) : [],
        sortOrder: newFieldSortOrder,
      };
      setFields((prev) => [...prev, newField]);
      toast.success(`Field "${normalizedKey}" was added.`);
      resetForm();
    }
  };

  const handleRemoveField = async (id: string, name: string) => {
    if (companyId && !id.startsWith("draft-")) {
      // API mode
      try {
        const response = await authedFetch(`/api/companies/${companyId}/product-fields/${id}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setFields((prev) => prev.filter((f) => f.id !== id));
          toast.success(`Field "${name}" was deleted.`);
        } else {
          const err = await response.json();
          toast.error(err.message || "Failed to delete field");
        }
      } catch (error) {
        toast.error("Failed to delete field");
      }
    } else {
      // Draft mode
      setFields((prev) => prev.filter((f) => f.id !== id));
      toast.success(`Field "${name}" was removed.`);
    }
  };

  const resetForm = () => {
    setNewFieldName("");
    setNewFieldType("text");
    setNewFieldAppliesTo("product");
    setNewFieldOptions("");
    setNewFieldSortOrder(0);
  };

  return (
    <div data-tour="product-fields" className="p-4 bg-slate-950 rounded-2xl border border-slate-900 shadow-2xl selection:bg-indigo-500/10 text-xs">
      {/* Upper bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-4 mb-5 gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
            <Braces className="h-4.5 w-4.5 text-cyan-400" />
            Product Field Definitions
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {companyId
              ? "Define custom fields for products and variants. These fields will appear when adding or editing inventory."
              : "Define custom fields for your products. These fields will be saved when you complete setup."}
          </p>
        </div>
        <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded">
          {companyId ? "INVENTORY SCHEMA" : "DRAFT MODE"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form declaration */}
        <form data-tour="product-fields-form" onSubmit={handleAddField} className="lg:col-span-4 space-y-4 font-mono">
          <h3 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-900">
            <Layers className="h-4 w-4 text-slate-500" />
            Add New Field
          </h3>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Field Name</label>
            <input
              type="text"
              required
              placeholder="e.g. brand, color, size"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Field Type</label>
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="select">Select (Dropdown)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Applies To</label>
            <select
              value={newFieldAppliesTo}
              onChange={(e) => setNewFieldAppliesTo(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="product">Product</option>
              <option value="variant">Variant</option>
            </select>
          </div>

          {newFieldType === "select" && (
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Options (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Red, Blue, Green"
                value={newFieldOptions}
                onChange={(e) => setNewFieldOptions(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Sort Order</label>
            <input
              type="number"
              value={newFieldSortOrder}
              onChange={(e) => setNewFieldSortOrder(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 font-extrabold px-3 py-2 border border-slate-800 hover:border-slate-700 text-cyan-400 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Field</span>
          </button>
        </form>

        {/* Catalog render table view list */}
        <div className="lg:col-span-8 space-y-4">
          <h3 className="font-extrabold font-mono text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-900">
            <ArrowRight className="h-4 w-4 text-slate-500" />
            Active Product Fields ({fields.length} Fields Defined)
          </h3>

          {loading ? (
            <p className="text-slate-500 text-[11px]">Loading fields...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-900 text-slate-500 text-[9px] uppercase tracking-wider">
                    <th className="py-2.5">Field Name</th>
                    <th className="py-2.5">Type</th>
                    <th className="py-2.5">Applies To</th>
                    <th className="py-2.5">Options</th>
                    <th className="py-2.5">Order</th>
                    <th className="py-2.5 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 relative">
                  {fields.map((field) => (
                    <tr key={field.id} className="text-slate-300 hover:bg-slate-900/10 transition-colors">
                      <td className="py-3 pr-2">
                        <span className="font-extrabold text-white text-xs">{field.fieldName}</span>
                      </td>
                      <td className="py-3 pr-2 text-indigo-400 text-[10px] font-black uppercase">
                        {field.fieldType}
                      </td>
                      <td className="py-3 pr-2 text-slate-400 italic capitalize">
                        {field.appliesTo}
                      </td>
                      <td className="py-3 pr-2 text-slate-500 text-[10px]">
                        {field.options.length > 0 ? field.options.join(", ") : "—"}
                      </td>
                      <td className="py-3 pr-2 text-slate-500">
                        {field.sortOrder}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id, field.fieldName)}
                          className="text-slate-600 transition-colors cursor-pointer hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex gap-2">
            <BadgeInfo className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              <span className="text-white font-mono font-extrabold block uppercase tracking-widest text-[9px] mb-1">
                Product Field Guide
              </span>
              Fields marked as "product" apply to the entire product. Fields marked as "variant" apply to individual variants (e.g., size, color). Select-type fields will show a dropdown when entering inventory.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductFieldEditor;
