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
  Zap
} from "lucide-react";

interface Message {
  id: string;
  content: string;
  sender: "CLIENT" | "AGENT" | "SYSTEM";
  createdAt: string;
  conversationId?: string; // Added for socket routing
}

interface Conversation {
  id: string;
  mode: "BOT" | "HUMAN";
  updatedAt: string;
  lead: {
    name: string | null;
    contact: string;
    channel: string;
  };
  lastMessage: string;
}

export default function Conversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingConv, setLoadingConv] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<any>(null);
  const lastMsgCount = useRef(0);
  const { socket } = useSocket();
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Load cache on mount
  useEffect(() => {
    const saved = localStorage.getItem("leadsync_conv_cache");
    if (saved) {
      setConversations(JSON.parse(saved));
      setLoadingConv(false);
    }
  }, []);

  /* LOAD LIST */
  const loadConversations = async (quiet = false) => {
    try {
      if (!quiet) setLoadingConv(true);
      const data = await api.get("/conversations");
      setConversations(data);
      localStorage.setItem("leadsync_conv_cache", JSON.stringify(data));
    } catch (err) {
      console.error("Failed to load list", err);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    if (token) loadConversations();
  }, [token]);

  /* FETCH MESSAGES */
  const fetchMessages = async (conv: Conversation) => {
    try {
      const data = await api.get(`/conversations/${conv.id}/messages`);

      // Deep comparison to prevent jitter
      const newMsgs = data.messages;
      setMessages((prev) => {
        if (prev.length !== newMsgs.length || (prev.length > 0 && prev[prev.length - 1].id !== newMsgs[newMsgs.length - 1].id)) {
          return newMsgs;
        }
        return prev;
      });

      // Sync selected mode
      setSelected(prev => prev?.id === conv.id ? { ...prev, mode: data.mode } : prev);
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
          const exists = prev.some(m => m.id === msg.id);
          if (exists) return prev;
          return [...prev.filter(m => !m.id.startsWith("temp-")), msg];
        });
      }
    };

    const onModeChanged = (data: { conversationId: string; mode: "BOT" | "HUMAN" }) => {
      setConversations(prev => prev.map(c =>
        c.id === data.conversationId ? { ...c, mode: data.mode } : c
      ));
      if (selectedRef.current?.id === data.conversationId) {
        setSelected(prev => prev ? { ...prev, mode: data.mode } : null);
      }
    };

    const onConversationUpdated = (data: { conversationId: string; lastMessage: string; updatedAt: string }) => {
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === data.conversationId);
        if (index === -1) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], lastMessage: data.lastMessage, updatedAt: data.updatedAt };
        const item = updated.splice(index, 1)[0];
        updated.unshift(item);
        return updated;
      });
    };

    socket.on("new_message", onNewMessage);
    socket.on("mode_changed", onModeChanged);
    socket.on("conversation_updated", onConversationUpdated);

    if (selected) {
      socket.emit("join_conversation", selected.id);
    }

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("mode_changed", onModeChanged);
      socket.off("conversation_updated", onConversationUpdated);
    };
  }, [socket, selected?.id]);

  /* FALLBACK POLLING (SLOW) */
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        await loadConversations(true);
      }
      pollTimerRef.current = setTimeout(poll, 15000);
    };
    pollTimerRef.current = setTimeout(poll, 15000);
    return () => clearTimeout(pollTimerRef.current);
  }, [token]);

  /* SELECT HANDLER */
  const handleSelect = (conv: Conversation) => {
    setSelected(conv);
    setShowMobileList(false);
    fetchMessages(conv);
  };

  /* AUTO SCROLL (STABLE & SMART) */
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const isNewMessage = messages.length > lastMsgCount.current;

      // If messages length changed significantly (like history clear), or if it's a small increment
      if (isNewMessage || messages.length === 0) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: isNewMessage && lastMsgCount.current > 0 ? "smooth" : "auto"
        });
      }
      lastMsgCount.current = messages.length;
    }
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
    setSelected({ ...selected, mode });

    try {
      await api.patch(`/conversations/${selected.id}/mode`, { mode });
      // Fetch messages immediately to show the "Chat mode switched" notification instantly
      fetchMessages(selected);
      toast.success(`Switched to ${mode} mode`);
    } catch (err) {
      setSelected({ ...selected, mode: prevMode });
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

  const filteredConversations = useMemo(() => {
    return conversations.filter(c =>
      c.lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lead.contact.includes(searchQuery)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="flex bg-white rounded-3xl overflow-hidden shadow-2xl h-[calc(100vh-160px)] min-h-[500px]">

      {/* LEFT: CONVERSATION LIST */}
      <div className={`
        ${showMobileList ? "flex" : "hidden"}
        lg:flex flex-col w-full lg:w-[400px] border-r border-slate-100 bg-slate-50/50
      `}>
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
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* RIGHT: CHAT WINDOW */}
      <div className={`
        ${!showMobileList ? "flex" : "hidden"}
        lg:flex flex-1 flex-col bg-slate-50 relative
      `}>
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="h-24 w-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 relative">
              <Zap className="h-10 w-10 text-indigo-500" />
              <div className="absolute -top-2 -right-2 h-6 w-6 bg-indigo-500 rounded-full border-4 border-white" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Select a Conversation</h2>
            <p className="text-slate-500 mt-2 max-w-xs leading-relaxed">
              Your real-time inbox is active. Select a customer to start assisting or manage bot automation.
            </p>
          </div>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div className="px-8 py-4 bg-white border-b border-slate-100 flex items-center justify-between z-10 shadow-sm">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowMobileList(true)}
                  className="lg:hidden p-3 bg-slate-100 rounded-2xl text-slate-600 active:scale-95 transition"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-bold">
                    {(selected.lead.name || "C").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-slate-900 leading-none mb-1">
                      {selected.lead.name || "Customer"}
                    </h2>
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{selected.lead.contact}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden md:flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => toggleMode("BOT")}
                    className={`
                      flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest
                      ${selected.mode === "BOT" ? "bg-white text-indigo-600 shadow-xl shadow-indigo-200/50" : "text-slate-500 hover:text-slate-900"}
                    `}
                  >
                    <Bot size={12} />
                    BOT
                  </button>
                  <button
                    onClick={() => toggleMode("HUMAN")}
                    className={`
                      flex items-center gap-2 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-widest
                      ${selected.mode === "HUMAN" ? "bg-white text-rose-600 shadow-xl shadow-rose-200/50" : "text-slate-500 hover:text-slate-900"}
                    `}
                  >
                    <UserIcon size={12} />
                    HUMAN
                  </button>
                </div>

                <div className="w-px h-8 bg-slate-100 mx-2 hidden md:block" />

                <button
                  onClick={clearHistory}
                  className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition active:scale-90"
                  title="Clear history"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {/* MESSAGE LIST */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/30"
            >
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 opacity-50">
                    <div className="p-6 bg-slate-100 rounded-full mb-4">
                      <Zap size={32} />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">No history found</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAgent = msg.sender === "AGENT";
                    const isSystem = msg.sender === "SYSTEM";

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
                          <div className={`
                        px-5 py-3.5 rounded-[2rem] text-sm leading-relaxed font-medium shadow-sm transition-all
                        ${isAgent
                              ? "bg-indigo-600 text-white rounded-br-none"
                              : "bg-white text-slate-800 rounded-bl-none border border-slate-100"}
                      `}>
                            {msg.content}
                          </div>
                          <div className={`
                        flex items-center gap-1.5 mt-2 text-[10px] font-bold uppercase tracking-tighter
                        ${isAgent ? "justify-end text-indigo-400" : "text-slate-400"}
                      `}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {isAgent && <Check size={10} />}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* CHAT INPUT AREA */}
            <div className="p-8 bg-white border-t border-slate-100">
              <div className="flex items-center gap-3 bg-slate-100/50 p-2.5 rounded-[2.5rem] border border-slate-200/60 shadow-inner focus-within:border-indigo-500/50 focus-within:bg-white transition-all">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder="ASSIST CUSTOMER..."
                  className="flex-1 bg-transparent border-none resize-none py-3 px-6 text-sm focus:ring-0 max-h-32 custom-scrollbar font-bold text-slate-700 uppercase tracking-wide placeholder:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className={`
                    h-12 w-12 flex items-center justify-center rounded-full transition-all shadow-xl
                    ${newMessage.trim()
                      ? "bg-indigo-600 text-white scale-100 hover:bg-indigo-700 hover:rotate-12"
                      : "bg-slate-200 text-slate-400 scale-90 cursor-not-allowed"}
                  `}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        textarea::placeholder {
           letter-spacing: 0.1em;
        }
      `}</style>
    </div>
  );
}
