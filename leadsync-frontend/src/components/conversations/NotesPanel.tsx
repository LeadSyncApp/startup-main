import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StickyNote, Send, Trash2, AtSign } from "lucide-react";
import { api } from "../../lib/api";
import toast from "react-hot-toast";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";

interface InternalNote {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  mentionedIds?: string[];
  createdAt: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface Props {
  conversationId: string;
}

export function NotesPanel({ conversationId }: Props) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    // Fetch notes first — always works for any role
    api.get(`/conversations/${conversationId}/notes`)
      .then(notesData => setNotes(notesData))
      .catch(() => toast.error("Failed to load notes"))
      .finally(() => setLoading(false));
    // Fetch team members for @mention — silently degrade if forbidden (agents)
    api.get("/users/list")
      .then((usersData: any[]) => setTeamMembers(usersData.filter(u => u.id !== user?.id)))
      .catch(() => setTeamMembers([])); // Graceful degradation — no @mention if forbidden
  }, [conversationId]);

  // Listen for socket mention events
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { conversationId: string; authorName: string; noteId: string }) => {
      if (data.conversationId === conversationId) {
        // Refresh notes
        api.get(`/conversations/${conversationId}/notes`).then(setNotes).catch(() => {});
        toast(`📝 ${data.authorName} mentioned you in a note`, { duration: 4000 });
      }
    };
    socket.on("internal_note_mention", handler);
    return () => { socket.off("internal_note_mention", handler); };
  }, [socket, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    // Detect @ mention
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && !before.slice(atIdx).includes(" ")) {
      setMentionQuery(before.slice(atIdx + 1));
      setMentionAnchor(atIdx);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: TeamMember) => {
    const before = content.slice(0, mentionAnchor);
    const after = content.slice(mentionAnchor + 1 + (mentionQuery?.length ?? 0));
    const newContent = `${before}@${member.name}${after} `;
    setContent(newContent);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      // Extract mentioned user IDs
      const mentionedIds = teamMembers
        .filter(m => content.includes(`@${m.name}`))
        .map(m => m.id);
      const note = await api.post(`/conversations/${conversationId}/notes`, {
        content: content.trim(),
        mentionedIds,
      });
      setNotes(prev => [...prev, note]);
      setContent("");
    } catch {
      toast.error("Failed to add note");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await api.delete(`/conversations/${conversationId}/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch {
      toast.error("Failed to delete note");
    }
  };

  const filteredMembers = mentionQuery !== null
    ? teamMembers.filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  return (
    <div className="flex flex-col h-full">
      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-amber-50/30">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-amber-100/60 rounded-xl animate-pulse" />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <StickyNote size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No internal notes yet.</p>
            <p className="text-xs">Use @ to mention teammates.</p>
          </div>
        ) : (
          <>
            {notes.map(note => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-app-surface border border-amber-200 rounded-xl p-3 shadow-sm group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-white text-[9px] font-black">
                        {(note.authorName || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold text-app-muted">{note.authorName}</span>
                      <span className="text-[9px] text-slate-400 ml-auto">
                        {new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-app-text leading-relaxed whitespace-pre-wrap">
                      {note.content.split(/(@\w+)/g).map((part, i) =>
                        part.startsWith("@")
                          ? <span key={i} className="text-app-primary font-semibold">{part}</span>
                          : part
                      )}
                    </p>
                  </div>
                  {(note.authorId === user?.id || user?.role !== "AGENT") && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Compose area */}
      <div className="p-3 bg-app-surface border-t border-amber-200 relative">
        {/* Mention suggestions */}
        <AnimatePresence>
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-full left-3 right-3 mb-1 bg-app-surface border border-app-border rounded-xl shadow-xl overflow-hidden z-50"
            >
              {filteredMembers.slice(0, 5).map(m => (
                <button
                  key={m.id}
                  onMouseDown={e => { e.preventDefault(); insertMention(m); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-app-primary/15 flex items-center gap-2"
                >
                  <AtSign size={11} className="text-app-primary" />
                  <span className="font-semibold text-app-text">{m.name}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Internal note — type @ to mention a teammate..."
            className="flex-1 border border-amber-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none bg-amber-50/30"
          />
          <button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="h-9 w-9 shrink-0 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition active:scale-95"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-[9px] text-slate-400 mt-1">Shift+Enter for new line · @ to mention</p>
      </div>
    </div>
  );
}
