import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, Key, RefreshCw, Copy, Check, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, RotateCw,
  Loader2, Clock, XCircle, CheckCircle2, AlertCircle,
  Code, Webhook, Info, X
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
    <div className="relative rounded-2xl overflow-hidden shadow-inner font-mono text-xs border"
         style={{ backgroundColor: "#0F172A", borderColor: "#1E293B", color: "rgba(212, 168, 67, 0.7)" }}>
      <div className="absolute top-3 left-4 flex gap-1.5 pointer-events-none">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(239, 68, 68, 0.8)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(245, 158, 11, 0.8)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "rgba(34, 197, 94, 0.8)" }} />
      </div>
      <pre className="pt-4 pb-4 px-5 overflow-x-auto leading-relaxed whitespace-pre-wrap select-all">
        {snippet}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 p-2 rounded-lg transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95"
        style={{ backgroundColor: "#1E293B", color: "rgba(212, 168, 67, 0.7)", borderColor: "#334155" }}
      >
        {copied ? (
          <><Check className="h-4 w-4" style={{ color: "var(--success-green)" }} /><span className="text-[10px] uppercase font-bold" style={{ color: "var(--success-green)" }}>Copied</span></>
        ) : (
          <><Copy className="h-4 w-4" /><span className="text-[10px] uppercase font-bold">Copy</span></>
        )}
      </button>
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export function WebsiteIntegration() {
  const { user, company } = useAuth();
  const companyId = company?.id || "";
  const webhookUrl = `${window.location.origin}/api/webhook/${companyId}`;
  const isOwner = user?.role === "OWNER";

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

  // Instructions collapse
  const [showInstructions, setShowInstructions] = useState(false);

  const LOG_PAGE_SIZE = 15;

  /* ── Check secret status ───────────────────────────────────────── */

  const checkSecretStatus = useCallback(async () => {
    if (!company) return;
    setSecretStatus("loading");
    try {
      await apiClient.get("/company/webhook-logs", { params: { limit: 1 } });
      // If we can access logs, the company exists. Check if secret exists via company data.
      // The company object from auth context doesn't include webhook secrets (security).
      // We'll infer from whether any accepted deliveries exist.
      // A better approach: add a status endpoint. For now, show "Generate" always
      // since secrets are never displayed after creation.
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
    fetchLogs(logPage, filterOutcomes);
  }, [fetchLogs, logPage, filterOutcomes]);

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
            <Webhook className="h-3 w-3" /> Webhook API
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
            Website Integration
          </h2>
          <p className="font-medium text-base sm:text-lg leading-relaxed"
             style={{ color: "rgba(241, 245, 249, 0.8)" }}>
            Receive leads from your website, Shopify, or WooCommerce store via signed webhook.
          </p>
        </div>
      </div>

      {/* ─── Section 1: Webhook URL + Secret ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center"
               style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}>
            <Globe className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              Webhook Endpoint
            </h3>
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              POST signed payloads to this URL
            </p>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-xl px-4 py-3 font-mono text-sm font-bold border overflow-x-auto"
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

        {/* Secret Management */}
        <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--app-border)" }}>
          <div className="flex items-center gap-3">
            <Key className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--app-text)" }}>
                Webhook Secret
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {isOwner ? "HMAC-SHA256 key for signature verification" : "Only the Owner can manage the webhook secret"}
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
      </Card>

      {/* ─── Section 2: Integration Instructions ─── */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full px-8 py-5 flex items-center justify-between cursor-pointer transition-colors"
          style={{ backgroundColor: showInstructions ? "var(--app-bg-soft)" : "transparent" }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                 style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
              <Code className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                Integration Instructions
              </h3>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Code examples for computing HMAC signatures
              </p>
            </div>
          </div>
          {showInstructions ? (
            <ChevronUp className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          ) : (
            <ChevronDown className="h-5 w-5" style={{ color: "var(--text-secondary)" }} />
          )}
        </button>

        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-8 pb-8 space-y-6">
                {/* Payload format */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>Payload Format</h4>
                  <div className="rounded-xl p-4 text-xs font-medium leading-relaxed border"
                       style={{ backgroundColor: "rgba(59, 130, 246, 0.06)", borderColor: "rgba(59, 130, 246, 0.1)", color: "#1e40af" }}>
                    <p className="mb-2 font-bold">Required fields:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li><code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}>phone</code> — Contact phone (required)</li>
                      <li><code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}>name</code> — Contact name (optional)</li>
                      <li><code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}>email</code> — Email (optional)</li>
                      <li><code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(59, 130, 246, 0.1)" }}>message</code> — Inquiry text (optional)</li>
                    </ul>
                  </div>
                </div>

                {/* Signature format */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>Signature Header</h4>
                  <div className="rounded-xl p-4 text-xs font-medium leading-relaxed border"
                       style={{ backgroundColor: "rgba(34, 197, 94, 0.06)", borderColor: "rgba(34, 197, 94, 0.1)", color: "#166534" }}>
                    <p className="mb-2 font-bold">Custom websites:</p>
                    <code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}>X-Webhook-Signature: sha256=&lt;hex-digest&gt;</code>
                    <p className="mt-3 mb-2 font-bold">Shopify (auto-detected):</p>
                    <code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}>X-Shopify-Hmac-SHA256: &lt;base64-digest&gt;</code>
                    <p className="mt-3 mb-2 font-bold">WooCommerce (auto-detected):</p>
                    <code className="font-mono font-black px-1 rounded" style={{ backgroundColor: "rgba(34, 197, 94, 0.1)" }}>X-WC-Webhook-Signature: &lt;base64-digest&gt;</code>
                  </div>
                </div>

                {/* Code snippet */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black" style={{ color: "var(--app-text)" }}>Node.js Example</h4>
                  <CodeSnippet webhookUrl={webhookUrl} />
                </div>

                {/* Full docs link */}
                <a
                  href="https://github.com/LeadSyncApp/leadsync-backend/blob/main/docs/website-webhook-integration.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl border transition-all hover:opacity-80"
                  style={{ color: "var(--brand-saffron)", borderColor: "rgba(212, 168, 67, 0.3)", backgroundColor: "rgba(212, 168, 67, 0.06)" }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Full Documentation
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* ─── Section 3: Delivery Logs (OWNER only) ─── */}
      {isOwner && (
      <Card className="p-8 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                 style={{ backgroundColor: "rgba(168, 85, 247, 0.1)", color: "#a855f7" }}>
              <Clock className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                Delivery Logs
              </h3>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                {logTotal} total delivery attempt{logTotal !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2">
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
