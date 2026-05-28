import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { SavedRepliesPopup } from '../../components/conversations/SavedReplies';
import { useAuth } from '../../context/AuthContext';
import { TagChips, TagButton } from '../../components/conversations/ConversationTags';
import { NotesPanel } from '../../components/conversations/NotesPanel';

// --- Types ---

interface Conversation {
  id: string;
  mode: 'BOT' | 'HUMAN';
  lead: {
    id: string;
    name: string | null;
    contact: string;
    channel: string;
  };
  lastMessage: string;
  intent?: string;
  updatedAt: string;
  assignedTo?: { id: string; name: string } | null;
  unreadCount?: number;
}

interface Message {
  id: string;
  content: string;
  sender: 'CLIENT' | 'AGENT' | 'SYSTEM';
  createdAt: string;
}

// --- Dynamic Color and Letter generator logic for visual cards ---

const getInitialsColor = (name: string) => {
  const colors = [
    'from-blue-600 to-sky-500',
    'from-blue-500 to-indigo-600',
    'from-teal-500 to-cyan-600',
    'from-blue-700 to-blue-500',
    'from-emerald-500 to-teal-600',
    'from-cyan-500 to-blue-600'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx];
};

const getInitials = (name?: string | null, contact?: string) => {
  const val = name || contact || '?';
  return val.trim().charAt(0).toUpperCase();
};

// --- Format helpers ---

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// --- System log detection helper ---

const isSystemLog = (content: string): boolean => {
  const text = content.toLowerCase();
  return (
    text.includes('switched mode') ||
    text.includes('operator updated') ||
    text.includes('claimed conversation') ||
    text.includes('conversation finalized') ||
    text.includes('assigned to') ||
    text.includes('switched operator') ||
    text.includes('status for') ||
    text.includes('assigned conversation') ||
    text.includes('mode updated') ||
    text.includes('has claimed') ||
    text.includes('resolved')
  );
};

// --- Smaller sub-components ---

const IconButton = ({ icon, onClick, title }: { icon: string; onClick?: () => void; title?: string }) => (
  <button 
    onClick={onClick}
    title={title}
    className="p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
  </button>
);

const ActionCircle = ({ icon, onClick }: { icon: string; onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="w-10 h-10 flex items-center justify-center bg-app-surface border border-app rounded-full text-app-muted shadow-sm hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all active:scale-90"
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
  </button>
);

const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: string }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">{title}</h4>
      {action && <button className="text-blue-600 font-bold text-xs hover:underline transition-all">{action}</button>}
    </div>
    {children}
  </div>
);

const InfoItem = ({ icon, text }: { icon: string; text: string }) => (
  <div className="flex items-center gap-3 group cursor-pointer">
    <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500 transition-colors text-[18px]">{icon}</span>
    <span className="text-xs text-slate-700 font-medium truncate group-hover:text-app-text transition-colors">{text}</span>
  </div>
);

// --- Intelligence Section (Right Side context card) ---

const ContactIntelligence = ({ activeLead, selectedConv, onClose }: { activeLead: any; selectedConv: any; onClose: () => void }) => {
  if (!selectedConv) return null;

  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');

  const leadName = activeLead?.name || selectedConv?.lead?.name || 'Customer';
  const leadContact = activeLead?.contact || selectedConv?.lead?.contact || '';
  const leadChannel = activeLead?.channel || selectedConv?.lead?.channel || 'Telegram';
  const leadInitials = getInitials(leadName, leadContact);
  const initialsColor = getInitialsColor(leadName);

  return (
    <aside className="w-[300px] bg-app-surface border-l border-app shadow-xl md:shadow-none flex flex-col shrink-0 absolute md:relative right-0 top-0 bottom-0 h-full z-20">
      <div className="absolute top-4 right-4 z-10">
        <button 
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-app-muted hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center border border-app bg-app-surface"
          title="Close profile"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="p-8 flex flex-col items-center text-center border-b border-app bg-app-bg/30 shrink-0">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black shadow-lg mb-4 bg-gradient-to-br ${initialsColor}`}>
          {leadInitials}
        </div>
        <h3 className="text-lg font-extrabold text-app-text leading-tight">{leadName}</h3>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {activeLead?.segment || 'Regular Lead'} • <span className="text-blue-600 font-semibold">{leadChannel}</span>
        </p>
        
        <div className="flex gap-2.5 mt-5">
          <ActionCircle icon="mail" onClick={() => window.open(`mailto:${activeLead?.email || ''}`)} />
          <ActionCircle icon="call" onClick={() => window.open(`tel:${leadContact}`)} />
        </div>
      </div>

      {/* Tab bar switch */}
      <div className="flex border-b border-app bg-app-bg/50 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'details'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">info</span>
          <span>Lead Profile</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-3 text-center text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 ${
            activeTab === 'notes'
              ? 'border-blue-600 text-blue-600 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">sticky_note</span>
          <span>Internal Notes</span>
        </button>
      </div>

      {activeTab === 'details' ? (
        <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          <Section title="Contact Details">
            <div className="space-y-3.5">
              <InfoItem icon="call" text={leadContact || "No number synchronized"} />
              <InfoItem icon="mail" text={activeLead?.email || "No email synchronized"} />
              <InfoItem icon="database" text={`ID: ${activeLead?.id || selectedConv?.lead?.id || selectedConv?.id || ''}`} />
            </div>
          </Section>

          {activeLead?.segment && (
            <Section title="Segmentation">
              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  activeLead.segment === "VIP" ? "bg-amber-50 text-amber-700 border-amber-100" :
                  activeLead.segment === "CHURN_RISK" ? "bg-red-50 text-red-700 border-red-100" :
                  "bg-blue-50 text-blue-700 border-blue-100"
                }`}>
                  {activeLead.segment} SEGMENT
                </span>
                {activeLead.priority && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    activeLead.priority === "URGENT" ? "bg-rose-50 text-rose-700 border-rose-100" :
                    activeLead.priority === "HIGH" ? "bg-orange-50 text-orange-700 border-orange-100" :
                    "bg-app-bg text-app-muted border-app"
                  }`}>
                    Priority: {activeLead.priority}
                  </span>
                )}
              </div>
            </Section>
          )}

          <Section title="Intelligence Metrics">
            <div className="space-y-1">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500">AI Score</span>
                <span className="text-xs text-app-text font-bold">{activeLead?.aiScore ?? 75} / 100</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500">Transaction Count</span>
                <span className="text-xs text-app-text font-bold">{activeLead?.orderCount ?? 0} orders</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-xs text-slate-500">Value (CRM)</span>
                <span className="text-xs text-app-text font-bold">₹{(activeLead?.totalSpend ?? 0).toLocaleString()}</span>
              </div>
              {activeLead?.suggestedAction && (
                <div className="flex justify-between py-2">
                  <span className="text-xs text-slate-500">Suggested Action</span>
                  <span className="text-xs text-blue-600 font-bold">{activeLead.suggestedAction}</span>
                </div>
              )}
            </div>
          </Section>

          {activeLead?.lastActiveAt && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
              <h4 className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-2">Last Customer Activity</h4>
              <div className="flex gap-3">
                <div className="w-1 bg-blue-600 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>
                <div>
                  <p className="text-xs text-slate-800 font-semibold leading-relaxed truncate max-w-[180px]">
                    {activeLead.lastMessage || "Logged interaction"}
                  </p>
                  <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                    {formatRelative(activeLead.lastActiveAt)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden h-full">
          <NotesPanel conversationId={selectedConv.id} />
        </div>
      )}
    </aside>
  );
};

// --- Core Conversation Hub Root Component ---

const ConversationHub = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();

  // Root States
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'ai' | 'human'>('all');
  const [allSubFilter, setAllSubFilter] = useState<'channel' | 'manual'>('channel');
  const [loadingList, setLoadingList] = useState(true);

  // Discussion Details
  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [currentConvMode, setCurrentConvMode] = useState<'BOT' | 'HUMAN'>('BOT');
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  // Stream separation / alignment toggle states
  const [messageFilter, setMessageFilter] = useState<'all' | 'bot' | 'agent'>('all');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [trackSidebarExpanded, setTrackSidebarExpanded] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  // Composer States
  const [newMessage, setNewMessage] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showRepliesPopup, setShowRepliesPopup] = useState(false);
  const [replyQuery, setReplyQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch Directory List
  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setLoadingList(true);
      const res = await api.get('/conversations');
      if (res && Array.isArray(res.items)) {
        setConversations(res.items);
        if (res.items.length === 0) {
          setSelectedId(null);
        }
        
        // Auto-select first item ONLY on desktop/medium viewports (>= 768px)
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        if (res.items.length > 0 && !selectedId && isDesktop) {
          setSelectedId(res.items[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch inbox list details", e);
    } finally {
      if (!silent) setLoadingList(false);
    }
  };

  // Fetch Leads for detailed metadata integration
  const fetchLeads = async () => {
    try {
      const res = await api.get('/leads');
      if (res && Array.isArray(res)) {
        setLeads(res);
      }
    } catch (e) {
      console.error("Failed to fetch leads reference context", e);
    }
  };

  // Fetch Chat Message logs for high-fidelity chat threads
  const fetchConversationDetail = async (id: string, silent = false) => {
    try {
      if (!silent) setLoadingChat(true);
      const res = await api.get(`/conversations/${id}/messages`);
      if (res) {
        setMessages(res.messages || []);
        setIsLocked(!!res.isLocked);
        setCurrentConvMode(res.mode || 'BOT');
        setActiveOrder(res.order || null);
      }
    } catch (e) {
      console.error("Failed to fetch messages for conv:", id, e);
    } finally {
      if (!silent) setLoadingChat(false);
    }
  };

  // Setup mount listings
  useEffect(() => {
    fetchConversations();
    fetchLeads();
  }, []);

  // Sync selection changes and join/leave server socket channels
  useEffect(() => {
    setShowProfile(false);
    if (selectedId) {
      fetchConversationDetail(selectedId);
      if (socket) {
        socket.emit("join_conversation", selectedId);
      }
    }
    return () => {
      if (selectedId && socket) {
        socket.emit("leave_conversation", selectedId);
      }
    };
  }, [selectedId, socket]);

  // Real-Time Socket binding listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message & { conversationId?: string }) => {
      if (msg && msg.conversationId === selectedId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      
      // Update list status preview
      setConversations(prev => prev.map(c => {
        if (c.id === msg.conversationId) {
          return {
            ...c,
            lastMessage: msg.content,
            updatedAt: msg.createdAt || new Date().toISOString()
          };
        }
        return c;
      }));
    };

    const handleStatusChanged = (data: any) => {
      if (data && data.conversationId === selectedId) {
        if (data.mode) setCurrentConvMode(data.mode);
      }
      setConversations(prev => prev.map(c => {
        if (c.id === data.conversationId) {
          return { ...c, mode: data.mode || c.mode };
        }
        return c;
      }));
    };

    const handleConvUpdated = () => {
      fetchConversations(true);
      fetchLeads();
      if (selectedId) {
        fetchConversationDetail(selectedId, true);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("status_changed", handleStatusChanged);
    socket.on("conversation_updated", handleConvUpdated);
    socket.on("conversation_added", handleConvUpdated);
    socket.on("conversation_removed", handleConvUpdated);
    socket.on("order_updated", handleConvUpdated);
    socket.on("order_created", handleConvUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("status_changed", handleStatusChanged);
      socket.off("conversation_updated", handleConvUpdated);
      socket.off("conversation_added", handleConvUpdated);
      socket.off("conversation_removed", handleConvUpdated);
      socket.off("order_updated", handleConvUpdated);
      socket.off("order_created", handleConvUpdated);
    };
  }, [socket, selectedId]);

  // Fast background polling interval
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true);
      fetchLeads();
      if (selectedId) {
        fetchConversationDetail(selectedId, true);
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // View auto scroll to end
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loadingChat]);

  // Derived selected conversation attributes
  const selectedConv = useMemo(() => 
    conversations.find(c => c.id === selectedId) || null
  , [conversations, selectedId]);

  // Match corresponding rich lead item details
  const activeLead = useMemo(() => {
    if (!selectedConv) return null;
    return leads.find(l => l.conversationId === selectedId) || null;
  }, [leads, selectedId, selectedConv]);

  // Filter conversations representation
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      if (listFilter === 'all') {
        const isOffline = c.lead?.channel?.toUpperCase() === 'WEBSITE';
        if (allSubFilter === 'channel' && isOffline) {
          return false;
        }
        if (allSubFilter === 'manual' && !isOffline) {
          return false;
        }
      } else if (listFilter === 'unread') {
        const unread = c.unreadCount && c.unreadCount > 0;
        if (!unread) return false;
      } else if (listFilter === 'ai') {
        if (c.mode !== 'BOT') return false;
      } else if (listFilter === 'human') {
        if (c.mode !== 'HUMAN') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const n = (c.lead?.name || '').toLowerCase();
        const contact = (c.lead?.contact || '').toLowerCase();
        const msg = (c.lastMessage || '').toLowerCase();
        return n.includes(q) || contact.includes(q) || msg.includes(q);
      }
      return true;
    });
  }, [conversations, listFilter, searchQuery, allSubFilter]);

  // Dynamic filter processing over active message streams
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      if (msg.sender === 'SYSTEM') {
        const isLog = isSystemLog(msg.content);
        // actual chatbot autopilot content are SYSTEM messages that are not administrative logs
        const isBotResponse = !isLog;

        if (messageFilter === 'bot') {
          // Bot log: show only Client messages, Bot chatbot replies, and general critical system actions
          return true;
        }
        if (messageFilter === 'agent') {
          // Agent view: hide automated chatbot autopilot messages so we show only Client input + Human replies
          return !isBotResponse;
        }
      } else if (msg.sender === 'AGENT') {
        if (messageFilter === 'bot') {
          return false; // hide human operator responses in dedicated Bot autopilot track
        }
      }
      return true;
    });
  }, [messages, messageFilter]);

  // Operations handlers

  const handleSendMessage = async () => {
    if (!selectedId || !newMessage.trim()) return;
    const content = newMessage.trim();
    setNewMessage('');
    setShowRepliesPopup(false);

    // Optimistically push response
    const tempId = `temp-${Date.now()}`;
    const opMsg: Message = {
      id: tempId,
      content,
      sender: 'AGENT',
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, opMsg]);

    try {
      const sent = await api.post(`/conversations/${selectedId}/send`, { content });
      setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
      // Refresh listings
      setConversations(prev => prev.map(c => {
        if (c.id === selectedId) {
          return { ...c, lastMessage: content, updatedAt: new Date().toISOString() };
        }
        return c;
      }));
    } catch (e) {
      toast.error("Failed to transmit replying message");
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleToggleMode = async (mode: 'BOT' | 'HUMAN') => {
    if (!selectedId) return;

    try {
      setCurrentConvMode(mode);
      await api.patch(`/conversations/${selectedId}/mode`, { mode });
      toast.success(`Controller updated to ${mode === 'BOT' ? 'AI Auto-Pilot Bot' : 'Manual Operator'}`);
      fetchConversations(true);
    } catch (e) {
      toast.error("Unable to swap mode overrides");
      setCurrentConvMode(prev => prev === 'BOT' ? 'HUMAN' : 'BOT');
    }
  };

  const handleSuggestReply = async () => {
    if (!selectedId) return;

    try {
      setIsSuggesting(true);
      const res = await api.post(`/conversations/${selectedId}/suggest-reply`);
      if (res && res.suggestion) {
        setNewMessage(res.suggestion);
        toast.success("AI suggested reply generated!");
      } else {
        toast.error("No recommendation returned from server intelligence models");
      }
    } catch (e) {
      toast.error("Failed to fetch suggestion from Google Gemini API");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAgentOrderResponse = async (orderId: string, action: 'approve' | 'reject', version: number) => {
    try {
      const endpoint = `/orders/${orderId}/${action}`;
      const res = await api.post(endpoint, { version });
      toast.success(action === 'approve' ? "Order accepted and is now processing!" : "Order rejected.");
      
      // Update local states so there is index state consistency and zero flicker
      setActiveOrder(res || null);
      
      // Auto assign/claim conversation locally if approved
      if (action === 'approve' && user) {
        setConversations(prev => prev.map(c => c.id === selectedId ? { ...c, assignedTo: { id: user.id, name: user.name } } : c));
        setIsLocked(false);
      }
      
      fetchConversations(true);
      fetchConversationDetail(selectedId!, true);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Action failed due to conflicts.");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, version: number) => {
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: newStatus, version });
      toast.success(`Order status updated to ${newStatus}`);
      setActiveOrder(res || null);
      fetchConversations(true);
      fetchConversationDetail(selectedId!, true);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Failed to update order status");
    }
  };

  const getNextStatuses = (current: string) => {
    switch (current) {
      case 'PENDING':
      case 'USER_CONFIRMED_PENDING_AGENT':
      case 'NEW':
        return [
          { status: 'PROCESSING', label: '⚙️ Accept Order', color: 'bg-indigo-600 hover:bg-indigo-700' },
          { status: 'CANCELLED', label: '🚫 Cancel Order', color: 'bg-slate-500 hover:bg-slate-600' }
        ];
      case 'PROCESSING':
      case 'CONFIRMED':
      case 'PREPARING':
      case 'READY':
      case 'SHIPPED':
      case 'DELIVERED':
        return [
          { status: 'CANCELLED', label: '🚫 Cancel Order', color: 'bg-slate-500 hover:bg-slate-600' }
        ];
      default:
        return [
          { status: 'PROCESSING', label: '⚙️ Move to Processing', color: 'bg-cyan-600 hover:bg-cyan-700' },
          { status: 'CANCELLED', label: '🚫 Cancel Order', color: 'bg-slate-500 hover:bg-slate-600' }
        ];
    }
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    const msgLines: string[] = [];
    const buttons: { text: string; callback: string }[] = [];
    let currentButton = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('BUTTON:')) {
        currentButton = line.replace('BUTTON:', '').trim();
      } else if (line.startsWith('CALLBACK:')) {
        const callback = line.replace('CALLBACK:', '').trim();
        if (currentButton) {
          buttons.push({ text: currentButton, callback });
          currentButton = '';
        }
      } else {
        msgLines.push(lines[i]);
      }
    }

    const cleanedText = msgLines.join('\n').trim();

    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{cleanedText}</p>
        
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-100/35 mt-1">
            {buttons.map((btn, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  toast(`Simulating customer option of "${btn.text}"`);
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[12px]">smart_button</span>
                <span>{btn.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const selectedConvLeadInitials = getInitials(selectedConv?.lead?.name, selectedConv?.lead?.contact);
  const selectedConvInitialsColor = getInitialsColor(selectedConv?.lead?.name || selectedConv?.lead?.contact || '?');

  return (
    <div className="flex relative h-[calc(100vh-140px)] md:h-[calc(100vh-160px)] w-full bg-app-surface rounded-2xl border border-app shadow-sm overflow-hidden text-app-text antialiased font-sans">
      
      {/* 1. LEFT COLUMN: DIRECTORY OF CUSTOMERS */}
      <section 
        style={{ 
          width: sidebarExpanded ? undefined : '0px', 
          minWidth: sidebarExpanded ? undefined : '0px' 
        }}
        className={`w-full md:w-[320px] bg-app-surface border-r border-app flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          selectedId ? (sidebarExpanded ? 'hidden md:flex' : 'hidden') : 'flex'
        } ${!sidebarExpanded ? 'md:border-r-0' : ''}`}
      >
        <div className="p-4 border-b border-app flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-extrabold text-slate-800 tracking-wider">INBOX</h1>
            <button 
              type="button"
              onClick={() => setSidebarExpanded(false)}
              className="hidden md:flex p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors items-center justify-center shrink-0"
              title="Collapse sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">menu_open</span>
            </button>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]">search</span>
            <input 
              type="text" 
              placeholder="Search conversations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-app-bg border border-app rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/80 outline-none transition-all placeholder:text-slate-400 text-slate-800"
            />
          </div>

          <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-app/50">
            {[
              { id: 'all', label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'ai', label: 'AI Bot' },
              { id: 'human', label: 'Manual' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setListFilter(tab.id as any)}
                className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all duration-150 ${
                  listFilter === tab.id
                    ? 'bg-app-surface shadow-sm text-blue-600 border border-app/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-header for Channel vs Manual leads filter under All section */}
          {listFilter === 'all' && (
            <div className="flex bg-slate-100/40 p-0.5 rounded-lg border border-app/40 gap-0.5 mt-0.5">
              <button
                type="button"
                onClick={() => setAllSubFilter('channel')}
                className={`flex-1 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-tight transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                  allSubFilter === 'channel'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">language</span>
                <span>Channel Leads</span>
              </button>
              <button
                type="button"
                onClick={() => setAllSubFilter('manual')}
                className={`flex-1 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-tight transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                  allSubFilter === 'manual'
                    ? 'bg-indigo-600 text-white shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[12px]">storefront</span>
                <span>Manual Leads</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loadingList ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined animate-spin text-slate-300 text-[32px]">progress_activity</span>
              <span className="text-xs font-bold text-slate-400">Loading inbox...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No active conversations matched this filter.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const leadInitials = getInitials(conv.lead?.name, conv.lead?.contact);
              const initialsColor = getInitialsColor(conv.lead?.name || conv.lead?.contact || '?');
              const isActive = selectedId === conv.id;
              
              return (
                <div 
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`px-4 py-3.5 border-b border-app/70 flex gap-3 items-start cursor-pointer transition-all ${
                    isActive 
                      ? 'bg-blue-50/50 border-l-4 border-blue-600' 
                      : 'border-l-4 border-transparent hover:bg-app-bg/60'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-inner bg-gradient-to-br ${initialsColor}`}>
                      {leadInitials}
                    </div>
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                      conv.mode === 'BOT' ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500'
                    }`} title={conv.mode === 'BOT' ? 'AI Control mode active' : 'Manual operator active'} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <h4 className={`text-xs truncate ${isActive ? 'font-bold text-blue-900' : 'font-semibold text-slate-800'}`}>
                        {conv.lead?.name || 'Customer'}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {formatTime(conv.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1">
                      <TagChips convId={conv.id} />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.lastMessage || 'No messages received.'}</p>
                    
                    <div className="flex items-center justify-between gap-1 mt-1.5">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] text-blue-400">chat_bubble</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{conv.lead?.channel || 'Telegram'}</span>
                      </div>
                      {conv.mode === 'BOT' && (
                        <span className="text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.2 rounded-md">AUTO</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 2. MIDDLE COLUMN: MESSAGES DISCUSSION STREAM */}
      <section className={`flex-1 flex flex-col bg-app-surface overflow-hidden min-w-0 ${
        !selectedId ? 'hidden md:flex' : 'flex'
      }`}>
        {selectedConv ? (
          <>
            <header className="h-16 border-b border-app bg-app-surface flex items-center justify-between px-4 sm:px-6 shrink-0 z-10">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {!sidebarExpanded && (
                  <button 
                    type="button"
                    onClick={() => setSidebarExpanded(true)}
                    className="hidden md:flex p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg items-center justify-center shrink-0 mr-1 transition-all"
                    title="Expand sidebar"
                  >
                    <span className="material-symbols-outlined text-[20px]">menu</span>
                  </button>
                )}

                <button 
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-1 mr-1 text-slate-500 hover:bg-app-bg rounded-lg flex items-center justify-center shrink-0"
                  title="Back to inbox list"
                >
                  <span className="material-symbols-outlined text-[22px] sm:text-[24px]">arrow_back</span>
                </button>

                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-[13px] sm:text-sm font-black shadow-inner leading-none bg-gradient-to-br ${selectedConvInitialsColor}`}>
                  {selectedConvLeadInitials}
                </div>
                
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-sm font-bold text-app-text flex items-center gap-1.5 truncate">
                    {selectedConv?.lead?.name || 'Customer'}
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  </h2>
                  <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate">
                    {selectedConv?.lead?.channel} • {selectedConv?.lead?.contact}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <TagButton convId={selectedConv.id} />

                <IconButton 
                  icon="call" 
                  onClick={() => {
                    const contact = selectedConv?.lead?.contact;
                    if (contact) {
                      window.open(`tel:${contact}`);
                      toast.success(`Initiating voice call stream to ${contact}...`);
                    } else {
                      toast.error("No contact registration found for this lead");
                    }
                  }} 
                  title="Call Customer" 
                />

                <button 
                  type="button"
                  onClick={() => setShowProfile(p => !p)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                    showProfile 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-app'
                  }`}
                >
                  {showProfile ? 'Hide Profile' : 'View Profile'}
                </button>
              </div>
            </header>

            {/* compact action panel for agent approval */}
            {activeOrder && ['PENDING', 'USER_CONFIRMED_PENDING_AGENT'].includes(activeOrder.status) && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
                <div className="flex gap-2.5 items-start">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-amber-800 tracking-tight">Customer Order Request</h4>
                    <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                      Items: <strong className="text-app-text font-bold">{activeOrder.summary}</strong> ({activeOrder.amount ? `₹${activeOrder.amount}` : "Pending Amount"})
                    </p>
                    <span className="inline-flex items-center gap-1 text-[9px] bg-amber-200 text-amber-800 font-black uppercase px-2 py-0.5 rounded-full mt-1.5 shadow-sm border border-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                      Status: Awaiting Agent Confirmation
                    </span>
                  </div>
                </div>
                {/* Compact Buttons List */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleAgentOrderResponse(activeOrder.id, 'approve', activeOrder.version)}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1 border border-emerald-500/10"
                  >
                    <span className="material-symbols-outlined text-[15px]">done</span>
                    <span>Accept Order</span>
                  </button>
                  <button
                    onClick={() => handleAgentOrderResponse(activeOrder.id, 'reject', activeOrder.version)}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-xs uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1 border border-rose-500/10"
                  >
                    <span className="material-symbols-outlined text-[15px]">close</span>
                    <span>Reject Order</span>
                  </button>
                </div>
              </div>
            )}

            {/* HIGH FIDELITY DIRECT ORDER WORKFLOW CONTROLLER FOR ACTIVE ORDERS */}
            {activeOrder && ['PROCESSING', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'NEW', 'CONFIRMED'].includes(activeOrder.status) && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200/50 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex gap-2.5 items-start">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">engineering</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-blue-800 tracking-tight">Active Customer Order</h4>
                    <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
                      Items: <strong className="text-app-text font-bold">{activeOrder.summary}</strong> ({activeOrder.amount ? `₹${activeOrder.amount}` : "Pending Amount"})
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="inline-flex items-center gap-1 text-[9px] bg-blue-100/80 text-blue-800 font-black uppercase px-2.5 py-1 rounded-full shadow-sm border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                        Stage: {activeOrder.status}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">
                        v{activeOrder.version}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Active status controller action set */}
                <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                  {getNextStatuses(activeOrder.status).map((opt) => (
                    <button
                      key={opt.status}
                      onClick={() => handleUpdateOrderStatus(activeOrder.id, opt.status, activeOrder.version)}
                      className={`px-3 py-1.5 ${opt.color} text-white font-extrabold text-[10px] uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* If there is NO active order for this lead, allow taking a new order directly */}
            {!activeOrder && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200/50 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex gap-2.5 items-start">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-emerald-800 tracking-tight">No Active Order for {selectedConv?.lead?.name || "Customer"}</h4>
                    <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 font-sans">
                      You can instantly record a manual order taken during this chat thread.
                    </p>
                  </div>
                </div>
                <button
                  id="take-order-during-chat-btn"
                  onClick={() => {
                    const name = encodeURIComponent(selectedConv?.lead?.name || "");
                    const contact = encodeURIComponent(selectedConv?.lead?.contact || "");
                    navigate(`/dashboard/leads?create=true&name=${name}&phone=${contact}`);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1.5 border border-emerald-500/10 font-sans"
                >
                  <span className="material-symbols-outlined text-[15px]">shopping_cart</span>
                  <span>Take Custom Order</span>
                </button>
              </div>
            )}


            {/* MESSAGE ACTIVITY BAR with Sidebar Toggle */}
            <div className="bg-app-bg px-4 sm:px-6 py-2.5 border-b border-app/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTrackSidebarExpanded(!trackSidebarExpanded)}
                  className={`p-1.5 flex items-center gap-1.5 text-xs font-bold rounded-lg border transition-all duration-150 ${
                    trackSidebarExpanded 
                      ? 'bg-blue-50 text-blue-600 border-blue-200/50 hover:bg-blue-100/60' 
                      : 'bg-app-surface text-app-muted border-app/80 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title="Toggle Message Views Side Navigation"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {trackSidebarExpanded ? 'menu_open' : 'menu'}
                  </span>
                  <span>Message Views</span>
                </button>
              </div>
              
              <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
                <span className="text-slate-400">Viewing:</span>
                <span className={`px-2 py-0.5 rounded font-black tracking-tight ${
                  messageFilter === 'all' 
                    ? 'bg-blue-100 text-blue-700' 
                    : messageFilter === 'bot' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {messageFilter === 'all' ? 'Unified Flow' : messageFilter === 'bot' ? 'AI Bot Track' : 'Live Agent Track'}
                </span>
              </div>
            </div>

            {/* SUB-CONTAINER FOR SIDE FILTER + CHAT LOG AREA */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* COLLAPSIBLE TRACK SIDEBAR */}
              <div 
                style={{ 
                  width: trackSidebarExpanded ? '200px' : '0px',
                  minWidth: trackSidebarExpanded ? '200px' : '0px',
                  opacity: trackSidebarExpanded ? 1 : 0
                }}
                className="bg-app-bg border-r border-app/60 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
              >
                <div className="p-3 flex flex-col gap-1.5 h-full">
                  <div className="px-1.5 py-1 text-[9px] font-black text-slate-400 tracking-wider uppercase">
                    Select Track
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setMessageFilter('all')}
                    className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 ${
                      messageFilter === 'all'
                        ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-500/15'
                        : 'text-app-muted hover:text-app-text hover:bg-slate-200/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">forum</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs truncate font-bold">Unified Flow</span>
                      <span className={`text-[9px] font-normal leading-none mt-0.5 ${messageFilter === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>
                        ({messages.length} messages)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessageFilter('bot')}
                    className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 ${
                      messageFilter === 'bot'
                        ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-500/15'
                        : 'text-app-muted hover:text-app-text hover:bg-slate-200/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs truncate font-bold">AI Bot Track</span>
                      <span className={`text-[9px] font-normal leading-none mt-0.5 ${messageFilter === 'bot' ? 'text-purple-100' : 'text-slate-400'}`}>
                        Autopilot system
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMessageFilter('agent')}
                    className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 ${
                      messageFilter === 'agent'
                        ? 'bg-emerald-600 text-white font-extrabold shadow-md shadow-emerald-500/15'
                        : 'text-app-muted hover:text-app-text hover:bg-slate-200/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">support_agent</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs truncate font-bold">Live Agent Track</span>
                      <span className={`text-[9px] font-normal leading-none mt-0.5 ${messageFilter === 'agent' ? 'text-emerald-100' : 'text-slate-400'}`}>
                        Human override
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* MESSAGES FLOW & INPUT BOX COMPOSER WRAPPER */}
              <div className="flex-1 flex flex-col min-w-0 bg-app-surface relative">
                {/* Conversation Window */}
                <div 
                  ref={scrollRef} 
                  className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar bg-app-bg/10"
                >
              {loadingChat ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-blue-500 text-[32px]">progress_activity</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading conversation history...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-xs italic text-center">
                  <span className="material-symbols-outlined text-[48px] text-slate-200 mb-2">forum</span>
                  No messages matches the selected view. Keep monitoring real-time feeds.
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  // If it's a true core system log, render it as centralized capsule
                  if (msg.sender === 'SYSTEM' && isSystemLog(msg.content)) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-app/50 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">info</span>
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  // Determine sender parameters
                  const isIncoming = msg.sender === 'CLIENT';
                  
                  // If SYSTEM and NOT isSystemLog, it is an automated AI response written by Bot Autopilot (MessageSender.SYSTEM)
                  const isBotResponse = msg.sender === 'SYSTEM';

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 max-w-[85%] ${
                        isIncoming ? 'mr-auto' : 'ml-auto flex-row-reverse'
                      }`}
                    >
                      {/* Avatar initials badge */}
                      {isIncoming ? (
                        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-black bg-gradient-to-br ${selectedConvInitialsColor}`}>
                          {selectedConvLeadInitials}
                        </div>
                      ) : isBotResponse ? (
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs bg-purple-600 shadow-sm leading-none">
                          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs bg-blue-600 shadow-sm leading-none">
                          <span className="material-symbols-outlined text-[16px]">support_agent</span>
                        </div>
                      )}

                      <div className={`flex flex-col ${!isIncoming ? 'items-end' : ''}`}>
                        {/* Sender Label Indicator */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {isIncoming ? (selectedConv?.lead?.name || 'Customer') : isBotResponse ? '🤖 AI Autopilot' : '👤 Operator'}
                          </span>
                          {isBotResponse && (
                            <span className="text-[8px] bg-purple-100 text-purple-700 px-1 rounded font-black uppercase">Auto</span>
                          )}
                          {!isIncoming && !isBotResponse && (
                            <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded font-black uppercase font-sans">Live</span>
                          )}
                        </div>

                        {/* Speech Bubble Card */}
                        <div className={`p-4 rounded-xl shadow-sm ${
                          isIncoming 
                            ? 'bg-app-surface border border-app text-slate-800' 
                            : isBotResponse
                              ? 'bg-purple-50 border border-purple-200/80 text-purple-950 font-medium'
                              : 'bg-blue-600 text-white'
                        }`}>
                          {renderMessageContent(msg.content)}
                        </div>

                        {/* Timestamp helper */}
                        <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 font-semibold uppercase">
                          <span>{formatTime(msg.createdAt)}</span>
                          {!isIncoming && (
                            <>
                              <span>•</span>
                              <span className={isBotResponse ? 'text-purple-600' : 'text-blue-500'}>Delivered</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Form Composer */}
            <div className="p-4 bg-app-surface border-t border-app">
              <div className="border border-app rounded-xl focus-within:ring-2 focus-within:ring-blue-500/15 focus-within:border-blue-500/50 transition-all shadow-sm">
                
                {showRepliesPopup && (
                  <div className="relative">
                    <SavedRepliesPopup 
                      query={replyQuery}
                      onSelect={(content) => {
                        setNewMessage(content);
                        setShowRepliesPopup(false);
                      }}
                      onClose={() => setShowRepliesPopup(false)}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-2.5 border-b border-app flex-wrap gap-2 bg-app-bg/50">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button 
                      onClick={() => { setShowRepliesPopup(p => !p); setReplyQuery(""); }}
                      disabled={isLocked}
                      className="px-2 sm:px-3 py-1.5 text-blue-600 font-extrabold text-[10px] uppercase bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">menu_book</span>
                      <span className="hidden sm:inline">Replies</span>
                    </button>
                    
                    <button 
                      onClick={handleSuggestReply}
                      disabled={isSuggesting || isLocked}
                      className="px-2 sm:px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 font-extrabold text-[10px] uppercase rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                      title="Generates a contextual reply powered by Google Gemini AI models"
                    >
                      {isSuggesting ? (
                        <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-[15px]">magic_button</span>
                      )}
                      <span>
                        <span className="hidden sm:inline">AI Suggest</span>
                        <span className="sm:hidden">AI</span>
                      </span>
                    </button>

                    <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1"></div>
                    
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-app/50">
                      <button
                        type="button"
                        onClick={() => handleToggleMode('BOT')}
                        className={`px-2 sm:px-3 py-1 rounded text-[9px] font-black uppercase tracking-tight transition ${
                          currentConvMode === 'BOT' 
                            ? 'bg-app-surface text-blue-600 shadow-sm border border-app/20' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="AI bot takes full automated control of communications flow"
                      >
                        <span className="hidden sm:inline">AI </span>Pilot
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleMode('HUMAN')}
                        className={`px-2 sm:px-3 py-1 rounded text-[9px] font-black uppercase tracking-tight transition ${
                          currentConvMode === 'HUMAN' 
                            ? 'bg-app-surface text-blue-600 shadow-sm border border-app/20' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Pause bot automated responses. Operator will reply manually."
                      >
                        Manual
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-0.5 sm:gap-1">
                    <IconButton icon="mood" title="Emojis" />
                    <IconButton icon="attach_file" title="Attach file" />
                  </div>
                </div>

                <textarea 
                  placeholder={isLocked ? "🔒 Conversation is locked. Claim thread to respond." : "Type a message... Type '/' for templates."}
                  value={newMessage}
                  disabled={isLocked}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewMessage(val);
                    if (val.startsWith("/")) {
                      setShowRepliesPopup(true);
                      setReplyQuery(val.slice(1));
                    } else {
                      setShowRepliesPopup(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !showRepliesPopup && !isLocked) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="w-full p-4 text-xs md:text-sm border-none focus:ring-0 focus:outline-none min-h-[90px] resize-none text-slate-800 bg-transparent placeholder:text-slate-400"
                />
                
                <div className="flex items-center justify-between p-2.5 sm:p-3 bg-app-bg/50 rounded-b-xl border-t border-app">
                  <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold select-none">
                    {currentConvMode === 'BOT' ? '🤖 AI Autopilot actively responding' : '👤 Manual operator overrides active'}
                  </span>
                  <button 
                    onClick={handleSendMessage}
                    disabled={isLocked || !newMessage.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-xs font-extrabold hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-blue-500/20 active:scale-[0.98]"
                  >
                    <span>Send Message</span>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
        ) : (
          <div className="flex-1 flex flex-col bg-app-bg/10">
            {!sidebarExpanded && (
              <header className="h-16 border-b border-app bg-app-surface flex items-center px-4 sm:px-6 shrink-0">
                <button 
                  type="button"
                  onClick={() => setSidebarExpanded(true)}
                  className="hidden md:flex p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg items-center justify-center shrink-0 mr-1 transition-all"
                  title="Expand sidebar"
                >
                  <span className="material-symbols-outlined text-[20px]">menu</span>
                </button>
                <span className="ml-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Inbox Directory</span>
              </header>
            )}
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-transparent">
             <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6">
               <span className="material-symbols-outlined text-[36px]">forum</span>
             </div>
             <h2 className="text-sm font-bold text-slate-800 mb-2">Select a Conversation</h2>
             <p className="text-xs max-w-xs leading-relaxed text-slate-500">Pick a customer session from the directory to review transaction notes or chat manual overrides.</p>
            </div>
          </div>
        )}
      </section>

      {/* 3. RIGHT COLUMN: CONTACT INTELLIGENCE CARD */}
      {showProfile && (
        <ContactIntelligence 
          activeLead={activeLead} 
          selectedConv={selectedConv} 
          onClose={() => setShowProfile(false)} 
        />
      )}

      {/* Embedded stylesheets */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');
        
        body { font-family: 'Inter', sans-serif; }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default ConversationHub;
