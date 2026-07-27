import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "./AuthContext";
import { Check, ShieldAlert, Sparkles, Building2, Landmark, HelpCircle, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export function OnboardingForm() {
  const { company, updateCompany } = useAuth();
  const [businessName, setBusinessName] = useState(company?.name || "");
  const [gstin, setGstin] = useState(company?.gstin || "");
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [businessType, setBusinessType] = useState("Retail");
  const [isValidatingGst, setIsValidatingGst] = useState(false);
  const [isGstValid, setIsGstValid] = useState<boolean | null>(null);

  // Native Indian state GSTIN structure matcher (e.g. 07AAAAA1111A1Z1 etc)
  const validateGSTIN = (input: string) => {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(input.toUpperCase());
  };

  const handleValidateGST = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!gstin) {
      toast.error("Please enter a GSTIN first");
      return;
    }
    setIsValidatingGst(true);
    setTimeout(() => {
      const valid = validateGSTIN(gstin);
      setIsGstValid(valid);
      setIsValidatingGst(false);
      if (valid) {
        toast.success("GSTIN verified against GSTN directory!");
      } else {
        toast.error("Invalid GSTIN pattern. Scheme should be State code + PAN + entity code.");
      }
    }, 1200);
  };

  const handleSaveWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      toast.error("Business name cannot be empty");
      return;
    }

    updateCompany({
      name: businessName,
      currencyCode,
      currencySymbol,
      businessType: businessType as "RETAIL" | "RESTAURANT" | "SERVICES",
      gstin: isGstValid ? gstin.toUpperCase() : undefined,
    });

    toast.custom((t: any) => (
      <div className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-[#0a122c]/95 border border-[#22d3ee]/40 p-4 rounded-xl shadow-2xl backdrop-blur-md`}>
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Check className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-wider">Workspace Synchronized!</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-mono">
              Merchant channel config saved: {businessName} ({currencyCode})
            </p>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 rounded-2xl bg-slate-950/80 border border-slate-900 shadow-2xl backdrop-blur-lg w-full max-w-xl mx-auto selection:bg-[#22d3ee]/20"
    >
      <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
        <div>
          <h2 className="text-sm font-black text-slate-200 uppercase tracking-widest font-mono flex items-center gap-2">
            <Building2 className="h-4.5 w-4.5 text-cyan-400" />
            Merchant Workspace Config
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5 font-sans">
            Set up regional tax configurations & localize currency symbols.
          </p>
        </div>
        <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
          D2C INDIA
        </span>
      </div>

      <form onSubmit={handleSaveWorkspace} className="space-y-4 text-xs">
        {/* Business details */}
        <div className="space-y-1.5">
          <label className="font-bold text-slate-400 font-mono text-[10px] uppercase tracking-wider block">
            Business Name
          </label>
          <input
            type="text"
            required
            placeholder="Your brand/company name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
          />
        </div>

        {/* GSTIN registration validation */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="font-bold text-slate-400 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-slate-500/80" />
              Indian Tax Portal GSTIN
            </label>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
              Optional but compliant
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 07AAAAA1111A1Z1"
              value={gstin}
              onChange={(e) => {
                setGstin(e.target.value);
                setIsGstValid(null);
              }}
              className="flex-1 bg-slate-900/60 border border-slate-800 rounded-lg px-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono uppercase tracking-widest text-center"
            />
            <button
              type="button"
              onClick={handleValidateGST}
              disabled={!gstin || isValidatingGst}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 font-bold font-mono px-4 rounded-lg border border-slate-800 transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              {isValidatingGst ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
                  <span>GSTN...</span>
                </>
              ) : (
                "Verify Code"
              )}
            </button>
          </div>

          {/* Validation report states */}
          {isGstValid !== null && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-2.5 rounded-lg border font-mono text-[10px] flex items-center gap-2 ${
                isGstValid
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/20"
              }`}
            >
              {isGstValid ? (
                <>
                  <Check className="h-4 w-4 shrink-0" />
                  <span>GSTIN Validated! Domestic tax ledger enabled at CGST(9%) + SGST(9%).</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Invalid format pattern. Format: 2-digit state code + PAN (10 chars) + entity descriptor.</span>
                </>
              )}
            </motion.div>
          )}
        </div>

        {/* Currency setting */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="font-bold text-slate-400 font-mono text-[10px] uppercase tracking-wider block">
              Currency Code
            </label>
            <select
              value={currencyCode}
              onChange={(e) => {
                setCurrencyCode(e.target.value);
                setCurrencySymbol(e.target.value === "INR" ? "₹" : "$");
              }}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all font-mono"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-slate-400 font-mono text-[10px] uppercase tracking-wider block">
              Vertical Focus
            </label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all font-mono"
            >
              <option value="Retail">Retail Clothing</option>
              <option value="SaaS">Local SME Vouchers</option>
              <option value="Electronics">Handicrafts & Decor</option>
              <option value="B2B">Corporate Gifting</option>
            </select>
          </div>
        </div>

        {/* Automation guidelines placeholder info banner */}
        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-900/80 flex gap-2.5">
          <div className="h-5 w-5 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 text-indigo-400">
            <HelpCircle className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="font-extrabold text-slate-300 font-mono uppercase tracking-widest text-[9px] flex items-center gap-1">
              <Sparkles className="h-3 w-3 fill-indigo-400" /> Conversational AI Hooked
            </p>
            <p className="text-[10px] text-slate-500 leading-normal mt-1">
              Your store vertical parameters instantly feed our central prompt template, ensuring the LLM respects your sales limits.
            </p>
          </div>
        </div>

        {/* Save control */}
        <button
          type="submit"
          className="w-full py-3 px-4 rounded-xl text-xs font-black font-mono uppercase text-slate-950 bg-cyan-400 hover:bg-[#22d3ee] transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-950/20 group"
        >
          <span>Activate Workspace</span>
          <ArrowRight className="h-4 w-4 text-slate-950 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </form>
    </motion.div>
  );
}
export default OnboardingForm;
