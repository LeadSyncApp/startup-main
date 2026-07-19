import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-tenancy/AuthContext";

// NOTE FOR REVIEW: InboxDetail accepts optional leadId and showBackButton props.
// When rendered from InboxSplitView, leadId is passed directly and back button is hidden.
// When used standalone (route /inbox/:leadId), leadId comes from useParams and back button shows.
interface InboxDetailProps {
  leadId?: string;
  showBackButton?: boolean;
}
import { ArrowLeft, Send, Loader2, AlertTriangle, RefreshCw, MessageCircle, Instagram, Globe, Menu, Plus, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import { authedFetch } from "../../api/client";
import AiSuggestionPanel from "./AiSuggestionPanel";
import { ProductPickerModal } from "./ProductPickerModal";
import { PaymentRequestModal } from "./PaymentRequestModal";
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

export function InboxDetail({ leadId: propLeadId, showBackButton = true }: InboxDetailProps = {}) {
  const { company } = useAuth();
  const { leadId: paramLeadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const leadId = propLeadId || paramLeadId;
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const [networkError, setNetworkError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Tracks the last known message count so we can mark the conversation read
  // whenever a NEW message arrives while it's open (keeps unread at 0 live).
  const lastMsgCountRef = useRef<number>(0);
  // Idempotency key: stored as ref so it persists across retries within the same send attempt
  const clientMessageIdRef = useRef<string | null>(null);
  // Track the message content that's currently being retried (to show retry affordance)
  const [failedMessageContent, setFailedMessageContent] = useState<string | null>(null);
  // Track conversation mode for AI/You toggle (AI = BOT mode, You = HUMAN mode)
  const [mode, setMode] = useState<"AI" | "YOU">("AI");
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);
  // Customer history banner
  const [history, setHistory] = useState<{ totalConversations: number; conversations: Array<{ id: string; status: string; claimedByName: string | null; resolvedBy: string | null; createdAt: string; updatedAt: string }> } | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"details" | "ai">("details");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showPaymentRequest, setShowPaymentRequest] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!leadId) return;
    try {
      const res = await authedFetch(`/api/leads/${leadId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data: ConversationDetail = await res.json();
      setDetail(data);
      setNetworkError(null);

      // While this conversation is open and live, any newly-arrived message is
      // being read in real time — keep lastViewedAt current so the server-side
      // unread count stays 0. The moment the user switches/closes, this poll
      // stops and new messages afterwards correctly count as unread again.
      const newCount = data.messages?.length ?? 0;
      if (newCount > lastMsgCountRef.current) {
        lastMsgCountRef.current = newCount;
        authedFetch(`/api/leads/${leadId}/read`, { method: "POST" }).catch(() => {});
      } else {
        lastMsgCountRef.current = newCount;
      }
    } catch (e: any) {
      setNetworkError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // Mark the conversation as read when it is opened (once per lead view).
  // The UI clears optimistically + instantly via the conversation:read event,
  // BEFORE the API call — the backend request happens silently in the background
  // and the socket re-sync just keeps state authoritative afterwards.
  const markAsRead = useCallback(() => {
    if (!leadId) return;
    // Instant local update: clear the badge + sidebar count right now.
    window.dispatchEvent(new CustomEvent("conversation:read", { detail: { leadId } }));
    // Fire-and-forget the backend call (don't await — must not block the UI).
    authedFetch(`/api/leads/${leadId}/read`, { method: "POST" }).catch(() => {
      // Non-fatal: unread state will reconcile on next list refresh.
    });
  }, [leadId]);

  // Initial fetch + polling
  useEffect(() => {
    lastMsgCountRef.current = 0; // reset baseline so the first fetch marks read
    fetchMessages();
    markAsRead();
    pollIntervalRef.current = setInterval(fetchMessages, 6000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMessages, markAsRead]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length]);

  // Fetch customer history on lead change
  useEffect(() => {
    if (!leadId) return;
    setHistory(null);
    setExpandedHistoryId(null);
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
    if (mode === "YOU") {
      setPanelOpen(true);
      setPanelTab("details");
    }
  }, [mode]);

  // Transition: if AI suggestion tab is open and user switches back to AI/Bot mode, go to details tab
  useEffect(() => {
    if (mode === "AI" && panelTab === "ai") {
      setPanelTab("details");
    }
  }, [mode, panelTab]);

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
        <p className="text-sm text-rose-500 dark:text-rose-400 font-mono">{networkError}</p>
        <button onClick={fetchMessages} className="mt-4 px-4 py-2 bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] text-xs font-black rounded-xl text-[var(--app-text)] transition cursor-pointer">
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
    const senderLabel = msg.senderName || (isBot ? (company?.telegramBotUsername ? `@${company.telegramBotUsername}` : "Auto-reply") : isAgent ? "Agent" : isClient ? customerDisplayName : "System");

    if (isSystem) {
      return (
        <div key={msg.id} className="flex justify-center py-0.5">
          <div className="px-3 py-1.5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-alt)] text-[11px] text-[var(--app-text-muted)] font-mono max-w-[85%] text-center">
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className={`flex ${isClient ? "justify-start" : "justify-end"} py-1`}>
        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl border ${
          isFailed
            ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
            : isClient
            ? "bg-[var(--app-surface)] border-[var(--app-border)] text-[var(--app-text)]"
            : isBot
            ? "bg-teal-600/90 border-teal-500/70 text-white"
            : "bg-brand-navy border-brand-navy/80 text-white"
        }`}>
          <div className="flex items-center gap-1 mb-0">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{senderLabel}</span>
            {isBot && (
              <span className="text-[9px] font-black text-teal-300/80 border border-teal-400/40 rounded px-1">AI</span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 text-[10px] font-black text-rose-400">
                <AlertTriangle className="h-3 w-3" /> Failed
              </span>
            )}
            {/* Delivery status indicator — outgoing only (BOT/AGENT). CUSTOMER (CLIENT) messages never show a tick. */}
            {!isFailed && !isSystem && (isBot || isAgent) && (
              <span className="text-[9px] font-mono opacity-50 ml-auto">
                {msg.deliveryStatus === "SENT" && (msg.isRead ? "✓✓ Read" : "✓ Sent")}
                {msg.deliveryStatus === "PENDING" && "⏳ Pending"}
              </span>
            )}
          </div>
          <p className="text-sm leading-[1.6] whitespace-pre-wrap break-words mt-1 mb-1 text-[var(--app-text)]">{msg.content}</p>
          {msg.deliveryError && (
            <p className="text-[10px] font-mono text-rose-400/70 mt-0 italic">{msg.deliveryError}</p>
          )}
          <div className="flex items-center justify-between mt-0">
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
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col h-full min-h-0 transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-[var(--app-border)] bg-app-surface">
        {showBackButton && (
          <button onClick={() => navigate("/inbox")} className="p-2 rounded-xl hover:bg-[var(--app-bg-soft)] border border-[var(--app-border)] transition cursor-pointer">
            <ArrowLeft className="h-4 w-4 text-app-text-muted" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-black text-app-text truncate">{customerDisplayName}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {customerPhone && customerPhone !== customerDisplayName && (
              <span className="text-[10px] text-[var(--app-text-muted)] font-mono">{customerPhone}</span>
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
            className="px-2 py-0.5 text-[10px] font-black rounded border border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition cursor-pointer"
          >
            Done
          </button>
        )}
        {/* AI/You Mode Toggle Pill */}
        <div className="flex items-center gap-1">
          <span
            onClick={() => handleModeToggle("AI")}
            className={`text-[10px] font-black px-2.5 py-1 rounded-l-md border cursor-pointer transition ${
              mode === "AI"
                ? "bg-[var(--brand-saffron)] text-[var(--app-bg)] border-[var(--brand-saffron)]"
                : "bg-[var(--app-surface-alt)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-soft)]"
            }`}
          >
            AI
          </span>
          <span
            onClick={() => handleModeToggle("YOU")}
            className={`text-[10px] font-black px-2.5 py-1 rounded-r-md border cursor-pointer transition ${
              mode === "YOU"
                ? "bg-[var(--brand-saffron)] text-[var(--app-bg)] border-[var(--brand-saffron)]"
                : "bg-[var(--app-surface-alt)] text-[var(--app-text-muted)] border-[var(--app-border)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-soft)]"
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
              ? "bg-[var(--app-surface-alt)] border-[var(--app-border-strong)] text-[var(--app-text)]"
              : "bg-[var(--app-surface-alt)] border-[var(--app-border)] text-[var(--app-text-muted)] hover:bg-[var(--app-bg-soft)]"
          }`}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 px-4 gap-1 flex flex-col">
        {detail.messages.length === 0 && (
          <div className="text-center text-xs text-[var(--app-text-muted)] py-8">No messages yet. Say hello!</div>
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
      <div className="p-3 border-t border-[var(--app-border)]">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowProductPicker(true)}
            className="p-2 rounded-xl bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] transition cursor-pointer shrink-0"
            title="Add product"
          >
            <Plus className="h-4 w-4 text-[var(--app-text-muted)]" />
          </button>
          <button
            onClick={() => setShowPaymentRequest(true)}
            className="p-2 rounded-xl bg-[var(--app-surface-alt)] border border-[var(--app-border)] hover:bg-[var(--app-bg-soft)] transition cursor-pointer shrink-0"
            title="Request Payment"
          >
            <CreditCard className="h-4 w-4 text-[var(--app-text-muted)]" />
          </button>
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

      {/* Product Picker Modal */}
      {showProductPicker && (
        <ProductPickerModal
          onClose={() => setShowProductPicker(false)}
          onProductSelected={(message) => {
            setContent(prev => prev ? `${prev}\n${message}` : message);
            setShowProductPicker(false);
          }}
        />
      )}

      {/* Payment Request Modal */}
      {showPaymentRequest && (
        <PaymentRequestModal
          conversationId={detail.conversationId}
          onClose={() => setShowPaymentRequest(false)}
          onPaymentGenerated={(message) => {
            setContent(prev => prev ? `${prev}\n${message}` : message);
            setShowPaymentRequest(false);
          }}
        />
      )}
      </div>

      {panelOpen && leadId && (
        <div className="w-[320px] shrink-0 border-l border-[var(--app-border)] h-full overflow-y-auto bg-app-surface">
          {/* Panel tabs */}
          <div className="flex border-b border-[var(--app-border)]">
            <button
              onClick={() => setPanelTab("details")}
              className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                panelTab === "details"
                  ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] border-b-2 border-brand-saffron"
                  : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              }`}
            >
              Customer Details
            </button>
            <button
              onClick={() => setPanelTab("ai")}
              className={`flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                panelTab === "ai"
                  ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] border-b-2 border-brand-saffron"
                  : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
              }`}
            >
              AI Suggestion
            </button>
          </div>

          {/* Details tab content */}
          {panelTab === "details" && (
            <div className="p-4">
              {history && (
                <div className="space-y-3">
                  {history.totalConversations === 0 ? (
                    <div className="text-[10px] text-[var(--app-text-muted)] font-mono italic">
                      No past conversations
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] text-[var(--app-text-muted)] font-mono">
                        {history.totalConversations} past conversation{history.totalConversations !== 1 ? 's' : ''}
                      </div>
                      <table className="w-full text-[11px] border border-[var(--app-border)] rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-[var(--app-surface-alt)] text-[var(--app-text-muted)] text-left">
                            <th className="px-2 py-1.5 font-bold">Staff</th>
                            <th className="px-2 py-1.5 font-bold">Status</th>
                            <th className="px-2 py-1.5 font-bold text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.conversations.map((c) => {
                            // Guard against raw UUIDs or empty values in staff name fields
                            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                            const rawName = c.claimedByName || c.resolvedBy || null;
                            const displayName = (rawName && uuidRegex.test(rawName.trim()))
                              ? "System"
                              : rawName || "Unassigned Staff";
                            const isOpen = expandedHistoryId === c.id;
                            // Use updatedAt for precise claim/resolution timestamp
                            const actionTime = new Date(c.updatedAt);
                            const formattedTime = actionTime.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                            const timeString = actionTime.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            // createdAt = when this session was started
                            const createdTime = new Date(c.createdAt);
                            const createdDate = createdTime.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                            const createdTimeStr = createdTime.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });

                            return (
                              <Fragment key={c.id}>
                                <tr
                                   className="h-11 border-t border-[var(--app-border)] cursor-pointer hover:bg-[var(--app-bg-soft)] transition-colors"
                                   onClick={() => setExpandedHistoryId(isOpen ? null : c.id)}
                                 >
                                   <td className="px-3 py-2 font-bold text-[var(--app-text)] truncate max-w-[120px]">{displayName}</td>
                                  <td className="px-3 py-2">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                      c.status === "RESOLVED" ? "bg-emerald-500/20 text-emerald-300"
                                      : c.status === "ASSIGNED" ? "bg-amber-500/20 text-amber-300"
                                       : "bg-[var(--app-surface-alt)] text-[var(--app-text-muted)]"
                                    }`}>{c.status}</span>
                                  </td>
                                   <td className="px-3 py-2 text-[var(--app-text-muted)] text-right whitespace-nowrap">{formattedTime}</td>
                                </tr>
                                {isOpen && (
                                   <tr className="border-t border-[var(--app-border)] bg-[var(--app-surface-alt)]">
                                     <td colSpan={3} className="px-3 py-2 text-[10px] text-[var(--app-text-muted)] font-mono space-y-0.5">
                                       <div>Claimed / Updated: <span className="text-[var(--app-text)]">{formattedTime} at {timeString}</span></div>
                                       <div>Conversation started: <span className="text-[var(--app-text)]">{createdDate} at {createdTimeStr}</span></div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Suggestion tab content - only in Human Mode */}
          {panelTab === "ai" && mode === "YOU" && (
            <div className="p-3">
              <AiSuggestionPanel
                leadId={leadId}
                onUseAndEdit={(suggestion) => setContent(suggestion)}
                latestMessageId={detail?.messages[detail.messages.length - 1]?.id}
              />
            </div>
          )}
          {panelTab === "ai" && mode === "AI" && (
            <div className="p-4 text-center">
              <p className="text-[10px] text-[var(--app-text-muted)] font-mono">
                Switch to Human Mode to use AI suggestions
              </p>
            </div>
          )}
        </div>
      )}

      {/* Resolve Confirmation Modal */}
      {showResolveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 max-w-sm w-full mx-4">
            <h3 className="text-sm font-black text-app-text mb-2">Mark conversation as resolved?</h3>
            <p className="text-xs text-[var(--app-text-muted)] mb-4">
              This will mark the conversation as resolved. The customer will be moved to the resolved list.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResolveConfirm(false)}
                className="px-3 py-1.5 text-xs font-black text-[var(--app-text-muted)] border border-[var(--app-border)] rounded hover:bg-[var(--app-bg-soft)] transition cursor-pointer"
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