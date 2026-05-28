import { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  MessageSquare,
  Search,
  MoreVertical,
  Clock,
  ArrowLeft,
  Mail,
  UserCheck,
  UserX,
  Shield,
  ThumbsUp,
  ExternalLink,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { NoteData } from "../../components/dashboard/InternalNote";
import { MessageComposer } from "../../components/dashboard/MessageComposer";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import toast from "react-hot-toast";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isAvailable?: boolean;
}

export default function AgentInbox() {
  const { user } = useAuth();
  const { socket } = useSocket();

  // Data states
  const [agents, setAgents] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<UserData | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail" | "context">(
    "list",
  );

  const [notes, setNotes] = useState<NoteData[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [isSubmittingMessage, setIsSubmittingMessage] = useState(false);

  const [activeChats, setActiveChats] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("agent_active_chats");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Advanced interactivity states
  const [reactions, setReactions] = useState<
    Record<string, Record<string, number>>
  >({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Bulk Selection States
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [listMenuOpenId, setListMenuOpenId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const toggleListSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedListIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const clearSelection = () => {
    setSelectedListIds([]);
    setIsSelectionMode(false);
  };

  const handleBulkDelete = async (bothSides: boolean) => {
    if (selectedListIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: "Delete Chats",
      message: `Are you sure you want to delete ${selectedListIds.length} chats${bothSides ? " for BOTH sides" : ""}?`,
      onConfirm: async () => {
        try {
          await Promise.all(
            selectedListIds.map((id) =>
              api.delete(`/users/${id}/notes?bothSides=${bothSides}`),
            ),
          );

          // Remove locally
          setActiveChats((prev) => {
            const next = prev.filter((id) => !selectedListIds.includes(id));
            localStorage.setItem("agent_active_chats", JSON.stringify(next));
            return next;
          });

          if (selectedAgent && selectedListIds.includes(selectedAgent.id)) {
            setNotes([]);
            setSelectedAgent(null);
            setMobileView("list");
          }

          clearSelection();
          toast.success("Chats deleted");
        } catch (err) {
          console.error("Bulk delete failed", err);
          toast.error("Failed to delete chats");
        }
      },
    });
  };

  const handleDeleteSingleListChat = async (
    agentId: string,
    bothSides: boolean,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: "Delete Chat History",
      message: `Are you sure you want to delete this chat history${bothSides ? " for BOTH sides" : ""}?`,
      onConfirm: async () => {
        try {
          await api.delete(`/users/${agentId}/notes?bothSides=${bothSides}`);
          setActiveChats((prev) => {
            const next = prev.filter((id) => id !== agentId);
            localStorage.setItem("agent_active_chats", JSON.stringify(next));
            return next;
          });
          if (selectedAgent?.id === agentId) {
            setNotes([]);
            setSelectedAgent(null);
            setMobileView("list");
          }
          setListMenuOpenId(null);
          toast.success("Chat deleted");
        } catch (err) {
          console.error("Delete failed", err);
          toast.error("Failed to delete chat");
        }
      },
    });
  };

  const handleDeleteChat = async (bothSides: boolean) => {
    if (!selectedAgent) return;

    setConfirmModal({
      isOpen: true,
      title: "Delete Chat History",
      message: `Are you sure you want to delete this chat history${bothSides ? " for BOTH sides" : ""}?`,
      onConfirm: async () => {
        try {
          await api.delete(
            `/users/${selectedAgent.id}/notes?bothSides=${bothSides}`,
          );

          // Remove locally immediately
          setNotes([]);
          setIsMoreMenuOpen(false);

          // Update active chats locally
          setActiveChats((prev) => {
            const next = prev.filter((id) => id !== selectedAgent.id);
            localStorage.setItem("agent_active_chats", JSON.stringify(next));
            return next;
          });
          setSelectedAgent(null);
          setMobileView("list");
        } catch (err: any) {
          console.error("Failed to delete chat", err);
          toast.error("Failed to delete chat: " + err.message);
        }
      },
    });
  };

  useEffect(() => {
    if (selectedAgent) {
      setIsMoreMenuOpen(false);
    }
  }, [selectedAgent]);

  // Handle remote "For both sides" chat deletion event
  useEffect(() => {
    const handleRemoteClear = (e: any) => {
      const targetId = e.detail?.targetId;
      if (targetId) {
        setActiveChats((prev) => prev.filter((id) => id !== targetId));
        if (selectedAgent?.id === targetId) {
          setNotes([]);
          setSelectedAgent(null);
          setMobileView("list");
          toast.error("The chat was cleared by the other team member");
        }
      }
    };

    window.addEventListener("agentChatClearedEvent", handleRemoteClear);
    return () =>
      window.removeEventListener("agentChatClearedEvent", handleRemoteClear);
  }, [selectedAgent]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [notes]);

  useEffect(() => {
    scrollToBottom("auto");
  }, [selectedAgent?.id]);

  // Load agents from `/users/list` (supported for AGENT role)
  useEffect(() => {
    let isMounted = true;
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const [agentsData, activeChatsData] = await Promise.all([
          api.get(`/users/list`),
          api.get(`/users/inbox/active`).catch(() => []),
        ]);

        if (isMounted) {
          setAgents(agentsData);

          if (activeChatsData && Array.isArray(activeChatsData)) {
            setActiveChats(activeChatsData);
            localStorage.setItem(
              "agent_active_chats",
              JSON.stringify(activeChatsData),
            );
          }

          // Auto-select first item if not mobile and empty
          const otherAgents = agentsData.filter((a: UserData) =>
            user ? a.id !== user.id : true,
          );
          if (
            otherAgents.length > 0 &&
            !selectedAgent &&
            window.innerWidth >= 1024
          ) {
            const savedChats = localStorage.getItem("agent_active_chats");
            const parsed = savedChats ? JSON.parse(savedChats) : [];
            const activeList =
              activeChatsData?.length > 0 ? activeChatsData : parsed;

            if (activeList.length > 0) {
              const firstActive = otherAgents.find((a: UserData) =>
                activeList.includes(a.id),
              );
              if (firstActive) handleSelectAgent(firstActive);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAgents();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Load real workspace internal notes when an agent is selected
  useEffect(() => {
    if (!selectedAgent) return;
    setNotesLoading(true);

    // Add to active chats
    setActiveChats((prev) => {
      if (!prev.includes(selectedAgent.id)) {
        const next = [selectedAgent.id, ...prev];
        localStorage.setItem("agent_active_chats", JSON.stringify(next));
        return next;
      }
      return prev;
    });

    let isMounted = true;

    const fetchNotes = async () => {
      try {
        const data = await api.get(`/users/${selectedAgent.id}/notes`);
        if (!isMounted) return;
        const formatted = data.map((n: any) => ({
          id: n.id,
          authorName: n.authorName,
          authorInitials: n.authorName
            ? n.authorName.charAt(0).toUpperCase()
            : "?",
          content: n.content,
          createdAt: new Date(n.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSystem: false,
          conversationId: n.conversationId,
          leadName:
            n.conversation?.lead?.name ||
            n.conversation?.lead?.contact ||
            "customer",
          authorId: n.authorId,
        }));
        setNotes(formatted);
      } catch (err) {
        console.error("Failed to load agent notes:", err);
        if (isMounted) setNotes([]);
      } finally {
        if (isMounted) setNotesLoading(false);
      }
    };

    fetchNotes();
    return () => {
      isMounted = false;
    };
  }, [selectedAgent?.id]);

  // Real-time listener for incoming team note updates
  useEffect(() => {
    if (!socket || !user) return;

    const onNewNote = (newNote: any) => {
      let otherAgentId = null;
      if (newNote.authorId === user.id) {
        // If we are the author, the target must be in mentionedIds
        otherAgentId = newNote.mentionedIds?.find(
          (id: string) => id !== user.id,
        );
      } else {
        // If we are not the author, the other is the author
        otherAgentId = newNote.authorId;
      }

      if (otherAgentId) {
        setActiveChats((prev) => {
          if (!prev.includes(otherAgentId)) {
            const next = [otherAgentId, ...prev];
            localStorage.setItem("agent_active_chats", JSON.stringify(next));
            return next;
          }
          return prev;
        });
      }

      if (selectedAgent) {
        const isFromTarget = newNote.authorId === selectedAgent.id;
        const isToTarget = newNote.mentionedIds?.includes(selectedAgent.id);

        if (isFromTarget || isToTarget) {
          // Option to play ambient notification alert
          if (soundEnabled && newNote.authorId !== user?.id) {
            try {
              new Audio("/notification.mp3").play().catch(() => {});
            } catch (e) {}
          }

          setNotes((prev) => {
            if (prev.some((n) => n.id === newNote.id)) return prev;
            return [
              ...prev,
              {
                id: newNote.id,
                authorName: newNote.authorName,
                authorInitials: newNote.authorName
                  ? newNote.authorName.charAt(0).toUpperCase()
                  : "?",
                content: newNote.content,
                createdAt: new Date(newNote.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isSystem: false,
                conversationId: newNote.conversationId,
                leadName:
                  newNote.conversation?.lead?.name ||
                  newNote.conversation?.lead?.contact ||
                  "customer",
                authorId: newNote.authorId,
              },
            ];
          });
        }
      }
    };

    socket.on("agent_inbox_new_note", onNewNote);
    return () => {
      socket.off("agent_inbox_new_note", onNewNote);
    };
  }, [socket, selectedAgent?.id, soundEnabled, user]);

  const handleSelectAgent = (agent: UserData) => {
    setSelectedAgent(agent);
    setMobileView("detail");
  };

  const handleSendNote = async (text: string) => {
    if (!selectedAgent || !text.trim()) return;

    setIsSubmittingMessage(true);
    try {
      const res = await api.post(`/users/${selectedAgent.id}/notes`, {
        content: text.trim(),
      });

      setNotes((prev) => {
        if (prev.some((n) => n.id === res.id)) return prev;
        return [
          ...prev,
          {
            id: res.id,
            authorName: res.authorName,
            authorInitials: res.authorName
              ? res.authorName.charAt(0).toUpperCase()
              : "?",
            content: res.content,
            createdAt: new Date(res.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isSystem: false,
            conversationId: res.conversationId,
            leadName:
              res.conversation?.lead?.name ||
              res.conversation?.lead?.contact ||
              "customer",
            authorId: res.authorId || user?.id,
          },
        ];
      });
      toast.success("Note sent successfully!");
    } catch (err) {
      console.error("Failed to send agent note:", err);
      toast.error("Failed to send note");
    } finally {
      setIsSubmittingMessage(false);
    }
  };

  const handleToggleReaction = (noteId: string, emoji: string) => {
    setReactions((prev) => {
      const currentNoteReacts = prev[noteId] || {};
      const currentEmojiCount = currentNoteReacts[emoji] || 0;
      return {
        ...prev,
        [noteId]: {
          ...currentNoteReacts,
          [emoji]: currentEmojiCount > 0 ? 0 : 1,
        },
      };
    });
  };

  const filteredAgents = useMemo(() => {
    let result = agents;
    // Remove self
    if (user?.id) {
      result = result.filter((a) => a.id !== user.id);
    }
    return result;
  }, [agents, user]);

  const activeInboxAgents = useMemo(() => {
    let result = filteredAgents.filter((a) => activeChats.includes(a.id));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q),
      );
    }
    return result;
  }, [filteredAgents, activeChats, searchQuery]);

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-80px)] bg-app-bg -mx-6 lg:-mx-10 -my-8 lg:-my-10 font-['Inter',sans-serif] overflow-hidden">
      {/* LEFT PANEL - List View */}
      <div
        className={`w-full lg:w-[380px] bg-app-surface border-r border-app-border flex-col z-10 shrink-0 h-full overflow-hidden ${mobileView === "list" ? "flex" : "hidden lg:flex"}`}
      >
        <div className="p-4 border-b border-app-border bg-app-surface flex flex-col gap-3 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-app-text">Team Inbox</h2>
          </div>

          {/* Agent Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 bg-app-surface border border-app-border hover:border-[#0052CC] rounded-lg shadow-sm text-sm transition-all"
            >
              <span className="text-app-muted flex items-center gap-2">
                <Users className="w-4 h-4" /> Start a new chat...
              </span>
              <span className="text-xs font-semibold text-[#0052CC]">
                Select Agent
              </span>
            </button>

            {isDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-app-surface border border-app-border shadow-lg rounded-lg max-h-[300px] overflow-y-auto z-40">
                  <div className="p-2 border-b border-app-border sticky top-0 bg-app-surface">
                    <p className="text-xs font-semibold text-app-muted uppercase tracking-wider">
                      Available Agents
                    </p>
                  </div>
                  {filteredAgents.length === 0 ? (
                    <div className="p-4 text-center text-sm text-app-muted">
                      No other agents found
                    </div>
                  ) : (
                    filteredAgents.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          handleSelectAgent(agent);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-app-bg border-b border-app-border last:border-0 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-app-bg-soft flex items-center justify-center text-app-muted font-bold uppercase text-xs">
                              {agent.name.charAt(0)}
                            </div>
                            <span
                              className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white ${agent.isActive ? "bg-green-500" : "bg-slate-400"}`}
                            />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-app-text">
                              {agent.name}
                            </div>
                            <div className="text-[10px] text-app-muted">
                              {agent.role}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${agent.isActive ? "bg-green-50 text-green-700" : "bg-app-bg-soft text-app-muted"}`}
                        >
                          {agent.isActive ? "Active" : "Away"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <p className="text-xs font-semibold text-app-muted uppercase tracking-widest pl-1">
              Recent Chats
            </p>
            <div className="flex items-center gap-2 relative">
              <Search className="w-4 h-4 text-app-muted absolute left-3" />
              <input
                type="text"
                placeholder="Filter recent chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-app-bg border border-app-border rounded-md text-sm outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] transition-shadow placeholder-app-placeholder"
              />
            </div>
          </div>
        </div>

        <div className="flex bg-app-bg border-b border-app-border px-4 py-2 items-center justify-between z-10">
          <button
            onClick={() => {
              if (isSelectionMode) clearSelection();
              else setIsSelectionMode(true);
            }}
            className="text-xs font-semibold text-[#0052CC] hover:text-[#003d99] transition-colors"
          >
            {isSelectionMode ? "Cancel Selection" : "Select Chats"}
          </button>
          {isSelectionMode && selectedListIds.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkDelete(false)}
                className="text-[10px] px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 font-semibold transition"
              >
                Delete for Me
              </button>
              <button
                onClick={() => handleBulkDelete(true)}
                className="text-[10px] px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-semibold transition shadow-xs"
              >
                Delete Both Sides
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-app-bg">
          {loading ? (
            <div className="text-center py-10 text-app-muted text-sm">
              Loading inbox...
            </div>
          ) : activeInboxAgents.length === 0 ? (
            <div className="text-center py-10 text-app-muted flex flex-col items-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-app-text">
                No active chats
              </p>
              <p className="text-xs text-app-muted mt-1">
                Select an agent from the dropdown to start chatting.
              </p>
            </div>
          ) : (
            activeInboxAgents.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id;
              const isChecked = selectedListIds.includes(agent.id);

              return (
                <div
                  key={agent.id}
                  onClick={(e) => {
                    if (isSelectionMode) {
                      toggleListSelection(agent.id, e);
                    } else {
                      handleSelectAgent(agent);
                    }
                  }}
                  className={`relative overflow-visible cursor-pointer bg-app-surface border rounded-lg p-4 transition-all duration-200 hover:shadow-xs group ${
                    isSelected && !isSelectionMode
                      ? "border-[#0052CC] ring-1 ring-[#0052CC]/50 shadow-xs"
                      : isChecked
                        ? "border-[#0052CC] ring-1 ring-[#0052CC]/30 bg-blue-50/30"
                        : "border-app-border hover:border-app-border-strong"
                  }`}
                >
                  {/* Left indicator accent strip when selected */}
                  {isSelected && !isSelectionMode && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0052CC] rounded-l-lg" />
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {isSelectionMode && (
                        <div className="mr-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              toggleListSelection(agent.id, e as any)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-[#0052CC] border-gray-300 rounded focus:ring-[#0052CC] cursor-pointer"
                          />
                        </div>
                      )}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-xs uppercase">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Live pulsating dot anchor */}
                        <span
                          className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-green-500"
                          style={{
                            backgroundColor: agent.isActive
                              ? "#22C55E"
                              : "#94A3B8",
                          }}
                        >
                          {agent.isActive && (
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                          )}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-app-text leading-tight flex items-center gap-1.5">
                          {agent.name}
                        </h4>
                        <p className="text-[11px] text-app-muted mt-1 font-medium select-none">
                          {agent.role}
                        </p>
                      </div>
                    </div>

                    {!isSelectionMode && (
                      <div className="flex items-center gap-2 relative">
                        <StatusBadge
                          status={agent.isActive ? "success" : "neutral"}
                          label={agent.isActive ? "Active" : "Away"}
                          className="scale-90 origin-right transition-opacity group-hover:opacity-0"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setListMenuOpenId(
                              listMenuOpenId === agent.id ? null : agent.id,
                            );
                          }}
                          className="absolute right-0 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-app-text hover:bg-app-bg-soft rounded-md transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {listMenuOpenId === agent.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setListMenuOpenId(null);
                              }}
                            ></div>
                            <div
                              className="absolute top-8 right-0 w-44 bg-app-surface border border-app-border shadow-lg rounded-md overflow-hidden z-30"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) =>
                                  handleDeleteSingleListChat(agent.id, false, e)
                                }
                                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                              >
                                Delete (For me)
                              </button>
                              <button
                                onClick={(e) =>
                                  handleDeleteSingleListChat(agent.id, true, e)
                                }
                                className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors border-t border-app-border"
                              >
                                Delete (Both sides)
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CENTER PANEL - Detailed View */}
      <div
        className={`flex-1 flex-col bg-app-surface border-r border-app-border h-full overflow-hidden ${mobileView === "detail" ? "flex" : "hidden lg:flex"}`}
      >
        {selectedAgent ? (
          <>
            <div className="p-4 lg:p-6 border-b border-app-border bg-app-surface flex items-start justify-between sticky top-0 z-10 shadow-xs">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setMobileView("list")}
                  className="mt-1 p-1 -ml-2 lg:hidden text-app-muted hover:bg-app-bg-soft rounded-md"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-1 sm:mb-2">
                    <h2 className="text-xl font-bold text-app-text leading-tight flex items-center gap-2">
                      {selectedAgent.name}
                      <span className="relative flex h-2.5 w-2.5">
                        <span
                          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selectedAgent.isActive ? "bg-green-400" : "bg-slate-300"}`}
                        ></span>
                        <span
                          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${selectedAgent.isActive ? "bg-green-500" : "bg-slate-400"}`}
                        ></span>
                      </span>
                    </h2>
                    <StatusBadge
                      status={
                        selectedAgent.role === "OWNER"
                          ? "warning"
                          : selectedAgent.role === "ADMIN"
                            ? "info"
                            : "neutral"
                      }
                      label={selectedAgent.role}
                      className="hidden sm:inline-flex"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-app-muted">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> {selectedAgent.email}
                    </span>
                    {selectedAgent.isActive ? (
                      <span className="flex items-center gap-1.5 text-green-600 font-medium">
                        <UserCheck className="w-3.5 h-3.5" /> Currently Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-app-muted">
                        <UserX className="w-3.5 h-3.5" /> Offline / Inactive
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={() => {
                    setSoundEnabled(!soundEnabled);
                    toast.success(
                      soundEnabled
                        ? "Notification sounds muted"
                        : "Notification sounds enabled",
                      { duration: 1500 },
                    );
                  }}
                  title={
                    soundEnabled
                      ? "Mute notification sounds"
                      : "Unmute notification sounds"
                  }
                  className={`p-2 border rounded-md transition-colors duration-200 flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer ${
                    soundEnabled
                      ? "bg-blue-50 text-[#0052CC] border-blue-200 hover:bg-blue-100"
                      : "bg-app-bg text-slate-400 border-app hover:bg-app-bg-soft"
                  }`}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => setMobileView("context")}
                  className="px-3 py-2 text-xs font-semibold bg-app-bg text-[#0052CC] border border-app-border rounded-md hover:bg-blue-50 transition lg:hidden w-full sm:w-auto"
                >
                  View Profile
                </button>
                <div className="flex items-center gap-2 relative">
                  <button
                    onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                    className="p-2 border border-app-border rounded-md text-app-muted hover:bg-app-bg transition min-w-[44px] min-h-[44px] flex justify-center items-center"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMoreMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-20"
                        onClick={() => setIsMoreMenuOpen(false)}
                      ></div>
                      <div className="absolute top-full right-0 mt-1 w-48 bg-app-surface border border-app-border shadow-lg rounded-md overflow-hidden z-30">
                        <button
                          onClick={() => handleDeleteChat(false)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Delete Chat (For me)
                        </button>
                        <button
                          onClick={() => handleDeleteChat(true)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-app-border"
                        >
                          Delete Chat (For both sides)
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-app-bg">
              <div className="max-w-3xl mx-auto space-y-4 pb-4">
                <div className="flex justify-center my-2">
                  <span className="text-[11px] font-semibold text-app-muted bg-app-bg-soft/60 px-3 py-1 rounded-full uppercase tracking-wider">
                    Interactive Workspace Feed
                  </span>
                </div>

                <div className="space-y-4">
                  {notesLoading ? (
                    <div className="text-center py-10 text-sm text-app-muted bg-app-surface border border-app rounded-xl shadow-xs">
                      <div className="animate-pulse flex flex-col items-center justify-center gap-2">
                        <div className="h-4 w-24 bg-app-bg-soft rounded"></div>
                        <div className="text-xs text-slate-400">
                          Loading timeline...
                        </div>
                      </div>
                    </div>
                  ) : notes.length === 0 ? (
                    <div className="text-center py-12 px-6 text-sm text-app-muted bg-app-surface border border-app-border rounded-xl shadow-sm">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-[#0052CC] mx-auto mb-3">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <p className="font-semibold text-app-text text-base">
                        No previous communication history
                      </p>
                      <p className="text-slate-400 text-xs mt-1 mb-4">
                        Start collaboration by sending an internal team note
                        below.
                      </p>

                      <div className="border-t border-app pt-4 max-w-md mx-auto">
                        <p className="text-xs font-semibold text-app-muted mb-2">
                          💡 Try one of these quick topics:
                        </p>
                        <div className="flex flex-col gap-1.5 text-left">
                          {[
                            "Please review the last incoming lead queue.",
                            "I am taking a 10m break, cover the active console.",
                            "An order payload requires manual audit approval.",
                          ].map((suggestion, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                handleSendNote(suggestion);
                              }}
                              className="text-xs p-2 bg-app-bg hover:bg-blue-50 text-app-text hover:text-[#0052CC] border border-app hover:border-blue-200 rounded-lg text-left transition"
                            >
                              ⚡ {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    notes.map((note) => {
                      const isMe = note.authorId === user?.id;
                      const msgReactions = reactions[note.id] || {};

                      return (
                        <div
                          key={note.id}
                          className={`flex gap-3 max-w-full group ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          {!isMe && (
                            <div className="flex-shrink-0 self-end mb-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase">
                                {note.authorInitials || "?"}
                              </div>
                            </div>
                          )}

                          <div
                            className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                              <span className="font-medium text-app-muted">
                                {isMe ? "You" : note.authorName}
                              </span>
                              <span>•</span>
                              <span>{note.createdAt}</span>
                            </div>

                            <div
                              className={`relative p-3.5 rounded-2xl ${
                                isMe
                                  ? "bg-[#0052CC] text-white rounded-tr-none shadow-sm"
                                  : "bg-app-surface text-app-text border border-app-border rounded-tl-none shadow-xs"
                              }`}
                            >
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {note.content}
                              </p>

                              {note.conversationId && (
                                <div
                                  className={`flex items-center gap-1.5 pt-2 border-t mt-2 ${
                                    isMe
                                      ? "border-blue-500/50"
                                      : "border-app"
                                  }`}
                                >
                                  <span
                                    className={`text-[10px] ${isMe ? "text-blue-200" : "text-slate-400"}`}
                                  >
                                    Client context:
                                  </span>
                                  <a
                                    href={`/dashboard/conversations?id=${note.conversationId}`}
                                    className={`text-[10px] font-semibold rounded-md px-2 py-0.5 border flex items-center gap-1 transition-all ${
                                      isMe
                                        ? "bg-blue-800/40 text-blue-50 border-blue-400/30 hover:bg-blue-800/80"
                                        : "bg-blue-50 text-[#0052CC] border-blue-100 hover:bg-blue-100"
                                    }`}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    Lead: {note.leadName || "customer"}
                                  </a>
                                </div>
                              )}

                              {/* Interactive emoji reaction list inside cell */}
                              <div className="flex items-center gap-1 mt-2.5">
                                <button
                                  onClick={() =>
                                    handleToggleReaction(note.id, "👍")
                                  }
                                  className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 transition ${
                                    msgReactions["👍"]
                                      ? isMe
                                        ? "bg-blue-700 border-blue-500 text-white"
                                        : "bg-blue-50 border-blue-200 text-blue-700"
                                      : isMe
                                        ? "bg-blue-600/30 border-blue-500/20 text-blue-100 hover:bg-blue-600/50"
                                        : "bg-app-bg border-app text-slate-400 hover:bg-app-bg-soft"
                                  }`}
                                  title="Thumbs Up"
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                  <span className="text-[9px] font-bold">
                                    {msgReactions["👍"] ? "1" : "0"}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {isMe && (
                            <div className="flex-shrink-0 self-end mb-1">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0052CC] font-bold text-xs flex items-center justify-center shadow-xs uppercase border border-blue-200">
                                {note.authorInitials || "ME"}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {/* Invisible scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* Quick SUGGESTIONS */}
            <div className="px-4 py-2.5 bg-app-bg border-t border-app-border flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 select-none">
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />{" "}
                Collaboration Chips:
              </span>
              {[
                {
                  label: "Check Arrivals 🔍",
                  text: "Please review the latest unassigned incoming leads in the Arrivals queue.",
                },
                {
                  label: "Need Cover ☕",
                  text: "Hey! I'm taking a 15-minute coffee break. Can you please monitor our active Operator inbox?",
                },
                {
                  label: "Validate Order 💳",
                  text: "An order payload of our CRM requires a manual audit approval. Can you check?",
                },
                {
                  label: "Updates? 📋",
                  text: "Let's align assignments. Any news about our current transfer queue or active client?",
                },
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendNote(chip.text)}
                  className="text-[11px] font-medium px-2.5 py-1 bg-app-surface hover:bg-blue-50 text-app-muted hover:text-[#0052CC] border border-app hover:border-blue-200 rounded-full transition-all shadow-xs cursor-pointer select-none active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <MessageComposer
              onSend={handleSendNote}
              isLoading={isSubmittingMessage}
              placeholder={`Send an instant note to ${selectedAgent.name.split(" ")[0]}...`}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-app-bg text-app-muted">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-[#D9DADC]" />
              <p className="font-medium text-app-text">Select a team member</p>
              <p className="text-sm">
                Choose an agent to view details and collaborate
              </p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL - Context / CRM Data */}
      <div
        className={`w-full lg:w-[320px] bg-app-surface flex-col shrink-0 h-full overflow-y-auto lg:overflow-visible border-l border-app-border ${mobileView === "context" ? "flex z-20 absolute inset-0 lg:relative lg:flex" : "hidden lg:flex"}`}
      >
        {selectedAgent ? (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4 lg:hidden">
              <button
                onClick={() => setMobileView("detail")}
                className="p-1 -ml-2 text-app-muted hover:bg-app-bg-soft rounded-md"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-bold text-app-text uppercase tracking-wider">
                Profile
              </h3>
            </div>
            <h3 className="hidden lg:block text-sm font-bold text-app-text uppercase tracking-wider mb-4">
              Member Profile
            </h3>

            <div className="flex flex-col items-center text-center gap-3 mb-6 bg-app-bg p-4 rounded-xl border border-app">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold uppercase shadow-sm">
                {selectedAgent.name.charAt(0)}
              </div>
              <div>
                <h4 className="text-base font-bold text-app-text">
                  {selectedAgent.name}
                </h4>
                <p className="text-sm text-app-muted font-medium mt-1 uppercase tracking-wider">
                  {selectedAgent.role}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3 text-sm">
                <Mail className="w-4 h-4 text-app-muted mt-0.5" />
                <div className="break-all">
                  <p className="text-app-muted text-xs uppercase tracking-wider mb-0.5">
                    Email Address
                  </p>
                  <p className="text-app-text font-medium">
                    {selectedAgent.email}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Shield className="w-4 h-4 text-app-muted mt-0.5" />
                <div>
                  <p className="text-app-muted text-xs uppercase tracking-wider mb-0.5">
                    System Status
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedAgent.isActive ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        Active Account
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-app-muted bg-app-bg-soft px-2 py-0.5 rounded border border-app">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-bold text-app-text uppercase tracking-wider mb-4 border-t border-app-border pt-6">
              Collaboration Tools
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMobileView("detail")}
                className="flex flex-col items-center justify-center gap-2 p-3 border border-app-border rounded-md hover:bg-app-bg transition text-app-text min-h-[80px]"
              >
                <MessageSquare className="w-5 h-5 text-[#0052CC]" />
                <span className="text-xs font-semibold">Message</span>
              </button>
              <button className="flex flex-col items-center justify-center gap-2 p-3 border border-app-border rounded-md hover:bg-app-bg transition text-app-text min-h-[80px]">
                <Clock className="w-5 h-5 text-[#0052CC]" />
                <span className="text-xs font-semibold">Schedule Sync</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-app-muted p-6 text-center">
            <p className="text-sm">
              Select a team member to view their profile.
            </p>
          </div>
        )}
      </div>

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-app-surface rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all border border-app animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-app-text mb-2">
                {confirmModal.title}
              </h3>
              <p className="text-sm text-app-muted">
                {confirmModal.message}
              </p>
            </div>
            <div className="bg-app-bg px-6 py-4 flex items-center justify-end gap-3 border-t border-app">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-semibold text-app-text bg-app-surface border border-app-border-strong rounded-lg hover:bg-app-bg transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const onConfirm = confirmModal.onConfirm;
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                  await onConfirm();
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition shadow-sm hover:shadow"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
