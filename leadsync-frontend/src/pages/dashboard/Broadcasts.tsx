import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { Megaphone, Send, CheckCircle, Clock, AlertTriangle, Radio } from "lucide-react";
import toast from "react-hot-toast";
import { PageTransition } from "../../components/ui/Animations";
import { EmptyBroadcasts } from "../../components/ui/EmptyState";

const CHANNELS = [
  { value: "TELEGRAM", label: "Telegram", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "INSTAGRAM", label: "Instagram", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
];

const SEGMENTS = [
  { value: "ALL", label: "All Leads", desc: "Every contact on this channel" },
  { value: "NEW", label: "New", desc: "First-time visitors" },
  { value: "REGULAR", label: "Regular", desc: "Repeat customers" },
  { value: "VIP", label: "VIP", desc: "High-spend customers" },
  { value: "CHURN_RISK", label: "Churn Risk", desc: "Inactive or low-sentiment leads" },
];

const STATUS_ICON: Record<string, JSX.Element> = {
  PENDING: <Clock className="h-4 w-4 text-text-disabled" />,
  SENDING: <Radio className="h-4 w-4 text-blue-400 animate-pulse" />,
  DONE: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  FAILED: <AlertTriangle className="h-4 w-4 text-red-400" />,
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-background-elevated text-text-muted",
  SENDING: "bg-blue-500/10 text-blue-400",
  DONE: "bg-emerald-500/10 text-emerald-400",
  FAILED: "bg-red-500/10 text-red-400",
};

export default function Broadcasts() {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) =>
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const [channel, setChannel] = useState("TELEGRAM");
  const [segment, setSegment] = useState("ALL");
  const [message, setMessage] = useState("");

  const charLimit = 1000;

  async function fetchHistory() {
    try {
      const res = await api.get("/broadcasts");
      setHistory(res);
    } catch {
      /* silent */
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  async function handleSend() {
    if (!message.trim()) return toast.error("Message cannot be empty");
    setSending(true);
    setShowConfirm(false);
    try {
      const res = await api.post("/broadcasts", { message, channel, targetSegment: segment });
      toast.success(`Sending to ${res.total} lead${res.total !== 1 ? "s" : ""}…`);
      setMessage("");
      // Poll for updated history after 3 s
      setTimeout(fetchHistory, 3000);
    } catch (err: any) {
      toast.error(err.message || "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  const selectedSegmentLabel = SEGMENTS.find((s) => s.value === segment)?.label ?? segment;
  const selectedChannelLabel = CHANNELS.find((c) => c.value === channel)?.label ?? channel;

  return (
    <PageTransition className="space-y-8 max-w-4xl">
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Broadcasts</h1>
        <p className="mt-1 text-sm text-text-muted">
          Send a message to a group of leads on a specific channel.
        </p>
      </div>

      {/* COMPOSE */}
      <div className="rounded-2xl border border-border bg-background-secondary shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-text-primary">New Broadcast</h2>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* Channel */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Channel</label>
            <div className="flex gap-3">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.value}
                  onClick={() => setChannel(ch.value)}
                  className={`px-4 py-2 rounded-xl border text-sm font-medium transition ${
                    channel === ch.value
                      ? ch.color + " ring-2 ring-offset-1 ring-offset-background-primary ring-current"
                      : "bg-background-tertiary text-text-secondary border-border hover:bg-background-elevated"
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Target Segment</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SEGMENTS.map((seg) => (
                <button
                  key={seg.value}
                  onClick={() => setSegment(seg.value)}
                  className={`p-3 rounded-xl border text-left transition ${
                    segment === seg.value
                      ? "bg-accent text-white border-accent"
                      : "bg-background-tertiary text-text-secondary border-border hover:bg-background-elevated"
                  }`}
                >
                  <p className="font-semibold text-sm">{seg.label}</p>
                  <p className={`text-xs mt-0.5 ${segment === seg.value ? "text-white/70" : "text-text-disabled"}`}>
                    {seg.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-text-secondary mb-2">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, charLimit))}
              rows={5}
              placeholder="Hi! 👋 We have a special offer just for you…"
              className="w-full rounded-xl border border-border bg-background-tertiary px-4 py-3 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
            <p className="mt-1 text-xs text-text-disabled text-right">
              {message.length}/{charLimit}
            </p>
          </div>

          {/* Send Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={sending || !message.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
            >
              <Send className="h-4 w-4" />
              Send Broadcast
            </button>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background-secondary rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-border"
          >
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 p-2 rounded-xl">
                <Megaphone className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Confirm Broadcast</h3>
            </div>
            <p className="text-sm text-text-secondary">
              You are about to send a message to all{" "}
              <span className="font-semibold text-text-primary">{selectedSegmentLabel}</span> leads on{" "}
              <span className="font-semibold text-text-primary">{selectedChannelLabel}</span>. This cannot
              be undone.
            </p>
            <div className="bg-background-tertiary rounded-xl p-4 text-sm text-text-secondary italic border border-border">
              "{message.slice(0, 120)}{message.length > 120 ? "…" : ""}"
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:bg-background-tertiary rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl transition"
              >
                Send Now
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* HISTORY */}
      <div className="rounded-2xl border border-border bg-background-secondary shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Broadcast History</h2>
        </div>

        {loadingHistory ? (
          <div className="p-6 space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-background-tertiary rounded w-3/4" />
                  <div className="h-3 bg-background-tertiary rounded w-1/3" />
                </div>
                <div className="h-6 w-16 bg-background-tertiary rounded-full" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <EmptyBroadcasts />
        ) : (
          <div className="divide-y divide-border">
            {history.map((b: any) => {
              const total = (b.sentCount ?? 0) + (b.failedCount ?? 0);
              const successPct = total > 0 ? Math.round((b.sentCount / total) * 100) : 0;
              const failPct = total > 0 ? Math.round((b.failedCount / total) * 100) : 0;
              const isExpanded = expandedRows.has(b.id);

              return (
              <div key={b.id} className="px-6 py-4 hover:bg-background-tertiary/50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => toggleRow(b.id)}
                  >
                    <p className={`text-sm text-text-secondary ${isExpanded ? "" : "truncate"}`}>
                      "{b.message}"
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs font-medium text-text-muted">
                        {b.channel} · {b.targetSegment}
                      </span>
                      <span className="text-xs text-text-disabled">
                        {new Date(b.createdAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[b.status]}`}
                    >
                      {STATUS_ICON[b.status]}
                      {b.status}
                    </span>
                    {b.status === "DONE" && total > 0 && (
                      <p className="text-xs text-text-disabled">
                        ✅ {b.sentCount} sent
                        {b.failedCount > 0 && (
                          <span className="text-red-400 ml-1">· ⚠️ {b.failedCount} failed</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Delivery progress bar (DONE rows with data) */}
                {b.status === "DONE" && total > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="flex h-2 rounded-full overflow-hidden bg-background-tertiary">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${successPct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="bg-emerald-500 h-full"
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${failPct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                        className="bg-red-400 h-full"
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span className="text-emerald-400">{successPct}% delivered</span>
                      {failPct > 0 && <span className="text-red-400">{failPct}% failed</span>}
                      <span className="text-text-disabled">{total} total</span>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
