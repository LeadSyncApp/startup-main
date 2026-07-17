import React, { useState } from "react";
import { 
  Braces, Plus, Trash2, BadgeInfo,
  Layers, ToggleLeft, ToggleRight, ArrowRightLeft 
} from "lucide-react";
import toast from "react-hot-toast";

interface CustomField {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER" | "BOOLEAN" | "SELECTION";
  fallback: string;
  required: boolean;
  validationRule?: string;
}

export function MetadataManager() {
  const [fields, setFields] = useState<CustomField[]>([
    {
      id: "f-1",
      name: "aiPriority",
      type: "SELECTION",
      fallback: "ROUTINE",
      required: true,
      validationRule: "CRITICAL|ELEVATED|ROUTINE",
    },
    {
      id: "f-2",
      name: "customerVipStatus",
      type: "BOOLEAN",
      fallback: "FALSE",
      required: false,
    },
    {
      id: "f-3",
      name: "preferredLanguage",
      type: "TEXT",
      fallback: "Hindi-English",
      required: false,
      validationRule: "^[a-zA-Z-]{3,15}$",
    },
    {
      id: "f-4",
      name: "targetImpactScore",
      type: "NUMBER",
      fallback: "0",
      required: false,
    },
  ]);

  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<CustomField["type"]>("TEXT");
  const [newFieldFallback, setNewFieldFallback] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldRule, setNewFieldRule] = useState("");

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      toast.error("Please enter a valid attribute key");
      return;
    }

    // Enforce camelCase keys for database parameter schema integrations safely
    const normalizedKey = newFieldName
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "")
      .replace(/^[0-9]+/, "");

    if (!normalizedKey) {
      toast.error("Attribute keys should contain alphanumeric characters only.");
      return;
    }

    if (fields.some((f) => f.name.toLowerCase() === normalizedKey.toLowerCase())) {
      toast.error(`Key name "${normalizedKey}" is already reserved in our CRM metadata.`);
      return;
    }

    const newField: CustomField = {
      id: `f-${Date.now()}`,
      name: normalizedKey,
      type: newFieldType,
      fallback: newFieldFallback.trim() || (newFieldType === "BOOLEAN" ? "FALSE" : "N/A"),
      required: newFieldRequired,
      validationRule: newFieldRule.trim() || undefined,
    };

    setFields((prev) => [...prev, newField]);
    toast.success(`Metadata key "${normalizedKey}" was registered!`);

    // Reset Forms
    setNewFieldName("");
    setNewFieldFallback("");
    setNewFieldRequired(false);
    setNewFieldRule("");
  };

  const handleRemoveField = (id: string, name: string) => {
    if (name === "aiPriority") {
      toast.error("Standard system attribute 'aiPriority' cannot be deleted.");
      return;
    }
    setFields((prev) => prev.filter((f) => f.id !== id));
    toast.success(`Metadata parameter "${name}" was deprecated.`);
  };

  return (
    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-900 shadow-2xl selection:bg-indigo-500/10 text-xs">
      {/* Upper bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-900 pb-4 mb-5 gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
            <Braces className="h-4.5 w-4.5 text-cyan-400" />
            Dynamic CRM Metadata Registry
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Declare custom tracking variables. Expose keys to rule-base AI classification flows.
          </p>
        </div>
        <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded">
          CRM-SCHEMA EXTENSION
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form declaration */}
        <form onSubmit={handleAddField} className="lg:col-span-4 space-y-4 font-mono">
          <h3 className="font-extrabold text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-900">
            <Layers className="h-4 w-4 text-slate-500" />
            Declare Attribute Link
          </h3>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Field Name Key</label>
            <input
              type="text"
              required
              placeholder="e.g. referredByChannel"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Value Type Class</label>
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="TEXT">TEXT (String)</option>
              <option value="NUMBER">NUMBER (Int/Float)</option>
              <option value="BOOLEAN">BOOLEAN (True/False)</option>
              <option value="SELECTION">SELECTION (Regex/Match)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Default Fallback</label>
            <input
              type="text"
              placeholder="e.g. Unknown"
              value={newFieldFallback}
              onChange={(e) => setNewFieldFallback(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 uppercase block font-extrabold">Regex Validation Constraint</label>
            <input
              type="text"
              placeholder="e.g. ^[0-9a-zA-Z_]+$"
              value={newFieldRule}
              onChange={(e) => setNewFieldRule(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between py-1 border-t border-b border-slate-900">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-extrabold">Enforced Field Mandatory</span>
            <button
              type="button"
              onClick={() => setNewFieldRequired(!newFieldRequired)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {newFieldRequired ? (
                <ToggleRight className="h-6 w-6 text-cyan-400" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-slate-600" />
              )}
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 font-extrabold px-3 py-2 border border-slate-800 hover:border-slate-700 text-cyan-400 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Register Key</span>
          </button>
        </form>

        {/* Catalog render table view list */}
        <div className="lg:col-span-8 space-y-4">
          <h3 className="font-extrabold font-mono text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 pb-2 border-b border-slate-900">
            <ArrowRightLeft className="h-4 w-4 text-slate-500" />
            Active Metadata Schema ({fields.length} Custom Fields Registered)
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 text-[9px] uppercase tracking-wider">
                  <th className="py-2.5">Attribute Key</th>
                  <th className="py-2.5">Data Type</th>
                  <th className="py-2.5">Default Fallback</th>
                  <th className="py-2.5">Mandatory</th>
                  <th className="py-2.5 text-right">Deprecate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 relative">
                {fields.map((field) => (
                  <tr key={field.id} className="text-slate-300 hover:bg-slate-900/10 transition-colors">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-white text-xs">{field.name}</span>
                        {field.name === "aiPriority" && (
                          <span className="text-[8px] font-black uppercase text-amber-500 bg-amber-500/10 px-1 border border-amber-500/20 rounded">
                            Core
                          </span>
                        )}
                      </div>
                      {field.validationRule && (
                        <p className="text-[8.5px] text-slate-600 truncate mt-0.5 max-w-[150px]">
                          Regex: {field.validationRule}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-indigo-400 text-[10px] font-black">
                      {field.type}
                    </td>
                    <td className="py-3 pr-2 text-slate-400 italic">
                      "{field.fallback}"
                    </td>
                    <td className="py-3 pr-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        field.required 
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                          : "bg-slate-900 text-slate-600 border border-slate-900"
                      }`}>
                        {field.required ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id, field.name)}
                        disabled={field.name === "aiPriority"}
                        className={`text-slate-600 transition-colors cursor-pointer ${
                          field.name === "aiPriority" ? "opacity-20 cursor-not-allowed" : "hover:text-rose-500"
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex gap-2">
            <BadgeInfo className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              <span className="text-white font-mono font-extrabold block uppercase tracking-widest text-[9px] mb-1">
                ⚡ Metadata Synchronization Guide
              </span>
              All registered attributes in this panel automatically extend out our lead database model objects. Real-time integration processes can instantly write values to these custom keys via the API.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MetadataManager;
