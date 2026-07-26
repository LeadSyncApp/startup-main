import { useState } from "react";
import {
  MessageSquare, Copy, Check, Code,
  Sparkles, CheckCircle2, ShieldCheck, Laptop
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../auth-tenancy/AuthContext";
import { Button } from "../../components/ui/Button";
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

export function WebsiteWidgetConfig() {
  const { company } = useAuth();
  const companyId = company?.id || "";
  const scriptHost = getBackendUrl();
  const scriptSnippet = `<script src="${scriptHost}/widget.js" data-company-id="${companyId}" async defer></script>`;

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"shopify" | "wordpress" | "custom">("shopify");
  const [testMessage, setTestMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptSnippet);
    setCopied(true);
    toast.success("Widget script tag copied!", { icon: "📋" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTest = async () => {
    if (!testMessage.trim()) return;
    setIsTesting(true);
    try {
      const res = await fetch(`${scriptHost}/api/widget/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          visitorToken: `demo_${Date.now()}`,
          name: "Widget Preview Tester",
          phone: "9999999999",
          message: testMessage.trim()
        })
      });
      if (res.ok) {
        toast.success("Test message sent to your unified inbox!", { icon: "💬" });
        setTestMessage("");
      } else {
        toast.error("Failed to send test message.");
      }
    } catch {
      toast.error("Failed to connect to backend server.");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="rounded-[2.5rem] p-8 sm:p-10 shadow-lg text-white relative overflow-hidden group"
           style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}>
        <div className="absolute top-0 right-0 w-[45%] h-full pointer-events-none"
             style={{ background: "linear-gradient(to left, rgba(212, 168, 67, 0.1), transparent)" }} />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-[150px] translate-y-1/3 translate-x-1/3 opacity-20 pointer-events-none"
             style={{ backgroundColor: "var(--brand-saffron)" }} />
        <div className="relative z-10 max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "rgba(212, 168, 67, 0.15)", color: "var(--brand-saffron-light)" }}>
            <Sparkles className="h-3.5 w-3.5" /> Zero-Code Web Chat Widget
          </span>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight text-white">
            Embeddable Website Chat
          </h2>
          <p className="font-medium text-base sm:text-lg leading-relaxed"
             style={{ color: "rgba(241, 245, 249, 0.8)" }}>
            Add a floating chat bubble to your Shopify, WordPress, or custom site in under 60 seconds. Messages flow live into your LeadSync unified inbox.
          </p>
        </div>
      </div>

      {/* ─── Section 1: Embed Script Code ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                 style={{ backgroundColor: "var(--brand-saffron-soft)", color: "var(--brand-saffron)" }}>
              <Code className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
                Your Embed Script Tag
              </h3>
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Paste this single tag before the closing <code className="font-mono font-black">&lt;/body&gt;</code> tag of your website
              </p>
            </div>
          </div>
          <Badge variant="success" className="uppercase tracking-widest text-[10px] px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Verified Store ID
          </Badge>
        </div>

        {/* Code Snippet Box */}
        <div className="relative rounded-2xl overflow-hidden font-mono text-xs border"
             style={{ backgroundColor: "#0F172A", borderColor: "#1E293B", color: "#F8FAFC" }}>
          <div className="px-5 py-4 overflow-x-auto leading-relaxed select-all">
            {scriptSnippet}
          </div>
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 p-2 rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95"
            style={{ backgroundColor: "#1E293B", color: "var(--brand-saffron)", borderColor: "#334155" }}
          >
            {copied ? (
              <><Check className="h-4 w-4" style={{ color: "var(--success-green)" }} /><span className="text-[10px] uppercase font-bold" style={{ color: "var(--success-green)" }}>Copied</span></>
            ) : (
              <><Copy className="h-4 w-4" /><span className="text-[10px] uppercase font-bold">Copy Tag</span></>
            )}
          </button>
        </div>
      </Card>

      {/* ─── Section 2: Platform Guides ─── */}
      <Card className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center"
               style={{ backgroundColor: "rgba(59, 130, 246, 0.1)", color: "#3b82f6" }}>
            <Laptop className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              Installation Instructions
            </h3>
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Zero developer skills required
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b pb-4" style={{ borderColor: "var(--app-border)" }}>
          {(["shopify", "wordpress", "custom"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              style={{
                backgroundColor: activeTab === tab ? "var(--brand-saffron-soft)" : "transparent",
                color: activeTab === tab ? "var(--brand-saffron)" : "var(--text-secondary)",
                border: activeTab === tab ? "1px solid rgba(212, 168, 67, 0.3)" : "1px solid transparent"
              }}
            >
              {tab === "shopify" ? "Shopify Theme" : tab === "wordpress" ? "WordPress / Woo" : "Custom HTML / React"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-3 text-sm font-semibold" style={{ color: "var(--app-text)" }}>
          {activeTab === "shopify" && (
            <div className="space-y-3 p-5 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
              <div className="flex items-center gap-2 font-bold text-xs" style={{ color: "var(--brand-saffron)" }}>
                <CheckCircle2 className="h-4 w-4" /> Shopify Theme Editor Setup:
              </div>
              <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <li>Log in to your Shopify Admin and go to <strong>Online Store &gt; Themes</strong>.</li>
                <li>Click <strong>... (Actions) &gt; Edit Code</strong> on your active theme.</li>
                <li>Under Layout, click <code className="px-1 rounded bg-black/10 font-mono">theme.liquid</code>.</li>
                <li>Scroll to the very bottom and paste your script tag right before <code className="px-1 rounded bg-black/10 font-mono">&lt;/body&gt;</code>.</li>
                <li>Click <strong>Save</strong>. Your chat bubble is now live!</li>
              </ol>
            </div>
          )}

          {activeTab === "wordpress" && (
            <div className="space-y-3 p-5 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
              <div className="flex items-center gap-2 font-bold text-xs" style={{ color: "#a855f7" }}>
                <CheckCircle2 className="h-4 w-4" /> WordPress & WooCommerce Setup:
              </div>
              <ol className="list-decimal list-inside space-y-2 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <li>Log in to your WordPress Dashboard.</li>
                <li>Install and activate the free <strong>Header and Footer Scripts</strong> plugin (or use <strong>Appearance &gt; Theme File Editor</strong>).</li>
                <li>Paste your embed script into the <strong>Footer Scripts</strong> section.</li>
                <li>Click <strong>Save Changes</strong>.</li>
              </ol>
            </div>
          )}

          {activeTab === "custom" && (
            <div className="space-y-3 p-5 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
              <div className="flex items-center gap-2 font-bold text-xs" style={{ color: "#3b82f6" }}>
                <CheckCircle2 className="h-4 w-4" /> Custom HTML / Framework Site:
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Paste the script tag inside your <code className="px-1 rounded bg-black/10 font-mono">index.html</code> or layout component right before the closing <code className="px-1 rounded bg-black/10 font-mono">&lt;/body&gt;</code> tag.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Section 3: Live Test Simulator ─── */}
      <Card className="p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center"
               style={{ backgroundColor: "rgba(34, 197, 94, 0.1)", color: "#22c55e" }}>
            <MessageSquare className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight" style={{ color: "var(--app-text)" }}>
              Test Simulator
            </h3>
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Send a synthetic widget message straight into your unified inbox to test your setup
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="e.g. Hi, is this product in stock?"
            className="flex-1 text-sm font-semibold rounded-xl px-4 py-3 border outline-none"
            style={{ backgroundColor: "var(--app-input-bg)", borderColor: "var(--app-border)", color: "var(--app-text)" }}
          />
          <Button
            variant="primary"
            onClick={handleSendTest}
            disabled={isTesting || !testMessage.trim()}
            className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
          >
            {isTesting ? "Sending..." : "Send Test Message"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
