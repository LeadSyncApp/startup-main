import { useState } from "react";
import {
  Copy, Check, Sparkles, CheckCircle2, ShieldCheck, ArrowLeft
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";

function getBackendUrl(): string {
  const envUrl = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_SOCKET_URL) as string | undefined;
  if (envUrl && (envUrl.startsWith("http://") || envUrl.startsWith("https://"))) {
    return envUrl.replace(/\/$/, "");
  }
  const apiUrl = (import.meta.env.VITE_API_URL) as string | undefined;
  if (apiUrl && (apiUrl.startsWith("http://") || apiUrl.startsWith("https://"))) {
    return apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location.origin.includes(":5173")) {
    return "http://localhost:4000";
  }
  return typeof window !== "undefined" ? window.location.origin : "http://localhost:4000";
}

export interface WebsiteWidgetConfigProps {
  onBack?: () => void;
}

export function WebsiteWidgetConfig({ onBack }: WebsiteWidgetConfigProps = {}) {
  const { company } = useAuth();
  const companyId = company?.id || "";
  const scriptHost = getBackendUrl();
  const scriptSnippet = `<script src="${scriptHost}/widget.js" data-company-id="${companyId}" async defer></script>`;

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"shopify" | "wordpress" | "custom">("shopify");

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptSnippet);
    setCopied(true);
    toast.success("Widget script tag copied!", { icon: "📋" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header & Back Navigation */}
      {onBack && (
        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
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
          <div className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
            Connections Hub &gt; <span style={{ color: "var(--app-text)" }}>Website Chat Widget Setup</span>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <div
        className="rounded-[2.5rem] p-8 sm:p-10 shadow-lg text-white relative overflow-hidden group"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
      >
        <div
          className="absolute top-0 right-0 w-[45%] h-full pointer-events-none"
          style={{ background: "linear-gradient(to left, rgba(212, 168, 67, 0.1), transparent)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[150px] translate-y-1/3 translate-x-1/3 opacity-20 pointer-events-none"
          style={{ backgroundColor: "var(--brand-saffron)" }}
        />
        <div className="relative z-10 max-w-2xl space-y-4">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
            style={{ backgroundColor: "rgba(212, 168, 67, 0.15)", color: "var(--brand-saffron-light)" }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Easy Setup Guide
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
            Embeddable Website Chat
          </h2>
          <p
            className="font-medium text-base sm:text-lg leading-relaxed"
            style={{ color: "rgba(241, 245, 249, 0.85)" }}
          >
            Add a friendly chat bubble to your website so customers can message you directly. Follow these simple steps below.
          </p>
        </div>
      </div>

      {/* Numbered Step Flow Container */}
      <div className="space-y-6">
        {/* Step 1: Plain-language intro */}
        <Card className="p-6 sm:p-8 flex items-start gap-5">
          <div
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg"
            style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
          >
            1
          </div>
          <div className="space-y-2 pt-1">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md"
              style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
            >
              Step 1
            </span>
            <h3 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              What does this do?
            </h3>
            <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              This adds a chat bubble to your website so customers can message you directly. Any visitor typing a message on your site will automatically connect to your LeadSync team inbox.
            </p>
          </div>
        </Card>

        {/* Step 2: Copy this code */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-5">
            <div
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg"
              style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
            >
              2
            </div>
            <div className="flex-1 space-y-1 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md"
                  style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
                >
                  Step 2
                </span>
                <Badge variant="success" className="uppercase tracking-widest text-[10px] px-3 py-1">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verified Store ID
                </Badge>
              </div>
              <h3 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                Copy this code
              </h3>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Click the button below to copy your website chat code to your clipboard.
              </p>
            </div>
          </div>

          {/* Code Snippet Box */}
          <div
            className="relative rounded-2xl overflow-hidden font-mono text-xs border p-2"
            style={{ backgroundColor: "#0F172A", borderColor: "#1E293B", color: "#F8FAFC" }}
          >
            <div className="px-5 py-4 overflow-x-auto leading-relaxed select-all pr-36">
              {scriptSnippet}
            </div>
            <button
              onClick={handleCopy}
              className="absolute right-4 top-1/2 -translate-y-1/2 px-5 py-3 rounded-xl transition-all border flex items-center gap-2 cursor-pointer active:scale-95 shadow-md"
              style={{
                backgroundColor: copied ? "var(--success-green)" : "var(--brand-saffron)",
                color: "#FFFFFF",
                borderColor: "transparent"
              }}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span className="text-xs uppercase font-black tracking-wider">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 stroke-[2.5]" />
                  <span className="text-xs uppercase font-black tracking-wider">Copy Code</span>
                </>
              )}
            </button>
          </div>
        </Card>

        {/* Step 3: Paste it into your website */}
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-5">
            <div
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg"
              style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
            >
              3
            </div>
            <div className="space-y-1 pt-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md"
                style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}
              >
                Step 3
              </span>
              <h3 className="text-xl font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                Paste it into your website
              </h3>
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                Choose your website platform below and paste this exact code where instructed.
              </p>
            </div>
          </div>

          {/* Platform Tabs */}
          <div className="flex gap-2 border-b pb-4 overflow-x-auto" style={{ borderColor: "var(--app-border)" }}>
            {(["shopify", "wordpress", "custom"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: activeTab === tab ? "var(--brand-saffron-soft)" : "transparent",
                  color: activeTab === tab ? "var(--brand-saffron)" : "var(--text-secondary)",
                  border: activeTab === tab ? "1px solid rgba(212, 168, 67, 0.3)" : "1px solid transparent"
                }}
              >
                {tab === "shopify" ? "Shopify Theme" : tab === "wordpress" ? "WordPress / WooCommerce" : "Custom Website / HTML"}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="space-y-3 font-semibold" style={{ color: "var(--app-text)" }}>
            {activeTab === "shopify" && (
              <div className="space-y-3 p-5 sm:p-6 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--brand-saffron)" }}>
                  <CheckCircle2 className="h-4 w-4" /> Shopify Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
                  <li>Log in to your Shopify Admin and go to <strong>Online Store &gt; Themes</strong>.</li>
                  <li>Click <strong>... (Actions) &gt; Edit Code</strong> on your active theme.</li>
                  <li>Under Layout, click <code className="px-1.5 py-0.5 rounded bg-black/10 font-mono">theme.liquid</code>.</li>
                  <li>Scroll to the very bottom and paste your exact code where instructed below (right before the bottom <code className="px-1.5 py-0.5 rounded bg-black/10 font-mono">&lt;/body&gt;</code> line).</li>
                  <li>Click <strong>Save</strong>. Your chat bubble is now live on your site!</li>
                </ol>
              </div>
            )}

            {activeTab === "wordpress" && (
              <div className="space-y-3 p-5 sm:p-6 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "#a855f7" }}>
                  <CheckCircle2 className="h-4 w-4" /> WordPress & WooCommerce Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
                  <li>Log in to your WordPress Dashboard.</li>
                  <li>Go to Plugins and install the free <strong>Header and Footer Scripts</strong> plugin (or use <strong>Appearance &gt; Theme File Editor</strong>).</li>
                  <li>Paste your chat code into the <strong>Footer Scripts</strong> box.</li>
                  <li>Click <strong>Save Changes</strong>.</li>
                </ol>
              </div>
            )}

            {activeTab === "custom" && (
              <div className="space-y-3 p-5 sm:p-6 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
                <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "#3b82f6" }}>
                  <CheckCircle2 className="h-4 w-4" /> Custom Website Instructions:
                </div>
                <p className="text-xs sm:text-sm leading-relaxed font-medium" style={{ color: "var(--text-secondary)" }}>
                  Paste this exact code where instructed below: inside your website's HTML layout file right before the closing <code className="px-1.5 py-0.5 rounded bg-black/10 font-mono">&lt;/body&gt;</code> tag.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Step 4: Friendly confirmation line */}
        <Card className="p-6 sm:p-8 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-5">
            <div
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shrink-0 flex items-center justify-center font-black text-lg"
              style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#16a34a" }}
            >
              4
            </div>
            <div className="space-y-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md"
                style={{ backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#16a34a" }}
              >
                Step 4
              </span>
              <h3 className="text-base sm:text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                All set!
              </h3>
              <p className="text-xs sm:text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                Once added, new website messages will show up in My Chats automatically.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
