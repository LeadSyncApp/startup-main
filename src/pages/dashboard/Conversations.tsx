import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../lib/api";
import toast from "react-hot-toast";
import {
  Trash2,
  Search,
  ChevronLeft,
  Send,
  Bot,
  User as UserIcon,
  Check,
  MoreVertical,
  Zap,
  Mic
} from "lucide-react";
import { getIndustryConfig } from "../../utils/industryConfig";

interface Message {
  id: string;
  content: string;
  sender: "CLIENT" | "AGENT" | "SYSTEM";
  messageType?: "TEXT" | "VOICE" | "IMAGE" | "FILE";
  createdAt: string;
  conversationId?: string; // Added for socket routing
}

interface Conversation {
  id: string;
  mode: "BOT" | "HUMAN";
  lead: {
    name: string | null;
    contact: string;
    channel: string;
  };
  lastMessage: string;
  intent?: string;
  updatedAt: string;
}

export default function Conversations() {
  const { token, companyId, company } = useAuth();
  const industry = useMemo(() => getIndustryConfig(company?.botBusinessType), [company]);
  const IndustryIcon = industry.catalogIcon;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConv, setLoadingConv] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);

  // LOCKING STATE
  const [isLocked, setIsLocked] = useState(false);
  const [assignedToAgent, setAssignedToAgent] = useState<{ name: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgCount = useRef(0);
  const { socket } = useSocket();
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Load cache on mount or when companyId changes
  useEffect(() => {
    if (!companyId) return;
    const saved = localStorage.getItem(`leadsync_conv_cache_${companyId}`);
    if (saved) {
      setConversations(JSON.parse(saved));
      setLoadingConv(false);
    } else {
      // If no cache for this company, ensure we don't show old data from state if switching users without full reload
      setConversations([]);
      setLoadingConv(true);
    }
  }, [companyId]);

  /* LOAD LIST */
  const loadConversations = async (quiet = false) => {
    try {
      if (!quiet) setLoadingConv(true);
      const data = await api.get("/conversations"); // First page

      // Only update if data changed to prevent jitter
      setConversations(prev => {
        if (JSON.stringify(prev) === JSON.stringify(data.items)) return prev;
        if (companyId) {
          localStorage.setItem(`leadsync_conv_cache_${companyId}`, JSON.stringify(data.items));
        }
        return data.items;
      });
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to load list", err);
    } finally {
      setLoadingConv(false);
    }
  };

  const loadMoreConversations = async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const data = await api.get(`/conversations?cursor=${nextCursor}`);

      setConversations(prev => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to load more", err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (token && companyId) loadConversations();
  }, [token, companyId]);

  const [activeOrder, setActiveOrder] = useState<any>(null); // State for Ghost Order

  /* FETCH MESSAGES */
  const fetchMessages = async (conv: Conversation) => {
    try {
      const data = await api.get(`/conversations/${conv.id}/messages`);
      const newMsgs = data.messages;
      setMessages((prev) => {
        if (prev.length !== newMsgs.length || (prev.length > 0 && prev[prev.length - 1].id !== newMsgs[newMsgs.length - 1].id)) {
          return newMsgs;
        }
        return prev;
      });
      setSelected(prev => prev?.id === conv.id ? { ...prev, mode: data.mode } : prev);
      setIsLocked(!!data.isLocked);
      setAssignedToAgent(data.assignedTo);
      // Set Active Order
      setActiveOrder(data.order);
    } catch (err) {
      console.error("Failed message fetch", err);
    }
  };

  /* REAL-TIME SOCKET LISTENERS */
  useEffect(() => {
    if (!socket) return;
    const onNewMessage = (msg: Message) => {
      if (selectedRef.current && msg.conversationId === selectedRef.current.id) {
        setMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith("temp-") || m.content !== msg.content);
          if (filtered.some(m => m.id === msg.id)) return prev;
          return [...filtered, msg];
        });
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
        }, 50);
      }
    };
    const onModeChanged = (data: { conversationId: string; mode: "BOT" | "HUMAN" }) => {
      setConversations(prev => prev.map(c => c.id === data.conversationId ? { ...c, mode: data.mode } : c));
      if (selectedRef.current?.id === data.conversationId) setSelected(prev => prev ? { ...prev, mode: data.mode } : null);
    };
    const onConversationUpdated = (data: { conversationId: string; lastMessage: string; updatedAt: string; intent?: string }) => {
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === data.conversationId);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastMessage: data.lastMessage,
          updatedAt: data.updatedAt,
          intent: data.intent !== undefined ? data.intent : updated[index].intent
        };
        const item = updated.splice(index, 1)[0];
        updated.unshift(item);
        return updated;
      });
    };
    const onConversationAssigned = (data: { conversationId: string }) => {
      if (selectedRef.current?.id === data.conversationId) fetchMessages(selectedRef.current);
    };

    // 🆕 LISTEN FOR GHOST ORDERS
    const onOrderDetected = (order: any) => {
      if (selectedRef.current?.id === order.conversationId) {
        setActiveOrder(order);
        toast("New Order Request Detected!", { icon: "🍔" });
      }
    };
    const onOrderUpdated = (order: any) => {
      if (selectedRef.current?.id === order.conversationId) {
        setActiveOrder(order);
      }
    };

    socket.on("new_message", onNewMessage);
    socket.on("mode_changed", onModeChanged);
    socket.on("conversation_updated", onConversationUpdated);
    socket.on("conversation_assigned", onConversationAssigned);
    socket.on("order_detected", onOrderDetected); // 🆕
    socket.on("order_updated", onOrderUpdated);   // 🆕

    if (selected) socket.emit("join_conversation", selected.id);
    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("mode_changed", onModeChanged);
      socket.off("conversation_updated", onConversationUpdated);
      socket.off("conversation_assigned", onConversationAssigned);
      socket.off("order_detected", onOrderDetected);
      socket.off("order_updated", onOrderUpdated);
    };
  }, [socket, selected?.id]);

  /* ACTIONS */
  const handleAcceptOrder = async () => {
    if (!activeOrder) return;
    const oldStatus = activeOrder.status;
    // Optimistic
    setActiveOrder({ ...activeOrder, status: "PROCESSING" });

    try {
      await api.post(`/orders/${activeOrder.id}/approve`, { version: activeOrder.version });
      toast.success("Order Accepted & Moved to Processing");
    } catch (err: any) {
      setActiveOrder({ ...activeOrder, status: oldStatus });
      toast.error(err.response?.data?.message || "Failed to accept");
    }
  };

  const handleRejectOrder = async () => {
    if (!activeOrder) return;
    if (!window.confirm("Reject this order?")) return;
    const oldStatus = activeOrder.status;
    setActiveOrder({ ...activeOrder, status: "REJECTED" }); // Optimistic

    try {
      await api.post(`/orders/${activeOrder.id}/reject`, { version: activeOrder.version });
      toast.success("Order Rejected");
    } catch (err: any) {
      setActiveOrder({ ...activeOrder, status: oldStatus });
      toast.error("Failed to reject");
    }
  };

  /* SELECT HANDLER */
  const handleSelect = (conv: Conversation) => {
    setSelected(conv);
    setMessages([]); // Clear to avoid showing wrong chat
    setShowMobileList(false);
    fetchMessages(conv);
  };

  /* SMART AUTO SCROLL */
  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
      });
    }
  };

  useEffect(() => {
    // Scroll handling on messages update:
    // Only scroll if we have new messages (appended) or if it's the first load
    if (!scrollRef.current || messages.length === 0) return;

    scrollToBottom(messages.length > lastMsgCount.current);
    lastMsgCount.current = messages.length;
  }, [messages]);

  /* SEND MESSAGE */
  const sendMessage = async () => {
    if (!newMessage.trim() || !selected) return;

    const content = newMessage;
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content,
      sender: "AGENT",
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);
    setNewMessage("");

    try {
      await api.post(`/conversations/${selected.id}/send`, { content });
      fetchMessages(selected);
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      toast.error("Network error");
    }
  };

  /* TOGGLE MODE */
  const toggleMode = async (mode: "BOT" | "HUMAN") => {
    if (!selected) return;
    const prevMode = selected.mode;

    // OPTIMISTIC UPDATE
    const optimisticUpdated = { ...selected, mode };
    setSelected(optimisticUpdated);
    setConversations(prev => prev.map(c =>
      c.id === selected.id ? { ...c, mode } : c
    ));

    try {
      await api.patch(`/conversations/${selected.id}/mode`, { mode });
      toast.success(`Switched to ${mode} mode`);
    } catch (err) {
      // REVERT ON FAILURE
      setSelected({ ...selected, mode: prevMode });
      setConversations(prev => prev.map(c =>
        c.id === selected.id ? { ...c, mode: prevMode } : c
      ));
      toast.error("Mode switch failed");
    }
  };

  /* CLEAR HISTORY */
  const clearHistory = async () => {
    if (!selected) return;
    if (!window.confirm("Clear all messages? This action cannot be reversed.")) return;

    try {
      await api.delete(`/conversations/${selected.id}/messages`);
      toast.success("Messages cleared");
      setMessages([]);
      fetchMessages(selected);
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  /* VOICE REPLY */
  const handleVoiceReply = async (messageId: string, conversationId: string) => {
    const toastId = toast.loading("Sending voice reply...");
    try {
      await api.post(`/conversations/${conversationId}/voice-reply`, { messageId });
      toast.success("Voice reply sent!", { id: toastId });
    } catch (err) {
      toast.error("Voice reply failed. Try again.", { id: toastId });
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter(c =>
      c.lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lead.contact.includes(searchQuery)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="flex bg-white rounded-3xl overflow-hidden shadow-2xl h-[calc(100vh-160px)] min-h-[500px]">
      {/* ... (Left Panel unchanged) ... */}
      <div className={`
        ${showMobileList ? "flex" : "hidden"}
        lg:flex flex-col w-full lg:w-[400px] border-r border-slate-100 bg-slate-50/50
      `}>
        {/* ... (Left Panel content: Header, Search, List) ... */}
        <div className="p-6 bg-white border-b border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Messages
              <span className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" />
            </h1>
            <button className="p-2 hover:bg-slate-100 rounded-xl transition">
              <MoreVertical size={20} className="text-slate-400" />
            </button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors h-4 w-4" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingConv && conversations.length === 0 ? (
            <div className="p-6 space-y-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="h-14 w-14 rounded-2xl bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <AnimatePresence>
              {filteredConversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => handleSelect(conv)}
                  className={`
                    p-6 cursor-pointer transition-all relative group flex gap-4
                    ${selected?.id === conv.id ? "bg-white shadow-lg shadow-indigo-500/5 z-10" : "hover:bg-indigo-50/50"}
                  `}
                >
                  <div className="relative shrink-0">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm
                        ${conv.mode === "BOT" ? "bg-indigo-100 text-indigo-600" : "bg-rose-100 text-rose-600"}`}>
                      {(conv.lead.name || conv.lead.contact).charAt(0).toUpperCase()}
                    </div>
                    {/* Status Dot */}
                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white shadow-sm
                        ${conv.mode === "BOT" ? "bg-indigo-500" : "bg-rose-500"}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-bold text-slate-900 truncate">
                        {conv.lead.name || conv.lead.contact}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate font-medium">
                      {conv.lastMessage || "Started a conversation"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded border border-slate-200 text-slate-400">
                        {conv.lead.channel}
                      </span>
                      {conv.intent && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500 uppercase tracking-tighter">
                          {conv.intent.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {nextCursor && !loadingConv && (
            <div className="p-4 flex justify-center">
              <button onClick={loadMoreConversations} disabled={loadingMore} className="text-xs font-bold text-slate-400 hover:text-indigo-500 uppercase tracking-widest disabled:opacity-50">
                {loadingMore ? "Loading..." : "Load Older Chats"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`
        ${!showMobileList ? "flex" : "hidden"}
        lg:flex flex-1 flex-col bg-slate-50 relative
      `}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className={`h-24 w-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 relative text-${industry.colors.primary}`}>
              <IndustryIcon className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Select a Conversation</h2>
            <p className="text-slate-500 mt-2 max-w-xs leading-relaxed">
              Active Inbox. Manage your orders and customers here.
            </p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="px-8 py-4 bg-white border-b border-slate-100 flex items-center justify-between z-10 shadow-sm">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowMobileList(true)} className="lg:hidden p-3 bg-slate-100 rounded-2xl text-slate-600">
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
                    {(selected.lead.name || "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-900 leading-none mb-1">{selected.lead.name || "Customer"}</h2>
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{selected.lead.contact}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Mode Toggles ... */}
                <div className={`hidden md:flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                  <button onClick={() => toggleMode("BOT")} disabled={isLocked} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${selected.mode === "BOT" ? "bg-white text-indigo-600 shadow-xl" : "text-slate-500"}`}>
                    <Bot size={12} /> BOT
                  </button>
                  <button onClick={() => toggleMode("HUMAN")} disabled={isLocked} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest ${selected.mode === "HUMAN" ? "bg-white text-rose-600 shadow-xl" : "text-slate-500"}`}>
                    <UserIcon size={12} /> HUMAN
                  </button>
                </div>
                <div className="w-px h-8 bg-slate-100 mx-2 hidden md:block" />
                <button onClick={clearHistory} disabled={isLocked} className={`p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition active:scale-90 ${isLocked ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* 🆕 ORDER PREVIEW CARD (Sticky Top) */}
            <AnimatePresence>
              {activeOrder && activeOrder.status === 'BOT_CREATED_ORDER' && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="bg-indigo-50/80 backdrop-blur-md border-b border-indigo-100 p-4 px-8 flex flex-col md:flex-row items-center justify-between gap-4 z-20"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-2xl">
                      🍔
                    </div>
                    <div>
                      <h4 className="font-extrabold text-indigo-900 text-sm">New Order Request</h4>
                      <p className="text-indigo-700 text-xs font-semibold">{activeOrder.summary} — <span className="font-black">₹{activeOrder.amount}</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={handleRejectOrder} className="flex-1 md:flex-none py-2 px-4 rounded-xl text-xs font-bold bg-white text-rose-600 hover:bg-rose-50 border border-slate-200 transition">
                      REJECT
                    </button>
                    <button onClick={handleAcceptOrder} disabled={isLocked} className="flex-1 md:flex-none py-2 px-6 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition active:scale-95 disabled:opacity-50">
                      ACCEPT & PROCESS
                    </button>
                  </div>
                </motion.div>
              )}
              {/* SHOW PROCESSING STATE */}
              {activeOrder && activeOrder.status === 'PROCESSING' && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-emerald-50/80 backdrop-blur-md border-b border-emerald-100 p-3 px-8 flex items-center justify-center gap-2 z-20"
                >
                  <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                  <p className="text-emerald-700 text-xs font-bold uppercase tracking-wide">Order Accepted & Processing</p>
                </motion.div>
              )}
            </AnimatePresence>


            {/* MESSAGE LIST */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/30">
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-50">
                    <div className="p-6 bg-slate-100 rounded-full mb-4"><Zap size={32} /></div>
                    <p className="text-sm font-bold uppercase tracking-widest">No history found</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAgent = msg.sender === "AGENT";
                    const isSystem = msg.sender === "SYSTEM";
                    const isClient = msg.sender === "CLIENT";
                    const isVoiceOrMedia = isClient && (
                      msg.messageType === "VOICE" ||
                      msg.messageType === "IMAGE" ||
                      msg.messageType === "FILE"
                    );

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="bg-slate-200/50 text-slate-500 text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border border-slate-200 text-center max-w-[80%]">
                            {msg.content}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                      >
                        <div className="flex flex-col max-w-[80%]">
                          <div className={`px-5 py-3.5 rounded-[2rem] text-sm leading-relaxed font-medium shadow-sm transition-all ${isAgent
                            ? "bg-indigo-600 text-white rounded-br-none"
                            : "bg-white text-slate-800 rounded-bl-none border border-slate-100"
                            }`}>
                            {/* Voice badge for voice messages */}
                            {msg.messageType === "VOICE" && isClient && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1.5 bg-indigo-50 px-2 py-0.5 rounded-full">
                                <Mic size={8} /> Voice
                              </span>
                            )}
                            <span className="block">{msg.content}</span>
                          </div>
                          <div className={`flex items-center gap-2 mt-2 ${isAgent ? "justify-end" : "justify-start"
                            }`}>
                            <span className={`text-[10px] font-bold uppercase tracking-tighter ${isAgent ? "text-indigo-400" : "text-slate-400"
                              }`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isAgent && <Check size={10} className="text-indigo-400" />}
                            {/* Voice Reply button — only for voice/media client messages */}
                            {isVoiceOrMedia && selected && (
                              <button
                                onClick={() => handleVoiceReply(msg.id, selected.id)}
                                className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-full transition-all"
                              >
                                <Mic size={9} /> Voice Reply
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* CHAT INPUT AREA */}
            {isLocked ? (
              <div className="p-8 bg-slate-50 border-t border-slate-200 text-center">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-xl flex items-center justify-center gap-3 shadow-sm">
                  <div className="bg-amber-100 p-2 rounded-full"><span className="font-bold text-xs">🔒</span></div>
                  <div className="text-left">
                    <p className="font-black text-sm uppercase tracking-wide">Locked by {assignedToAgent?.name || "another agent"}</p>
                    <p className="text-xs opacity-70">You can view but cannot reply.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-white border-t border-slate-100">
                <div className="flex items-center gap-3 bg-slate-100/50 p-2.5 rounded-[2.5rem] border border-slate-200/60 shadow-inner focus-within:border-indigo-500/50 focus-within:bg-white transition-all">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    rows={1}
                    placeholder="ASSIST CUSTOMER..."
                    className="flex-1 bg-transparent border-none resize-none py-3 px-6 text-sm focus:ring-0 max-h-32 custom-scrollbar font-bold text-slate-700 uppercase tracking-wide placeholder:opacity-50"
                  />
                  <button onClick={sendMessage} disabled={!newMessage.trim()} className={`h-12 w-12 flex items-center justify-center rounded-full transition-all shadow-xl ${newMessage.trim() ? "bg-indigo-600 text-white scale-100 hover:bg-indigo-700 hover:rotate-12" : "bg-slate-200 text-slate-400 scale-90 cursor-not-allowed"}`}>
                    <Send size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; } textarea::placeholder { letter-spacing: 0.1em; }`}</style>
    </div>
  );
}
