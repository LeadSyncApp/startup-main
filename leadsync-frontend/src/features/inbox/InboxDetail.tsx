import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, AlertTriangle, RefreshCw, MessageCircle, Instagram, Globe } from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";

// ── Types ──
export interface BackendMessage {
  id: string;
  content: string;
  sender: string;
  senderName: string | null;
  platform: string;
  messageType: string;
  deliveryStatus: string;
  deliveryError?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationDetail {
  leadId: string;
  conversationId: string;
  status: string;
  channel?: string;
  mode?: "BOT" | "HUMAN";
  resolvedBy?: string | null;
  messages: BackendMessage[];
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  TELEGRAM: MessageCircle,
  WHATSAPP: MessageCircle,
  INSTAGRAM: Instagram,
  WEBSITE: Globe,
};

const CHANNEL_CLASS: Record<string, string> = {
  TELEGRAM: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  WHATSAPP: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  INSTAGRAM: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  WEBSITE: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

export function InboxDetail() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [networkError, setNetworkError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Idempotency key: stored as ref so it persists across retries within the same send attempt
  const clientMessageIdRef = useRef<string | null>(null);
  // Track the message content that's currently being retried (to show retry affordance)
  const [failedMessageContent, setFailedMessageContent] = useState<string | null>(null);
  // Track conversation mode for AI/You toggle (AI = BOT mode, You = HUMAN mode)
  const [mode, setMode] = useState<"AI" | "YOU">("AI");

  const fetchMessages = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await authedFetch(`/api/leads/${leadId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data: ConversationDetail = await res.json();
      setDetail(data);
      setNetworkError(null);
    } catch (e: any) {
      setNetworkError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // Initial fetch + polling
  useEffect(() => {
    fetchMessages();
    pollIntervalRef.current = setInterval(fetchMessages, 6000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  // Sync mode state from backend
  useEffect(() => {
    if (!detail?.mode) return;
    setMode(detail.mode === "HUMAN" ? "YOU" : "AI");
  }, [detail?.mode]);

  // Toggle conversation mode between AI (BOT) and You (HUMAN)
  const handleModeToggle = async (newMode: "AI" | "YOU") => {
    if (newMode === mode) return;
    if (!leadId || !detail?.conversationId) return;
    const previousMode = mode;
    const apiMode = newMode === "AI" ? "BOT" : "HUMAN";

    // Optimistic update
    setMode(newMode);

    try {
      const res = await authedFetch(`/api/leads/${leadId}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: apiMode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to change mode");
      }
      // Success - mode already updated optimistically
    } catch (e: any) {
      // Revert on error
      setMode(previousMode);
      toast.error("Could not switch mode: " + (e.message || "Unknown error"));
    }
  };

  const handleSend = async (retryMessage?: string) => {
    const textToSend = retryMessage !== undefined ? retryMessage : content.trim();
    if (!textToSend || !leadId || sending) return;

    // Generate UUID on first attempt; reuse on retry (ref persists)
    if (!clientMessageIdRef.current) {
      clientMessageIdRef.current = crypto.randomUUID();
    }

    setSending(true);
    setNetworkError(null);
    setFailedMessageContent(null);

    // Only clear input box for a new send, not for retry (which was already cleared)
    if (retryMessage === undefined) {
      setContent("");
    }

    try {
      const res = await authedFetch(`/api/leads/${leadId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: textToSend,
          clientMessageId: clientMessageIdRef.current,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to send");
      }
      const sent: BackendMessage = await res.json();
      setDetail((prev) => {
        if (!prev) return prev;
        const exists = prev.messages.some((m) => m.id === sent.id);
        if (exists) return prev;
        return { ...prev, messages: [...prev.messages, sent] };
      });
      // If sent successfully (even with FAILED delivery), keep clientMessageId for retry
      // Only clear it on permanent SENT success
      if (sent.deliveryStatus === "SENT") {
        clientMessageIdRef.current = null; // fresh key for next message
      } else if (sent.deliveryStatus === "FAILED") {
        setFailedMessageContent(textToSend); // show retry button
      }
    } catch (e: any) {
      setNetworkError("Couldn't send — please try again.");
      toast.error("Failed to send message");
      // Keep clientMessageIdRef so retry does NOT create a duplicate row
      setFailedMessageContent(textToSend);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-saffron" />
        <span className="ml-3 text-sm text-app-text-muted">Loading conversation...</span>
      </div>
    );
  }

  if (networkError && !detail) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-rose-400 font-mono">{networkError}</p>
        <button onClick={fetchMessages} className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-black rounded-xl text-slate-300 transition cursor-pointer">
          Retry
        </button>
      </div>
    );
  }

  if (!detail) return null;

  // BUGFIX: Use detail.channel instead of detail.status for channel icon/class
  const ChannelIcon = CHANNEL_ICON[detail.channel?.toUpperCase() || "WEBSITE"] || Globe;
  const channelClass = CHANNEL_CLASS[detail.channel?.toUpperCase() || "WEBSITE"] || CHANNEL_CLASS.WEBSITE;

  const renderBubble = (msg: BackendMessage) => {
    const isClient = msg.sender === "CLIENT";
    const isAgent = msg.sender === "AGENT";
    const isBot = msg.sender === "BOT";
    const isSystem = msg.sender === "SYSTEM";
    const isFailed = msg.deliveryStatus === "FAILED";
    const senderLabel = msg.senderName || (isBot ? "Auto-reply" : isAgent ? "Agent" : isClient ? "Customer" : "System");

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center py-2">
          <div className="px-4 py-2 rounded-2xl border border-slate-800 bg-slate-900/60 text-[11px] text-slate-400 font-mono max-w-[85%] text-center">
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex ${isClient ? "justify-start" : "justify-end"} py-2`}>
        <div className={`max-w-[75%] px-4 py-3 rounded-2xl border ${
          isFailed
            ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
            : isClient
            ? "bg-slate-800 border-slate-700 text-slate-200"
            : isBot
            ? "bg-teal-600/90 border-teal-500/70 text-white"
            : "bg-brand-navy border-brand-navy/80 text-white"
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{senderLabel}</span>
            {isBot && (
              <span className="text-[9px] font-black text-teal-300/80 border border-teal-400/40 rounded px-1">AI</span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 text-[10px] font-black text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Failed
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
          {msg.deliveryError && (
            <p className="text-[10px] font-mono text-rose-400/70 mt-1 italic">{msg.deliveryError}</p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] opacity-50 font-mono">
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {isFailed && isAgent && (
              <button
                onClick={() => handleSend(msg.content)}
                disabled={sending}
                className="flex items-center gap-1 text-[10px] font-black text-rose-400 hover:text-rose-300 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${sending ? "animate-spin" : ""}`} />
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <button onClick={() => navigate("/inbox")} className="p-2 rounded-xl hover:bg-slate-900 border border-slate-800 transition cursor-pointer">
          <ArrowLeft className="h-4 w-4 text-app-text-muted" />
        </button>
        <div className="flex-1">
          <h2 className="text-sm font-black text-app-text">Conversation</h2>
          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${channelClass}`}>
            <ChannelIcon className="h-3 w-3" />
            {detail.status}
          </span>
        </div>
        {/* AI/You Mode Toggle Pill */}
        <div className="flex items-center gap-1">
          <span
            onClick={() => handleModeToggle("AI")}
            className={`text-[10px] font-black px-2 py-0.5 rounded-l-sm border border-r-0 cursor-pointer transition ${
              mode === "AI"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700"
            }`}
          >
            AI
          </span>
          <span
            onClick={() => handleModeToggle("YOU")}
            className={`text-[10px] font-black px-2 py-0.5 rounded-r-sm border border-l-0 cursor-pointer transition ${
              mode === "YOU"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-700"
            }`}
          >
            You
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-2">
        {detail.messages.length === 0 && (
          <div className="text-center text-xs text-slate-500 py-8">No messages yet. Say hello!</div>
        )}
        {detail.messages.map(renderBubble)}
        {/* Retry bar at bottom for current failed send */}
        {failedMessageContent && (
          <div className="flex justify-center py-2">
            <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[11px] text-rose-400 font-mono flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" />
              <span>Send failed — </span>
              <button
                onClick={() => handleSend(failedMessageContent)}
                disabled={sending}
                className="font-black text-rose-300 hover:text-rose-200 transition cursor-pointer disabled:opacity-50"
              >
                {sending ? "Sending..." : "Retry"}
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Network error banner */}
      {networkError && !failedMessageContent && (
        <div className="px-4 py-2 bg-rose-500/10 border-t border-rose-500/30 text-[11px] text-rose-400 font-mono">
          {networkError}
        </div>
      )}

      {/* Input */}
      <div className="pt-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={sending ? "Sending..." : "Type a reply..."}
            disabled={sending}
            className="flex-1 input-field"
          />
          <button
            onClick={() => handleSend()}
            disabled={sending || !content.trim()}
            className="px-4 py-2 bg-brand-navy hover:bg-brand-navy/80 text-white rounded-xl font-black text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default InboxDetail;