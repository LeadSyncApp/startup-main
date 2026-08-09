import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Loader2, Landmark, ArrowRight, Shield, Users, Store as StoreIcon
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

type SaveState = "idle" | "saving" | "saved" | "error";

export function ShopProfilePage() {
  const { user, company, updateCompany } = useAuth();

  const [scale, setScale] = useState<"HOME_GROWN" | "SME_RETAIL">("HOME_GROWN");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [upiId, setUpiId] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isExploringUpgrade, setIsExploringUpgrade] = useState(false);

  useEffect(() => {
    if (company) {
      setScale(company.scale || "HOME_GROWN");
      setBusinessName(company.name || "");
      setGstin(company.gstin || "");
      setUpiId(company.upiId || "");
    }
  }, [company?.id]);

  const handleAutoSave = async (fieldKey: string, payload: any) => {
    if (user?.role !== 'OWNER' && user?.role !== 'MANAGER') {
      toast.error("You don't have permission to update settings.");
      return;
    }

    setSaveStates(prev => ({ ...prev, [fieldKey]: "saving" }));

    try {
      const response = await apiClient.patch("/dashboard/business-details", payload);
      if (response.data?.company) {
        updateCompany(response.data.company);
      }
      setSaveStates(prev => ({ ...prev, [fieldKey]: "saved" }));
      setTimeout(() => {
        setSaveStates(prev => ({ ...prev, [fieldKey]: "idle" }));
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setSaveStates(prev => ({ ...prev, [fieldKey]: "error" }));
      toast.error(error?.response?.data?.message || "Failed to update business settings");
    }
  };

  const onBlurInput = (fieldKey: string, val: string, originalVal: string | undefined, payloadKey: string) => {
    if (val !== originalVal) {
      handleAutoSave(fieldKey, { [payloadKey]: val });
    }
  };

  const handleUpgradeToSME = () => {
    if (user?.role !== 'OWNER') {
      toast.error("Only the Shop Owner can request an upgrade.");
      return;
    }
    setIsUpgrading(true);
    setTimeout(() => {
      setScale("SME_RETAIL");
      handleAutoSave("scale", { scale: "SME_RETAIL" });
      setIsUpgrading(false);
      toast.success("Welcome to SME Retail Tier!", { icon: "🏪" });
    }, 1500);
  };

  return (
    <div className="space-y-8">
      {/* Tier Status Section */}
      <Card data-tour="tier-status" className="p-8 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"
             style={{ backgroundColor: 'var(--app-bg-soft)' }} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl shadow-sm text-white"
                 style={{ backgroundColor: scale === 'SME_RETAIL' ? 'var(--brand-navy)' : 'var(--brand-saffron)' }}>
              <StoreIcon className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                Active Tier: {scale === 'SME_RETAIL' ? 'SME Retail' : 'Home Grown'}
              </h2>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Your current configuration tier on SaLira.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl border-2"
                 style={{
                   backgroundColor: scale === 'SME_RETAIL' ? 'var(--brand-saffron-soft)' : 'rgba(212, 168, 67, 0.08)',
                   borderColor: scale === 'SME_RETAIL' ? 'var(--brand-saffron)' : 'rgba(212, 168, 67, 0.2)',
                   color: scale === 'SME_RETAIL' ? 'var(--brand-saffron)' : 'var(--brand-saffron)'
                 }}>
              <div className="h-2 w-2 rounded-full animate-pulse"
                   style={{ backgroundColor: scale === 'SME_RETAIL' ? 'var(--brand-saffron)' : 'var(--brand-saffron)' }} />
              <span className="text-xs font-black uppercase tracking-[0.15em]">
                {scale === 'SME_RETAIL' ? 'Verified SME' : 'Individual Maker'}
              </span>
            </div>

            {scale === "HOME_GROWN" && !isExploringUpgrade && (
              <Button
                variant="primary"
                onClick={() => setIsExploringUpgrade(true)}
                className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl"
              >
                Manage Scale
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {scale === "HOME_GROWN" && isExploringUpgrade && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-8 pt-8 overflow-hidden relative z-10"
              style={{ borderTop: '1px solid var(--app-border)' }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="max-w-md">
                  <h3 className="text-lg font-black" style={{ color: 'var(--app-text)' }}>
                    Upgrade your business?
                  </h3>
                  <p className="text-xs font-bold mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Upgrade to SME Retail to unlock Staff Directories, GST Compliance, and Advanced metrics.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setIsExploringUpgrade(false)}
                  className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl"
                >
                  <ArrowRight className="h-4 w-4 rotate-180 mr-1" /> Back
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl border"
                     style={{ backgroundColor: 'var(--brand-saffron-soft)', borderColor: 'rgba(212, 168, 67, 0.2)' }}>
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-2"
                      style={{ color: 'var(--brand-navy)' }}>
                    Unlocked Features
                  </h4>
                  <ul className="space-y-2">
                    {[
                      'Multi-staff Directory Management',
                      'GST Regional Tax Compliance & Invoicing',
                      'Unified API Link Synchronizations'
                    ].map(feature => (
                      <li key={feature} className="flex items-center gap-2 text-[11px] font-bold"
                          style={{ color: 'var(--brand-navy)' }}>
                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--brand-saffron)' }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col justify-center gap-3">
                  <Button
                    variant="primary"
                    onClick={handleUpgradeToSME}
                    disabled={isUpgrading}
                    className="w-full px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl"
                    style={{ boxShadow: '0 8px 24px rgba(212, 168, 67, 0.25)' }}
                  >
                    {isUpgrading ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <StoreIcon className="h-5 w-5 mr-2" />
                    )}
                    Upgrade to SME Retail
                  </Button>
                  <p className="text-[10px] text-center font-bold" style={{ color: 'var(--app-text-muted)' }}>
                    Upgrade to unlock full multi-user business profiles.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Shop Core Identity */}
      <Card data-tour="shop-profile" className="p-8 sm:p-10 space-y-10">
        <div>
          <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
            Core Shop Profile
          </h2>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Official details used for automated order invoice generations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Business Name */}
          <div className="space-y-2.5 relative">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                Formal Business Name
              </label>
              <AnimatePresence>
                {saveStates["name"] === "saving" && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{color: 'var(--brand-saffron)'}} />
                  </motion.div>
                )}
                {saveStates["name"] === "saved" && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{color: 'var(--success-green)'}} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onBlur={() => onBlurInput("name", businessName, company?.name, "businessName")}
              placeholder="e.g. Balaji Silks & Sarees"
              className="w-full text-sm font-black rounded-2xl px-5 py-4 transition-all shadow-xs outline-none"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                border: '2px solid var(--app-border)',
                color: 'var(--app-text)'
              }}
            />
          </div>

          {/* UPI ID */}
          <div className="space-y-2.5 relative">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                Payments (UPI ID)
              </label>
              <AnimatePresence>
                {saveStates["upi"] === "saving" && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{color: 'var(--brand-saffron)'}} />
                  </motion.div>
                )}
                {saveStates["upi"] === "saved" && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                    <CheckCircle2 className="h-3.5 w-3.5" style={{color: 'var(--success-green)'}} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              onBlur={() => onBlurInput("upi", upiId, company?.upiId, "upiId")}
              placeholder="e.g. shopname@okicici"
              className="w-full text-sm font-mono font-black rounded-2xl px-5 py-4 transition-all shadow-xs outline-none"
              style={{
                backgroundColor: 'var(--app-input-bg)',
                border: '2px solid var(--app-border)',
                color: 'var(--app-text)'
              }}
            />
          </div>

          {/* GSTIN */}
          <AnimatePresence mode="wait">
            {scale === "SME_RETAIL" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="col-span-full space-y-2.5 p-6 rounded-3xl border-2"
                style={{
                  backgroundColor: 'var(--brand-saffron-soft)',
                  borderColor: 'rgba(212, 168, 67, 0.2)'
                }}
              >
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
                         style={{ color: 'var(--brand-navy)' }}>
                    <Landmark className="h-3.5 w-3.5" /> GSTIN Tax Compliance
                  </label>
                  <AnimatePresence>
                    {saveStates["gstin"] === "saving" && (
                      <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{color: 'var(--brand-navy)'}} />
                      </motion.div>
                    )}
                    {saveStates["gstin"] === "saved" && (
                      <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                        <CheckCircle2 className="h-3.5 w-3.5" style={{color: 'var(--brand-navy)'}} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  onBlur={() => onBlurInput("gstin", gstin, company?.gstin, "gstin")}
                  placeholder="Enter 15-digit GSTIN"
                  className="w-full text-base font-mono font-black uppercase rounded-2xl px-5 py-5 outline-none transition-all"
                  style={{
                    backgroundColor: 'var(--app-input-bg)',
                    border: '2px solid rgba(212, 168, 67, 0.15)',
                    color: 'var(--app-text)'
                  }}
                />
                <p className="text-[10px] font-black mt-3 px-1 flex items-center gap-2"
                   style={{ color: 'var(--brand-navy)', opacity: 0.7 }}>
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: 'var(--brand-navy)' }} />
                  Enables tax breakdowns on invoice generation algorithms.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Shop Guidelines */}
      <Card className="p-8">
        <h3 className="text-lg font-black tracking-tight mb-4" style={{ color: 'var(--app-text)' }}>
          Shop Guidelines
        </h3>
        <div className="space-y-3.5">
          <div className="flex gap-3 text-sm">
            <Shield className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-saffron)' }} />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              Keep UPI details properly updated to permit automatic transaction calculations.
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Users className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-saffron)' }} />
            <p className="font-semibold italic" style={{ color: 'var(--text-secondary)' }}>
              "Upgrading tiers helps invite shop chotus and helpers to cooperate on live logs."
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}