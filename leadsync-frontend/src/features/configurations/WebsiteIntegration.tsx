import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Key, RefreshCw, Copy, Check, AlertTriangle,
  ChevronDown, ChevronUp, RotateCw,
  Loader2, Clock, XCircle, CheckCircle2, AlertCircle,
  Code, Webhook, Info, X, ArrowLeft, Store, ShoppingBag,
  Sparkles, HelpCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

/* ── Types ─────────────────────────────────────────────────────────── */

interface DeliveryLog {
  id: string;
  platform: string;
  outcome: string;
  reason: string | null;
  statusCode: number;
  createdAt: string;
}

export interface WebsiteIntegrationProps {
  onBack?: () => void;
}

type PlatformOption = "none" | "shopify" | "woocommerce" | "custom" | "nostore";

/* ── Helper ────────────────────────────────────────────────────────── */

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function platformColor(platform: string): string {
  switch (platform) {
    case "shopify": return "#5E8E3E";
    case "woocommerce": return "#7B2D8E";
    case "custom": return "var(--brand-saffron)";
    default: return "var(--text-secondary)";
  }
}

function outcomeVariant(outcome: string): "success" | "warning" | "error" | "info" | "neutral" {
  switch (outcome) {
    case "accepted": return "success";
    case "ignored": return "info";
    case "rejected": return "error";
    case "error": return "warning";
    default: return "neutral";
  }
}

function OutcomeIcon({ outcome }: { outcome: string }) {
  switch (outcome) {
    case "accepted": return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "ignored": return <Info className="h-3.5 w-3.5" />;
    case "rejected": return <XCircle className="h-3.5 w-3.5" />;
    case "error": return <AlertCircle className="h-3.5 w-3.5" />;
    default: return null;
  }
}

/* ── Code Snippet ──────────────────────────────────────────────────── */

function CodeSnippet({ webhookUrl }: { webhookUrl: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `const crypto = require("crypto");

const payload = JSON.stringify({
  phone: "9876543210",
  name: "Jane Doe",
  message: "New lead from website"
});

const secret = "YOUR_SECRET_HERE";

const signature = "sha256=" + crypto
  .createHmac("sha256", secret)
  .update(payload)
  .digest("hex");

fetch("${webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature
  },
  body: payload
});`;

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Code snippet copied!", { icon: "📋" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden font-mono text-xs border p-5"
         style={{ backgroundColor: "#0F172A", borderColor: "#1E293B", color: "#F8FAFC" }}>
      <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: "#1E293B" }}>
        <div className="flex gap-1.5 pointer-events-none">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(239, 68, 68, 0.8)" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(245, 158, 11, 0.8)" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(34, 197, 94, 0.8)" }} />
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 px-3 rounded-lg transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 text-[10px] font-bold"
          style={{ backgroundColor: "#1E293B", color: "var(--brand-saffron)", borderColor: "#334155" }}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 text-emerald-400" /><span className="uppercase text-emerald-400">Copied</span></>
          ) : (
            <><Copy className="h-3.5 w-3.5" /><span className="uppercase">Copy</span></>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto leading-relaxed whitespace-pre-wrap select-all font-mono text-xs" style={{ color: "#F8FAFC" }}>
        {snippet}
      </pre>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export function WebsiteIntegration({ onBack }: WebsiteIntegrationProps = {}) {
  const { user, company } = useAuth();
  const companyId = company?.id || "";
  const webhookUrl = `${window.location.origin}/api/webhook/${companyId}`;
  const isOwner = user?.role === "OWNER";

  // Platform selection state
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformOption>("none");

  // Secret state
  const [secretStatus, setSecretStatus] = useState<"set" | "unset" | "loading">("loading");
  const [isRotating, setIsRotating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Delivery logs state
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(0);
  const [filterOutcomes, setFilterOutcomes] = useState<string[]>([]);

  // Replay state
  const [replayingId, setReplayingId] = useState<string | null>(null);

  // Advanced Setup collapsed by default in Custom view
  const [showAdvanced, setShowAdvanced] = useState(false);

  const LOG_PAGE_SIZE = 15;

  /* ── Check secret status ───────────────────────────────────────── */

  const checkSecretStatus = useCallback(async () => {
    if (!company) return;
    setSecretStatus("loading");
    try {
      await apiClient.get("/company/webhook-logs", { params: { limit: 1 } });
      setSecretStatus("unset");
    } catch {
      setSecretStatus("unset");
    }
  }, [company]);

  useEffect(() => {
    checkSecretStatus();
  }, [checkSecretStatus]);

  /* ── Fetch delivery logs ───────────────────────────────────────── */

  const fetchLogs = useCallback(async (page: number, outcomes?: string[]) => {
    if (!company) return;
    setLogLoading(true);
    try {
      const params: Record<string, any> = {
        limit: LOG_PAGE_SIZE,
        offset: page * LOG_PAGE_SIZE,
      };
      const res = await apiClient.get("/company/webhook-logs", { params });
      let filtered = res.data.logs || [];
      if (outcomes && outcomes.length > 0) {
        filtered = filtered.filter((l: DeliveryLog) => outcomes.includes(l.outcome));
      }
      setLogs(filtered);
      setLogTotal(res.data.total || 0);
    } catch (err) {
      console.error("Failed to fetch webhook logs:", err);
      toast.error("Failed to load delivery logs");
    } finally {
      setLogLoading(false);
    }
  }, [company]);

  useEffect(() => {
    if (selectedPlatform === "custom") {
      fetchLogs(logPage, filterOutcomes);
    }
  }, [fetchLogs, selectedPlatform, logPage, filterOutcomes]);

  /* ── Rotate secret ─────────────────────────────────────────────── */

  const handleRotate = async () => {
    setIsRotating(true);
    try {
      const res = await apiClient.post("/company/rotate-webhook-secret");
      setRevealedSecret(res.data.secret);
      setSecretStatus("set");
      setShowWarningModal(true);
      toast.success("New secret generated!", { icon: "🔑" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to generate secret");
    } finally {
      setIsRotating(false);
    }
  };

  /* ── Replay ────────────────────────────────────────────────────── */

  const handleReplay = async (logId: string) => {
    setReplayingId(logId);
    try {
      await apiClient.post(`/company/webhook-logs/${logId}/replay`);
      toast.success("Delivery replayed!", { icon: "🔄" });
      fetchLogs(logPage, filterOutcomes);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Replay failed");
    } finally {
      setReplayingId(null);
    }
  };

  /* ── Copy webhook URL ──────────────────────────────────────────── */

  const [urlCopied, setUrlCopied] = useState(false);
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setUrlCopied(true);
    toast.success("Webhook URL copied!", { icon: "📋" });
    setTimeout(() => setUrlCopied(false), 2000);
  };

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer hover:opacity-80 active:scale-95"
              style={{
                backgroundColor: "var(--app-bg-soft)",
                borderColor: "var(--app-border)",
                color: "var(--app-text)"
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Connections</span>
            </button>
          )}

          {selectedPlatform !== "none" && (
            <button
              onClick={() => setSelectedPlatform("none")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer hover:opacity-80 active:scale-95"
              style={{
                backgroundColor: "rgba(212, 168, 67, 0.1)",
                borderColor: "rgba(212, 168, 67, 0.3)",
                color: "var(--brand-saffron)"
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Change Platform</span>
            </button>
          )}
        </div>

        <div className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
          Connections Hub &gt; <span style={{ color: "var(--app-text)" }}>Store Webhooks Integration</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="rounded-[2.5rem] p-8 sm:p-10 shadow-lg text-white relative overflow-hidden group"
           style={{ background: "linear-gradient(135deg, #1a3a2a 0%, #0d1f17 100%)" }}>
        <div className="absolute top-0 right-0 w-[45%] h-full pointer-events-none"
             style={{ background: "linear-gradient(to left, rgba(34, 197, 94, 0.08), transparent)" }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[150px] translate-y-1/3 translate-x-1/3 opacity-20 pointer-events-none"
             style={{ backgroundColor: "#22c55e" }} />
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#86efac" }}>
            <Webhook className="h-3.5 w-3.5" /> Automatic Store Orders
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
            Website Store Integration
          </h2>
          <p className="font-medium text-base sm:text-lg leading-relaxed"
             style={{ color: "rgba(241, 245, 249, 0.85)" }}>
            Automatically receive orders from your Shopify, WooCommerce, or custom website directly into SaLira.
          </p>
        </div>
      </div>

      {/* ─── STEP 1: Platform Selection Screen ─── */}
      {selectedPlatform === "none" && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              Select your store platform
            </h3>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              Choose your platform below to view simple setup instructions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shopify Option */}
            <Card
              hover
              onClick={() => setSelectedPlatform("shopify")}
              className="p-8 flex flex-col justify-between cursor-pointer group transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                       style={{ backgroundColor: "rgba(94, 142, 62, 0.12)", color: "#5E8E3E", border: "1px solid rgba(94, 142, 62, 0.2)" }}>
                    <ShoppingBag className="h-7 w-7 stroke-[2.2]" />
                  </div>
                  <Badge variant="success" className="uppercase tracking-widest text-[10px] px-3 py-1">
                    No-Code Setup
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    Shopify
                  </h4>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Connect your Shopify store using native Shopify webhook settings in under 60 seconds.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 flex items-center justify-between text-xs font-bold" style={{ borderTop: "1px solid var(--app-border)", color: "#5E8E3E" }}>
                <span>Select Shopify</span>
                <span>→</span>
              </div>
            </Card>

            {/* WooCommerce Option */}
            <Card
              hover
              onClick={() => setSelectedPlatform("woocommerce")}
              className="p-8 flex flex-col justify-between cursor-pointer group transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                       style={{ backgroundColor: "rgba(123, 45, 142, 0.12)", color: "#7B2D8E", border: "1px solid rgba(123, 45, 142, 0.2)" }}>
                    <Store className="h-7 w-7 stroke-[2.2]" />
                  </div>
                  <Badge variant="info" className="uppercase tracking-widest text-[10px] px-3 py-1">
                    No-Code Setup
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    WooCommerce
                  </h4>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Connect your WordPress / WooCommerce store using native WooCommerce settings.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 flex items-center justify-between text-xs font-bold" style={{ borderTop: "1px solid var(--app-border)", color: "#7B2D8E" }}>
                <span>Select WooCommerce</span>
                <span>→</span>
              </div>
            </Card>

            {/* Custom Website / Other Option */}
            <Card
              hover
              onClick={() => setSelectedPlatform("custom")}
              className="p-8 flex flex-col justify-between cursor-pointer group transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                       style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)", border: "1px solid rgba(212, 168, 67, 0.2)" }}>
                    <Code className="h-7 w-7 stroke-[2.2]" />
                  </div>
                  <Badge variant="neutral" className="uppercase tracking-widest text-[10px] px-3 py-1">
                    Developer API
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    Custom Website / Other
                  </h4>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Send order payloads via signed HMAC API webhooks. Ideal for custom sites built by a developer.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 flex items-center justify-between text-xs font-bold" style={{ borderTop: "1px solid var(--app-border)", color: "var(--brand-saffron)" }}>
                <span>Developer Setup & API Keys</span>
                <span>→</span>
              </div>
            </Card>

            {/* No Store Yet Option */}
            <Card
              hover
              onClick={() => setSelectedPlatform("nostore")}
              className="p-8 flex flex-col justify-between cursor-pointer group transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-14 w-14 rounded-2xl flex items-center justify-center"
                       style={{ backgroundColor: "rgba(100, 116, 139, 0.12)", color: "#64748b", border: "1px solid rgba(100, 116, 139, 0.2)" }}>
                    <HelpCircle className="h-7 w-7 stroke-[2.2]" />
                  </div>
                  <Badge variant="neutral" className="uppercase tracking-widest text-[10px] px-3 py-1">
                    Manual Mode
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    I don't have an online store yet
                  </h4>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    Learn how to manage customer orders manually or set up store webhooks later.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-4 flex items-center justify-between text-xs font-bold" style={{ borderTop: "1px solid var(--app-border)", color: "var(--app-text-muted)" }}>
                <span>View Options</span>
                <span>→</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── STEP 2a: Shopify Native Guide ─── */}
      {selectedPlatform === "shopify" && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
                     style={{ backgroundColor: "rgba(94, 142, 62, 0.12)", color: "#5E8E3E" }}>
                  <ShoppingBag className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    Shopify Webhook Setup
                  </h3>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Zero-code native Shopify store integration
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setSelectedPlatform("none")}
                className="px-4 py-2 text-xs font-bold rounded-xl"
              >
                ← Change Platform
              </Button>
            </div>

            {/* Numbered Steps */}
            <ol className="space-y-4 text-sm font-medium" style={{ color: "var(--app-text)" }}>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#5E8E3E" }}>1</span>
                <span>Go to your <strong>Shopify Admin</strong>.</span>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#5E8E3E" }}>2</span>
                <span>Click <strong>Settings &rarr; Notifications</strong>.</span>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#5E8E3E" }}>3</span>
                <span>Scroll to <strong>Webhooks</strong> &rarr; click <strong>Create webhook</strong>.</span>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#5E8E3E" }}>4</span>
                <span>Set <strong>Event</strong> to <code className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/10">Order creation</code>, and <strong>Format</strong> to <code className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/10">JSON</code>.</span>
              </li>
              <li className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#5E8E3E" }}>5</span>
                  <span>Paste this URL into the <strong>URL</strong> field:</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap pl-9">
                  <div className="flex-1 min-w-0 rounded-xl px-4 py-3 font-mono text-xs font-bold border overflow-x-auto select-all"
                       style={{ backgroundColor: "var(--app-input-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                    {webhookUrl}
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleCopyUrl}
                    className="shrink-0 px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                  >
                    {urlCopied ? <Check className="h-4 w-4" style={{ color: "var(--success-green)" }} /> : <Copy className="h-4 w-4" />}
                    <span className="ml-1.5">{urlCopied ? "Copied" : "Copy URL"}</span>
                  </Button>
                </div>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#5E8E3E" }}>6</span>
                <span>Click <strong>Save</strong>.</span>
              </li>
            </ol>

            {/* Confirmation Box */}
            <div className="p-5 rounded-2xl border flex items-center gap-3"
                 style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", borderColor: "rgba(34, 197, 94, 0.2)", color: "#166534" }}>
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
              <span className="text-sm font-bold">
                That's it — new orders will now automatically appear in SaLira.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ─── STEP 2b: WooCommerce Native Guide ─── */}
      {selectedPlatform === "woocommerce" && (
        <div className="space-y-6">
          <Card className="p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl flex items-center justify-center"
                     style={{ backgroundColor: "rgba(123, 45, 142, 0.12)", color: "#7B2D8E" }}>
                  <Store className="h-6 w-6 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    WooCommerce Webhook Setup
                  </h3>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Zero-code native WooCommerce store integration
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setSelectedPlatform("none")}
                className="px-4 py-2 text-xs font-bold rounded-xl"
              >
                ← Change Platform
              </Button>
            </div>

            {/* Numbered Steps */}
            <ol className="space-y-4 text-sm font-medium" style={{ color: "var(--app-text)" }}>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#7B2D8E" }}>1</span>
                <span>Go to your <strong>WooCommerce Admin</strong>.</span>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#7B2D8E" }}>2</span>
                <span>Click <strong>Settings &rarr; Advanced &rarr; Webhooks</strong>.</span>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#7B2D8E" }}>3</span>
                <span>Click <strong>Add webhook</strong>.</span>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#7B2D8E" }}>4</span>
                <span>Set <strong>Topic</strong> to <code className="font-mono font-bold px-1.5 py-0.5 rounded bg-black/10">Order created</code>.</span>
              </li>
              <li className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#7B2D8E" }}>5</span>
                  <span>Paste this URL in the <strong>Delivery URL</strong> field:</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap pl-9">
                  <div className="flex-1 min-w-0 rounded-xl px-4 py-3 font-mono text-xs font-bold border overflow-x-auto select-all"
                       style={{ backgroundColor: "var(--app-input-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                    {webhookUrl}
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleCopyUrl}
                    className="shrink-0 px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                  >
                    {urlCopied ? <Check className="h-4 w-4" style={{ color: "var(--success-green)" }} /> : <Copy className="h-4 w-4" />}
                    <span className="ml-1.5">{urlCopied ? "Copied" : "Copy URL"}</span>
                  </Button>
                </div>
              </li>
              <li className="p-4 rounded-xl border flex items-start gap-3" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <span className="h-6 w-6 rounded-full shrink-0 flex items-center justify-center font-black text-xs text-white" style={{ backgroundColor: "#7B2D8E" }}>6</span>
                <span>Click <strong>Save</strong>.</span>
              </li>
            </ol>

            {/* Confirmation Box */}
            <div className="p-5 rounded-2xl border flex items-center gap-3"
                 style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", borderColor: "rgba(34, 197, 94, 0.2)", color: "#166534" }}>
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#22c55e" }} />
              <span className="text-sm font-bold">
                That's it — new orders will now automatically appear in SaLira.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ─── STEP 2c: Custom Website / Developer Setup ─── */}
      {selectedPlatform === "custom" && (
        <div className="space-y-8">
          {/* Intro Card */}
          <Card className="p-6 sm:p-8 space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
                     style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}>
                  <Code className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    Custom Website Developer Setup
                  </h3>
                  <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    This setup requires a developer or custom code. Share the technical details below with whoever built your website.
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setSelectedPlatform("none")}
                className="px-4 py-2 text-xs font-bold rounded-xl shrink-0"
              >
                ← Change Platform
              </Button>
            </div>
          </Card>

          {/* Collapsible Technical Content */}
          <Card className="overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full px-6 sm:px-8 py-6 flex items-center justify-between cursor-pointer transition-colors"
              style={{ backgroundColor: showAdvanced ? "var(--app-bg-soft)" : "transparent" }}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                     style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
                  <Code className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                    Advanced Technical Specs (for your developer)
                  </h3>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Webhook Endpoint URL, Secret Key, Signature Verification & Code Examples
                  </p>
                </div>
              </div>
              {showAdvanced ? (
                <ChevronUp className="h-5 w-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0" style={{ color: "var(--text-secondary)" }} />
              )}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 sm:px-8 pb-8 space-y-8 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>

                    {/* Webhook Endpoint URL */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" style={{ color: "var(--brand-saffron)" }} />
                        <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>
                          Webhook Endpoint URL
                        </h4>
                      </div>
                      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        POST signed JSON payloads to this URL from your website backend or store webhooks.
                      </p>
                      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-0 rounded-xl px-4 py-3 font-mono text-sm font-bold border overflow-x-auto select-all"
                             style={{ backgroundColor: "var(--app-input-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}>
                          {webhookUrl}
                        </div>
                        <Button
                          variant="secondary"
                          onClick={handleCopyUrl}
                          className="shrink-0 px-4 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                        >
                          {urlCopied ? <Check className="h-4 w-4" style={{ color: "var(--success-green)" }} /> : <Copy className="h-4 w-4" />}
                          <span className="ml-1">{urlCopied ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>
                    </div>

                    {/* Secret Management */}
                    <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 shrink-0" style={{ color: "var(--brand-saffron)" }} />
                          <div>
                            <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>
                              Webhook Secret
                            </h4>
                            <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                              {isOwner ? "HMAC-SHA256 key for verifying payload signatures" : "Only the Owner can manage the webhook secret"}
                            </p>
                          </div>
                        </div>
                        {isOwner && (
                          <Button
                            variant={secretStatus === "set" ? "secondary" : "primary"}
                            onClick={handleRotate}
                            disabled={isRotating}
                            className="px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl"
                          >
                            {isRotating ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Generating...</>
                            ) : secretStatus === "set" ? (
                              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Rotate Secret</>
                            ) : (
                              <><Key className="h-3.5 w-3.5 mr-1.5" /> Generate Secret</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Payload Format */}
                    <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
                      <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>Payload Format</h4>
                      <div className="relative rounded-2xl overflow-hidden font-mono text-xs border p-5 space-y-2 leading-relaxed"
                           style={{ backgroundColor: "#0F172A", borderColor: "#1E293B", color: "#F8FAFC" }}>
                        <p className="font-bold text-xs" style={{ color: "var(--brand-saffron)" }}>Required fields:</p>
                        <ul className="space-y-1.5 list-disc list-inside">
                          <li><code className="font-mono font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1E293B", color: "#38BDF8" }}>phone</code> — Contact phone (required)</li>
                          <li><code className="font-mono font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1E293B", color: "#38BDF8" }}>name</code> — Contact name (optional)</li>
                          <li><code className="font-mono font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1E293B", color: "#38BDF8" }}>email</code> — Email (optional)</li>
                          <li><code className="font-mono font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: "#1E293B", color: "#38BDF8" }}>message</code> — Inquiry text (optional)</li>
                        </ul>
                      </div>
                    </div>

                    {/* Signature Header */}
                    <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
                      <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>Signature Header</h4>
                      <div className="relative rounded-2xl overflow-hidden font-mono text-xs border p-5 space-y-3 leading-relaxed"
                           style={{ backgroundColor: "#0F172A", borderColor: "#1E293B", color: "#F8FAFC" }}>
                        <div>
                          <p className="font-bold text-xs mb-1" style={{ color: "var(--brand-saffron)" }}>Custom websites:</p>
                          <code className="font-mono font-black px-2 py-1 rounded inline-block" style={{ backgroundColor: "#1E293B", color: "#4ADE80" }}>X-Webhook-Signature: sha256=&lt;hex-digest&gt;</code>
                        </div>
                        <div>
                          <p className="font-bold text-xs mb-1" style={{ color: "var(--brand-saffron)" }}>Shopify (auto-detected):</p>
                          <code className="font-mono font-black px-2 py-1 rounded inline-block" style={{ backgroundColor: "#1E293B", color: "#4ADE80" }}>X-Shopify-Hmac-SHA256: &lt;base64-digest&gt;</code>
                        </div>
                        <div>
                          <p className="font-bold text-xs mb-1" style={{ color: "var(--brand-saffron)" }}>WooCommerce (auto-detected):</p>
                          <code className="font-mono font-black px-2 py-1 rounded inline-block" style={{ backgroundColor: "#1E293B", color: "#4ADE80" }}>X-WC-Webhook-Signature: &lt;base64-digest&gt;</code>
                        </div>
                      </div>
                    </div>

                    {/* Code snippet */}
                    <div className="space-y-3 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
                      <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>Node.js Example</h4>
                      <CodeSnippet webhookUrl={webhookUrl} />
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>

          {/* Delivery Logs (OWNER only) */}
          {isOwner && (
            <Card className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                       style={{ backgroundColor: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>
                    <Clock className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                      Delivery Logs
                    </h3>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      This shows whether your store's order updates are reaching SaLira successfully. ({logTotal} total attempt{logTotal !== 1 ? "s" : ""})
                    </p>
                  </div>
                </div>

                {/* Filter chips */}
                <div className="flex gap-2 flex-wrap">
                  {["accepted", "rejected", "error", "ignored"].map((outcome) => {
                    const active = filterOutcomes.includes(outcome);
                    return (
                      <button
                        key={outcome}
                        onClick={() => {
                          setFilterOutcomes(prev =>
                            active ? prev.filter(o => o !== outcome) : [...prev, outcome]
                          );
                          setLogPage(0);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer",
                          active
                            ? "border-current opacity-100"
                            : "border-transparent opacity-40 hover:opacity-70"
                        )}
                        style={{
                          color: active ? outcomeVariant(outcome) === "success" ? "#16a34a"
                            : outcomeVariant(outcome) === "error" ? "#dc2626"
                            : outcomeVariant(outcome) === "warning" ? "#d97706"
                            : outcomeVariant(outcome) === "info" ? "#2563eb"
                            : "#64748b" : "var(--text-secondary)",
                          backgroundColor: active ? "var(--app-bg-soft)" : "transparent",
                        }}
                      >
                        {outcome}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logs table */}
              {logLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--brand-saffron)" }} />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Clock className="h-10 w-10 mx-auto opacity-30" style={{ color: "var(--text-secondary)" }} />
                  <p className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>
                    {filterOutcomes.length > 0 ? "No logs match the selected filters" : "No delivery logs yet"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
                    {filterOutcomes.length > 0 ? "Try removing some filters" : "Send a test webhook to see deliveries here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left" style={{ borderBottom: "1px solid var(--app-border)" }}>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--app-text-muted)" }}>Time</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--app-text-muted)" }}>Platform</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--app-text-muted)" }}>Outcome</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--app-text-muted)" }}>Reason</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--app-text-muted)" }}>Status</th>
                        <th className="pb-3 text-[10px] font-black uppercase tracking-widest text-right" style={{ color: "var(--app-text-muted)" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => {
                        const isRetryable = log.outcome === "error" || log.outcome === "rejected";
                        const time = new Date(log.createdAt);
                        const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        const dateStr = time.toLocaleDateString([], { month: "short", day: "numeric" });

                        return (
                          <tr key={log.id} className="group" style={{ borderBottom: "1px solid var(--app-border)" }}>
                            <td className="py-3.5 pr-4">
                              <div className="text-xs font-bold" style={{ color: "var(--app-text)" }}>{timeStr}</div>
                              <div className="text-[10px]" style={{ color: "var(--app-text-muted)" }}>{dateStr}</div>
                            </td>
                            <td className="py-3.5 pr-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                                    style={{ backgroundColor: `${platformColor(log.platform)}15`, color: platformColor(log.platform) }}>
                                {log.platform}
                              </span>
                            </td>
                            <td className="py-3.5 pr-4">
                              <Badge variant={outcomeVariant(log.outcome)} className="gap-1">
                                <OutcomeIcon outcome={log.outcome} />
                                {log.outcome}
                              </Badge>
                            </td>
                            <td className="py-3.5 pr-4 text-xs max-w-[200px] truncate" style={{ color: "var(--text-secondary)" }}>
                              {log.reason || "—"}
                            </td>
                            <td className="py-3.5 pr-4">
                              <span className="text-xs font-mono font-bold" style={{ color: "var(--app-text)" }}>
                                {log.statusCode}
                              </span>
                            </td>
                            <td className="py-3.5 text-right">
                              {isRetryable && (
                                <Button
                                  variant="ghost"
                                  onClick={() => handleReplay(log.id)}
                                  disabled={replayingId === log.id}
                                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ color: "var(--brand-saffron)" }}
                                >
                                  {replayingId === log.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCw className="h-3 w-3 mr-1" />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {logTotal > LOG_PAGE_SIZE && (
                <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--app-border)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                    Showing {logPage * LOG_PAGE_SIZE + 1}–{Math.min((logPage + 1) * LOG_PAGE_SIZE, logTotal)} of {logTotal}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setLogPage(p => Math.max(0, p - 1))}
                      disabled={logPage === 0}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setLogPage(p => p + 1)}
                      disabled={(logPage + 1) * LOG_PAGE_SIZE >= logTotal}
                      className="px-4 py-2 text-xs font-bold rounded-lg"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ─── STEP 2d: No Store Yet Message ─── */}
      {selectedPlatform === "nostore" && (
        <Card className="p-8 sm:p-10 space-y-6 text-center max-w-2xl mx-auto">
          <div className="h-16 w-16 rounded-3xl mx-auto flex items-center justify-center"
               style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "var(--brand-saffron)" }}>
            <Sparkles className="h-8 w-8 stroke-[2]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              No Online Store Yet?
            </h3>
            <p className="text-base font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              No problem — you can still add orders manually from the Orders page, or set this up later once you have a store live.
            </p>
          </div>
          <div className="pt-4 flex items-center justify-center gap-4 flex-wrap">
            <Button
              variant="secondary"
              onClick={() => setSelectedPlatform("none")}
              className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
            >
              ← Choose Platform
            </Button>
            {onBack && (
              <Button
                variant="primary"
                onClick={onBack}
                className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
              >
                Back to Connections
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* ─── Secret Revealed Warning Modal ─── */}
      <AnimatePresence>
        {showWarningModal && revealedSecret && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowWarningModal(false); setRevealedSecret(null); }}
              className="absolute inset-0 backdrop-blur-md"
              style={{ backgroundColor: "var(--app-backdrop)" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-lg rounded-[2.5rem] shadow-[0_48px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col z-10"
              style={{ backgroundColor: "var(--app-surface)", border: "1px solid var(--app-border)" }}
            >
              <div className="px-8 py-6 flex justify-between items-center"
                   style={{ borderBottom: "1px solid var(--app-border)", backgroundColor: "var(--app-bg-soft)" }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: "rgba(234, 179, 8, 0.1)", color: "#eab308" }}>
                    <AlertTriangle className="h-5 w-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black" style={{ color: "var(--app-text)" }}>Copy Your Secret</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-0.5" style={{ color: "#eab308" }}>
                      Shown Once — Cannot Be Recovered
                    </p>
                  </div>
                </div>
                <button onClick={() => { setShowWarningModal(false); setRevealedSecret(null); }}
                        className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        style={{ backgroundColor: "var(--app-surface)", border: "1px solid var(--app-border)", color: "var(--app-text-muted)" }}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Warning */}
                <div className="p-4 rounded-2xl border text-xs font-medium space-y-2 leading-relaxed"
                     style={{ backgroundColor: "rgba(234, 179, 8, 0.06)", borderColor: "rgba(234, 179, 8, 0.15)", color: "#92400e" }}>
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4" style={{ color: "#eab308" }} /> Important:
                  </div>
                  <p>Copy this secret now. You will <strong>not</strong> be able to see it again. If you lose it, you must rotate again — which <strong>invalidates</strong> this one immediately.</p>
                </div>

                {/* Secret display */}
                <div className="relative">
                  <label className="text-[10px] font-black uppercase tracking-widest pl-1 mb-2 block" style={{ color: "var(--app-text-muted)" }}>
                    Your Webhook Secret
                  </label>
                  <div className="rounded-xl px-4 py-3.5 font-mono text-sm font-bold border overflow-x-auto select-all"
                       style={{ backgroundColor: "var(--app-input-bg)", borderColor: "rgba(234, 179, 8, 0.3)", color: "var(--app-text)" }}>
                    {revealedSecret}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 pt-2 justify-end" style={{ borderTop: "1px solid var(--app-border)" }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(revealedSecret);
                      toast.success("Secret copied to clipboard!", { icon: "📋" });
                    }}
                    className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                  >
                    <Copy className="h-4 w-4 mr-1.5" /> Copy Secret
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => { setShowWarningModal(false); setRevealedSecret(null); }}
                    className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                  >
                    I've Saved It
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
