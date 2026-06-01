import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { Conversation, Message } from './types';
import {
  getInitials,
  getInitialsColor,
  isSystemLog
} from './helpers';
import { ContactIntelligence } from './ContactIntelligence';
import { OrderWorkflowBanner } from './OrderWorkflowBanner';
import { ChatMessageItem } from './ChatMessageItem';
import { ConversationsListSidebar } from './ConversationsListSidebar';
import { MessageTrackSidebar } from './MessageTrackSidebar';
import { ConversationHeader } from './ConversationHeader';
import { ConversationEmptyState } from './ConversationEmptyState';
import { MessageComposer } from './MessageComposer';

const Conversations = () => {
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
      if (res && typeof res === 'object') {
        setMessages(Array.isArray(res.messages) ? res.messages : []);
        setIsLocked(!!res.isLocked);
        setCurrentConvMode(['BOT', 'HUMAN'].includes(res.mode) ? res.mode : 'BOT');
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
      if (!msg || !msg.sender) return false;
      
      if (msg.sender === 'SYSTEM') {
        const isLog = isSystemLog(msg.content || '');
        // actual chatbot autopilot content are SYSTEM messages that are not administrative logs
        const isBotResponse = !isLog;

        if (messageFilter === 'bot') {
          // Bot log: show all messages in unified view for bot track
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
      } else if (msg.sender !== 'CLIENT') {
        return false; // invalid sender
      }
      return true;
    });
  }, [messages, messageFilter]);

  // Operations handlers

  const handleSendMessage = async (content: string) => {
    if (!selectedId || !content) return;

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
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Failed to transmit replying message");
    }
  };

  const handleToggleMode = async (mode: 'BOT' | 'HUMAN') => {
    if (!selectedId) return;

    const previousMode = currentConvMode;
    try {
      setCurrentConvMode(mode);
      await api.patch(`/conversations/${selectedId}/mode`, { mode });
      toast.success(`Controller updated to ${mode === 'BOT' ? 'AI Auto-Pilot Bot' : 'Manual Operator'}`);
      fetchConversations(true);
    } catch (e) {
      toast.error("Unable to swap mode overrides");
      setCurrentConvMode(previousMode);
    }
  };

  const handleSuggestReply = async () => {
    if (!selectedId) return null;

    try {
      const res = await api.post(`/conversations/${selectedId}/suggest-reply`);
      if (res && res.suggestion) {
        toast.success("AI suggested reply generated!");
        return res.suggestion;
      } else {
        toast.error("No recommendation returned from server intelligence models");
      }
    } catch (e) {
      toast.error("Failed to fetch suggestion from Google Gemini API");
    }
    return null;
  };

  const handleAgentOrderResponse = async (orderId: string, action: 'approve' | 'reject', version: number) => {
    if (!selectedId) {
      toast.error("Conversation ID not found");
      return;
    }
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
      fetchConversationDetail(selectedId, true);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Action failed due to conflicts.");
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, version: number) => {
    if (!selectedId) {
      toast.error("Conversation ID not found");
      return;
    }
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: newStatus, version });
      toast.success(`Order status updated to ${newStatus}`);
      setActiveOrder(res || null);
      fetchConversations(true);
      fetchConversationDetail(selectedId, true);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Failed to update order status");
    }
  };

  const selectedConvLeadInitials = getInitials(selectedConv?.lead?.name, selectedConv?.lead?.contact);
  const selectedConvInitialsColor = getInitialsColor(selectedConv?.lead?.name || selectedConv?.lead?.contact || '?');

  return (
    <div className="flex relative h-[calc(100vh-140px)] md:h-[calc(100vh-160px)] w-full bg-app-surface rounded-2xl border border-app shadow-sm overflow-hidden text-app-text antialiased font-sans">
      
      {/* 1. LEFT COLUMN: DIRECTORY OF CUSTOMERS */}
      <ConversationsListSidebar
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        listFilter={listFilter}
        setListFilter={setListFilter}
        allSubFilter={allSubFilter}
        setAllSubFilter={setAllSubFilter}
        loadingList={loadingList}
        filteredConversations={filteredConversations}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
      />

      {/* 2. MIDDLE COLUMN: MESSAGES DISCUSSION STREAM */}
      <section className={`flex-1 flex flex-col bg-app-surface overflow-hidden min-w-0 ${
        !selectedId ? 'hidden md:flex' : 'flex'
      }`}>
        {selectedConv ? (
          <>
            <ConversationHeader
              selectedConv={selectedConv}
              sidebarExpanded={sidebarExpanded}
              setSidebarExpanded={setSidebarExpanded}
              setSelectedId={setSelectedId}
              showProfile={showProfile}
              setShowProfile={setShowProfile}
            />

            {/* Direct Order Workflow Banner */}
            <OrderWorkflowBanner
              activeOrder={activeOrder}
              customerName={selectedConv?.lead?.name || 'Customer'}
              onApproveReject={(action) => handleAgentOrderResponse(activeOrder!.id, action, activeOrder!.version)}
              onUpdateStatus={(newStatus) => handleUpdateOrderStatus(activeOrder!.id, newStatus, activeOrder!.version)}
              onTakeCustomOrder={() => {
                const name = encodeURIComponent(selectedConv?.lead?.name || "");
                const contact = encodeURIComponent(selectedConv?.lead?.contact || "");
                navigate(`/dashboard/leads?create=true&name=${name}&phone=${contact}`);
              }}
            />


            {/* MESSAGE ACTIVITY BAR with Sidebar Toggle */}
            <div className="bg-app-bg px-4 sm:px-6 py-2.5 border-b border-app/60 flex items-center justify-between gap-2 font-sans">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTrackSidebarExpanded(!trackSidebarExpanded)}
                  className={`p-1.5 flex items-center gap-1.5 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
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
              <MessageTrackSidebar
                trackSidebarExpanded={trackSidebarExpanded}
                messageFilter={messageFilter}
                setMessageFilter={setMessageFilter}
                totalMessagesCount={messages.length}
              />

              {/* MESSAGES FLOW & INPUT BOX COMPOSER WRAPPER */}
              <div className="flex-1 flex flex-col min-w-0 bg-app-surface relative font-sans">
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
                    filteredMessages.map((msg) => (
                      <ChatMessageItem
                        key={msg.id}
                        msg={msg}
                        selectedConvInitialsColor={selectedConvInitialsColor}
                        selectedConvLeadInitials={selectedConvLeadInitials}
                        customerName={selectedConv?.lead?.name || 'Customer'}
                      />
                    ))
                  )}
                </div>

                {/* Input Form Composer */}
                <MessageComposer
                  isLocked={isLocked}
                  currentConvMode={currentConvMode}
                  onToggleMode={handleToggleMode}
                  onSendMessage={handleSendMessage}
                  onSuggestReply={handleSuggestReply}
                />
              </div>
            </div>
          </>
        ) : (
          <ConversationEmptyState
            sidebarExpanded={sidebarExpanded}
            setSidebarExpanded={setSidebarExpanded}
          />
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

export default Conversations;
