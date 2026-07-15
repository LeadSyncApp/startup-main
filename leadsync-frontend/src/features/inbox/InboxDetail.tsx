import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Loader2, AlertTriangle, RefreshCw, MessageCircle, Instagram, Globe, Menu } from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";
import AiSuggestionPanel from "./AiSuggestionPanel";
import { Badge } from "../../components/ui/Badge";

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
  customerName?: string | null;
  customerContact?: string | null;
  messages: BackendMessage[];
}

const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  TELEGRAM: MessageCircle,
  WHATSAPP: MessageCircle,
  INSTAGRAM: Instagram,
  WEBSITE: Globe,
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
  OPEN: "neutral",
  ASSIGNED: "warning",
  RESOLVED: "success",
  SNOOZED: "info",
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
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);
  // Customer history banner
  const [history, setHistory] = useState<{ totalConversations: number; conversations: Array<{ id: string; status: string; claimedByName: string | null; resolvedBy: string | null; createdAt: string; updatedAt: string }> } | null>(null);
  const [_historyExpanded, setHistoryExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

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

  // Fetch customer history on lead change
  useEffect(() => {
    if (!leadId) return;
    setHistory(null);
    setHistoryExpanded(false);
    authedFetch(`/api/leads/${leadId}/history`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setHistory(data))
      .catch(() => {});
  }, [leadId]);

  // Sync mode state from backend
  useEffect(() => {
    if (!detail?.mode) return;
    setMode(detail.mode === "HUMAN" ? "YOU" : "AI");
  }, [detail?.mode]);

  // Auto-open panel when switching to YOU mode
  useEffect(() => {
    if (mode === "YOU") setPanelOpen(true);
  }, [mode]);

  // Resolve conversation (Done button)
  const handleResolve = async () => {
    if (!leadId || !detail?.conversationId) return;
    
    try {
      const res = await authedFetch(`/api/leads/${leadId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to resolve conversation");
      }
      toast.success("Conversation resolved");
      setShowResolveConfirm(false);
      fetchMessages(); // Refresh to get updated status
    } catch (e: any) {
      toast.error("Could not resolve: " + (e.message || "Unknown error"));
    }
  };

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
  const customerDisplayName = detail.customerName || detail.customerContact || "Customer";
  const customerPhone = detail.customerContact || null;

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
            {/* Delivery status indicator for non-failed messages */}
            {!isFailed && !isSystem && (
              <span className="text-[9px] font-mono opacity-50 ml-auto">
                {msg.deliveryStatus === "SENT" && (msg.isRead ? "✓✓ Read" : "✓ Sent")}
                {msg.deliveryStatus === "PENDING" && "⏳ Pending"}
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
    <div className="flex h-full w-full overflow-hidden">
      <div className={`flex flex-col h-full transition-all duration-200 ${mode === "YOU" ? "w-[calc(100%-340px)]" : "w-full"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
        <button onClick={() => navigate("/inbox")} className="p-2 rounded-xl hover:bg-slate-900 border border-slate-800 transition cursor-pointer">
          <ArrowLeft className="h-4 w-4 text-app-text-muted" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-app-text truncate">{customerDisplayName}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {customerPhone && customerPhone !== customerDisplayName && (
              <span className="text-[10px] text-slate-400 font-mono">{customerPhone}</span>
            )}
            <Badge variant="neutral" className="flex items-center gap-1">
              <ChannelIcon className="h-3 w-3" />
              {detail.channel}
            </Badge>
            <Badge variant={STATUS_VARIANT[detail.status?.toUpperCase()] || "neutral"}>
              {detail.status}
            </Badge>
          </div>
        </div>
        {/* Done button - only show in YOU mode */}
        {mode === "YOU" && (
          <button
            onClick={() => setShowResolveConfirm(true)}
            className="px-2 py-0.5 text-[10px] font-black rounded border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
          >
            Done
          </button>
        )}
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
        {/* Panel toggle button */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            panelOpen
              ? "bg-slate-700 border-slate-600 text-app-text"
              : "bg-slate-800/50 border-slate-700 text-app-text-muted hover:bg-slate-700"
          }`}
        >
          <Menu className="h-4 w-4" />
        </button>
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

      {panelOpen && leadId && (
        <div className="w-[340px] shrink-0 border-l border-slate-800 h-full overflow-y-auto">
          {history && (
            <div className="border-b border-slate-800">
              <div className="px-4 py-2 text-[11px] text-amber-300/80 font-mono font-black uppercase tracking-wider">
                Customer Details
              </div>
              <div className="px-4 pb-3 space-y-1">
                {history.totalConversations === 0 ? (
                  <div className="text-[10px] text-slate-500 font-mono italic">
                    No past conversations
                  </div>
                ) : (
                  <>
                    <div className="text-[10px] text-slate-500 font-mono mb-1">
                      {history.totalConversations} past conversation{history.totalConversations !== 1 ? 's' : ''}
                    </div>
                    {history.totalConversations > 1 && history.conversations.slice(1).map((c) => (
                      <div key={c.id} className="text-[10px] text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                        <Badge variant={c.claimedByName ? 'success' : 'warning'}>
                          {c.claimedByName || 'unclaimed'}
                        </Badge>
                        <Badge variant={c.resolvedBy ? 'success' : c.status === 'RESOLVED' ? 'success' : 'info'}>
                          {c.resolvedBy ? `resolved by ${c.resolvedBy}` : c.status}
                        </Badge>
                        <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
          {mode === "YOU" && (
            <AiSuggestionPanel
              leadId={leadId}
              onUseAndEdit={(suggestion) => setContent(suggestion)}
              latestMessageId={detail?.messages[detail.messages.length - 1]?.id}
            />
          )}
        </div>
      )}

      {/* Resolve Confirmation Modal */}
      {showResolveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-sm w-full mx-4">
            <h3 className="text-sm font-black text-app-text mb-2">Mark conversation as resolved?</h3>
            <p className="text-xs text-slate-400 mb-4">
              This will mark the conversation as resolved. The customer will be moved to the resolved list.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResolveConfirm(false)}
                className="px-3 py-1.5 text-xs font-black text-slate-400 border border-slate-700 rounded hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                className="px-3 py-1.5 text-xs font-black text-emerald-300 border border-emerald-500/40 rounded bg-emerald-500/20 hover:bg-emerald-500/30 transition cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxDetail;