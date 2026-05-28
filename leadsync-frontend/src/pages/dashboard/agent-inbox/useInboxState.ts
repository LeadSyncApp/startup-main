import { useState, useEffect, useMemo, useRef } from "react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../context/AuthContext";
import { useSocket } from "../../../context/SocketContext";
import toast from "react-hot-toast";
import { UserData, ConfirmModalState } from "./types";
import { NoteData } from "../internal-note/InternalNote";

export function useAgentInboxState() {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [agents, setAgents] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<UserData | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail" | "context">("list");
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
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [listMenuOpenId, setListMenuOpenId] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };

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

  const handleDeleteSingleListChat = async (agentId: string, bothSides: boolean, e: React.MouseEvent) => {
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

          setNotes([]);
          setIsMoreMenuOpen(false);

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

  useEffect(() => {
    if (!selectedAgent) return;
    setNotesLoading(true);

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

  useEffect(() => {
    if (!socket || !user) return;

    const onNewNote = (newNote: any) => {
      let otherAgentId = null;
      if (newNote.authorId === user.id) {
        otherAgentId = newNote.mentionedIds?.find(
          (id: string) => id !== user.id,
        );
      } else {
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

  return {
    user,
    loading,
    searchQuery,
    setSearchQuery,
    selectedAgent,
    handleSelectAgent,
    mobileView,
    setMobileView,
    notes,
    notesLoading,
    isSubmittingMessage,
    activeChats,
    isDropdownOpen,
    setIsDropdownOpen,
    reactions,
    soundEnabled,
    setSoundEnabled,
    messagesEndRef,
    isMoreMenuOpen,
    setIsMoreMenuOpen,
    selectedListIds,
    isSelectionMode,
    setIsSelectionMode,
    listMenuOpenId,
    setListMenuOpenId,
    confirmModal,
    setConfirmModal,
    toggleListSelection,
    clearSelection,
    handleBulkDelete,
    handleDeleteSingleListChat,
    handleDeleteChat,
    handleSendNote,
    handleToggleReaction,
    filteredAgents,
    activeInboxAgents,
  };
}
