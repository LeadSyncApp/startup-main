import { useState, useEffect, useRef } from "react";
import { MessageSquare, ExternalLink, CornerUpLeft, Smile, Copy } from "lucide-react";
import { NoteData } from "../internal-note/InternalNote";
import toast from "react-hot-toast";

interface Props {
  notesLoading: boolean;
  notes: NoteData[];
  user: any;
  reactions: Record<string, Record<string, number>>;
  reactionsDetail?: Record<string, Record<string, Array<{ id: string; name: string }>>>;
  handleToggleReaction: (noteId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleSendNote: (text: string) => void;
  setReplyToNote: (n: NoteData | null) => void;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥"];

export function AgentChatFeed({
  notesLoading,
  notes,
  user,
  reactions,
  reactionsDetail,
  handleToggleReaction,
  messagesEndRef,
  handleSendNote,
  setReplyToNote,
}: Props) {
  // Context menu for quick reaction emojis (triggered on standard click - left or right)
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    noteId: string;
  } | null>(null);

  // Modal for WhatsApp-style holding/long-press options list
  const [optionsModal, setOptionsModal] = useState<{
    isOpen: boolean;
    noteId: string;
    note: NoteData | null;
  }>({
    isOpen: false,
    noteId: "",
    note: null,
  });

  // Modal display details for WhatsApp-style user profile reaction view
  const [activeReactionDetail, setActiveReactionDetail] = useState<{
    noteId: string;
    allReactions: Array<{ userId: string; name: string; emoji: string }>;
  } | null>(null);

  const [detailTab, setDetailTab] = useState<string>("All");

  // Track long press triggers for WhatsApp modal features
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef(false);

  // Close popup menus on outer click or Escape key
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    window.addEventListener("click", handleClose);
    window.addEventListener("contextmenu", handleClose);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("contextmenu", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const openReactionDetails = (noteId: string) => {
    const noteReactsDetail = (reactionsDetail && reactionsDetail[noteId]) || {};
    const allParsed: Array<{ userId: string; name: string; emoji: string }> = [];
    
    Object.entries(noteReactsDetail).forEach(([emoji, userList]) => {
      userList.forEach((u) => {
        allParsed.push({
          userId: u.id,
          name: u.name,
          emoji,
        });
      });
    });

    if (allParsed.length > 0) {
      setActiveReactionDetail({
        noteId,
        allReactions: allParsed,
      });
      setDetailTab("All");
    } else {
      // Direct count matches fallback list
      const noteCountReacts = reactions[noteId] || {};
      const fallbackList: Array<{ userId: string; name: string; emoji: string }> = [];
      Object.entries(noteCountReacts).forEach(([emoji, count]) => {
        if (count > 0) {
          fallbackList.push({
            userId: "unknown",
            name: "Teammate",
            emoji
          });
        }
      });
      if (fallbackList.length > 0) {
        setActiveReactionDetail({
          noteId,
          allReactions: fallbackList
        });
        setDetailTab("All");
      }
    }
  };

  // WhatsApp style holding recognition:
  const handlePressStart = (_e: React.MouseEvent | React.TouchEvent, noteId: string, note: NoteData) => {
    longPressActive.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);

    pressTimer.current = setTimeout(() => {
      longPressActive.current = true;
      setOptionsModal({
        isOpen: true,
        noteId,
        note,
      });
    }, 600); // 600ms hold requirement
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent, noteId: string) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    // Capture standard single tap/click if user lifts before 600ms
    if (!longPressActive.current) {
      e.preventDefault();
      e.stopPropagation();

      let clientX = 0;
      let clientY = 0;
      if ("changedTouches" in e) {
        if (e.changedTouches && e.changedTouches[0]) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        }
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      if (clientX === 0 && clientY === 0) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top - 20;
      }

      setContextMenu({
        mouseX: clientX,
        mouseY: clientY,
        noteId,
      });
    }
  };

  // Jump scroll to targeted original reference
  const handleScrollToMessage = (quotedNoteId: string) => {
    const elem = document.getElementById(`note-${quotedNoteId}`);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "center" });
      const bubble = document.getElementById(`bubble-${quotedNoteId}`);
      if (bubble) {
        bubble.classList.add("ring-4", "ring-indigo-400", "scale-[1.01]");
        setTimeout(() => {
          bubble.classList.remove("ring-4", "ring-indigo-400", "scale-[1.01]");
        }, 1200);
      }
    } else {
      toast.error("Original message not found in active view feed");
    }
  };

  // String parsing for reply quoting metadata block
  const parseQuotedReply = (content: string) => {
    const regex = /^\[REPLY_TO:([^:]+):::([\s\S]+?):::([^\]]+)\]\s*([\s\S]*)$/;
    const match = content.match(regex);
    if (match) {
      return {
        isReply: true,
        quotedAuthor: match[1],
        quotedContent: match[2],
        quotedNoteId: match[3],
        actualContent: match[4]
      };
    }
    return {
      isReply: false,
      quotedAuthor: "",
      quotedContent: "",
      quotedNoteId: "",
      actualContent: content
    };
  };

  // Align positioning variables so menu stays safe on viewport
  const menuWidth = 320;
  const menuHeight = 50;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 1000;

  let leftPos = contextMenu ? contextMenu.mouseX : 0;
  let topPos = contextMenu ? contextMenu.mouseY : 0;

  if (leftPos + menuWidth > viewportWidth) {
    leftPos = viewportWidth - menuWidth - 16;
  }
  if (leftPos < 16) {
    leftPos = 16;
  }
  if (topPos + menuHeight > viewportHeight) {
    topPos = viewportHeight - menuHeight - 16;
  }
  if (topPos < 16) {
    topPos = 16;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-app-bg-soft">
      <div className="max-w-3xl mx-auto space-y-4 pb-4">
        <div className="flex justify-center my-2 flex-col items-center gap-1.5 text-center">
          <span className="text-[11px] font-semibold text-app-text-muted bg-app-surface/60 px-3 py-1 rounded-full uppercase tracking-wider border border-app select-none">
            Interactive Workspace Feed
          </span>
          <span className="text-[10px] text-app-text-muted/80 font-medium select-none bg-indigo-50/50 dark:bg-slate-900/40 px-2.5 py-0.5 rounded-full border border-indigo-100/30">
            💡 Touch/click a bubble once to react, or hold (long press) a bubble to Reply/Copy!
          </span>
        </div>

        <div className="space-y-4">
          {notesLoading ? (
            <div className="text-center py-10 text-sm text-app-text-muted bg-app-surface border border-app rounded-xl shadow-xs">
              <div className="animate-pulse flex flex-col items-center justify-center gap-2">
                <div className="h-4 w-24 bg-app-bg-soft rounded"></div>
                <div className="text-xs text-app-text-muted">
                  Loading timeline...
                </div>
              </div>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 px-6 text-sm text-app-text-muted bg-app-surface border border-app rounded-xl shadow-sm">
              <div className="w-12 h-12 bg-app-primary-soft rounded-full flex items-center justify-center text-app-primary mx-auto mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="font-semibold text-app-text text-base">
                No previous communication history
              </p>
              <p className="text-app-text-muted text-xs mt-1 mb-4">
                Start collaboration by sending an internal team note below.
              </p>

              <div className="border-t border-app pt-4 max-w-md mx-auto">
                <p className="text-xs font-semibold text-app-text-muted mb-2">
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
                      onClick={() => handleSendNote(suggestion)}
                      className="text-xs p-2 bg-app-surface hover:bg-app-primary-soft text-app-text hover:text-app-primary border border-app hover:border-app-primary/30 rounded-lg text-left transition cursor-pointer"
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
              const activeReactions = Object.entries(msgReactions).filter(
                ([_, count]) => count > 0
              );

              // Parse custom formatting for embedded replies
              const parsedReply = parseQuotedReply(note.content);

              return (
                <div
                  key={note.id}
                  id={`note-${note.id}`}
                  className={`flex gap-3 max-w-full group scroll-mt-24 transition-all duration-300 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <div className="flex-shrink-0 self-end mb-1">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-xs uppercase">
                        {note.authorName ? note.authorName.charAt(0).toUpperCase() : "?"}
                      </div>
                    </div>
                  )}

                  <div
                    className={`flex flex-col max-w-[80%] ${
                      activeReactions.length > 0 ? "mb-3" : ""
                    } ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-app-text-muted">
                      <span className="font-medium text-app-text-muted">
                        {isMe ? "You" : note.authorName}
                      </span>
                      <span>•</span>
                      <span>{note.createdAt}</span>
                    </div>

                    <div
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePressEnd(e, note.id);
                      }}
                      onMouseDown={(e) => handlePressStart(e, note.id, note)}
                      onMouseUp={(e) => handlePressEnd(e, note.id)}
                      onMouseLeave={() => {
                        if (pressTimer.current) {
                          clearTimeout(pressTimer.current);
                          pressTimer.current = null;
                        }
                      }}
                      onTouchStart={(e) => handlePressStart(e, note.id, note)}
                      onTouchEnd={(e) => handlePressEnd(e, note.id)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className={`relative p-3.5 rounded-2xl cursor-pointer select-none ring-offset-app-bg transition-all duration-300 active:scale-[0.98] ${
                        isMe
                          ? "bg-app-primary text-white rounded-tr-none shadow-sm hover:brightness-110"
                          : "bg-app-surface text-app-text border border-app rounded-tl-none shadow-xs hover:bg-app-bg"
                      }`}
                      id={`bubble-${note.id}`}
                      title="Tap once to react. Hold message to see options."
                    >
                      {/* Quoted Reply Reference Box */}
                      {parsedReply.isReply && (
                        <div
                          onMouseDown={(e) => e.stopPropagation()}
                          onMouseUp={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onTouchEnd={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScrollToMessage(parsedReply.quotedNoteId);
                          }}
                          className={`px-3 py-1.5 border-l-4 rounded-lg mb-2 text-[11px] text-left cursor-pointer transition-all hover:opacity-90 ${
                            isMe
                              ? "bg-white/10 border-white/50 text-indigo-50 hover:bg-white/15"
                              : "bg-app-bg border-indigo-500 text-app-text-muted dark:bg-app-surface/60 hover:bg-app-primary-soft/40"
                          }`}
                          title="Click to jump to quoted note"
                        >
                          <div className={`font-bold text-[10px] uppercase tracking-wider mb-0.5 ${isMe ? "text-cyan-200" : "text-app-primary"}`}>
                            ↪ {parsedReply.quotedAuthor}
                          </div>
                          <div className="truncate max-w-[200px] md:max-w-md italic select-none">
                            {parsedReply.quotedContent}
                          </div>
                        </div>
                      )}

                      <p className="text-sm leading-relaxed whitespace-pre-wrap select-text">
                        {parsedReply.actualContent}
                      </p>

                      {note.conversationId && 
                        note.leadName !== "Team Collaboration" && 
                        note.leadName !== "INTERNAL_COLLAB" && (
                          <div
                            className={`flex items-center gap-1.5 pt-2 border-t mt-2 ${
                              isMe ? "border-white/20" : "border-app"
                            }`}
                          >
                            <span
                              className={`text-[10px] ${isMe ? "text-cyan-100" : "text-app-text-muted"}`}
                            >
                              Client:
                            </span>
                            <a
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              href={`/dashboard/conversations?id=${note.conversationId}`}
                              className={`text-[10px] font-semibold rounded-md px-2 py-0.5 border flex items-center gap-1 transition-all ${
                                isMe
                                  ? "bg-white/10 text-white border-white/20 hover:bg-white/20"
                                  : "bg-app-primary-soft text-app-primary border-app-primary/20 hover:bg-app-primary-soft/80"
                              }`}
                            >
                              <ExternalLink className="w-3 h-3" />
                              Lead: {note.leadName || "customer"}
                            </a>
                          </div>
                      )}

                      {/* Reaction pill overlays */}
                      {activeReactions.length > 0 && (
                        <div
                          className={`absolute bottom-[-11px] ${
                            isMe ? "right-3" : "left-3"
                          } flex items-center gap-1 z-10`}
                        >
                          {activeReactions.map(([emoji, count]) => (
                            <button
                              key={emoji}
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onMouseUp={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleReaction(note.id, emoji);
                              }}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold select-none shadow-md border hover:scale-105 transition active:scale-95 cursor-pointer ${
                                isMe
                                  ? "bg-indigo-600 text-white border-indigo-500/30"
                                  : "bg-app-surface text-app-text border-app-primary/15"
                              }`}
                              title="Click to react with this emoji"
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-black">{count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {isMe && (
                    <div className="flex-shrink-0 self-end mb-1">
                      <div className="w-8 h-8 rounded-full bg-app-primary-soft text-app-primary font-bold text-xs flex items-center justify-center shadow-xs uppercase border border-app-primary/20 animate-fade-in">
                        {note.authorName ? note.authorName.charAt(0).toUpperCase() : "ME"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Reaction Emojis Popup Dialog bar */}
      {contextMenu && (
        <div
          className="fixed bg-app-surface border border-app rounded-full shadow-[0_10px_35px_rgba(0,0,0,0.18)] z-[999] p-1.5 flex items-center gap-1.5 animate-scale-up border-indigo-100/40"
          style={{
            top: `${topPos}px`,
            left: `${leftPos}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                handleToggleReaction(contextMenu.noteId, emoji);
                setContextMenu(null);
              }}
              className="text-xl hover:scale-125 active:scale-90 p-1 rounded-full hover:bg-app-bg transition-all cursor-pointer select-none"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* WhatsApp Message Holding Actions Modal */}
      {optionsModal.isOpen && optionsModal.note && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-[1001] p-4 animate-fade-in"
          onClick={() => setOptionsModal({ isOpen: false, noteId: "", note: null })}
        >
          <div 
            className="w-full max-w-xs bg-app-surface border border-app rounded-2xl shadow-2xl overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Content Preview */}
            <div className="bg-app-bg-soft p-4 border-b border-app">
              <span className="text-[10px] font-bold text-app-text-muted uppercase tracking-wider block mb-1 select-none">
                Note by {optionsModal.note.authorName}
              </span>
              <p className="text-xs text-app-text-muted italic line-clamp-2 leading-relaxed">
                "{optionsModal.note.content.replace(/^\[REPLY_TO:[^\]]+\]\s*/, "")}"
              </p>
            </div>

            {/* List Action Buttons */}
            <div className="p-2 space-y-1 bg-app-surface">
              {/* REPLY ACTION */}
              <button
                type="button"
                onClick={() => {
                  if (optionsModal.note) {
                    setReplyToNote(optionsModal.note);
                    toast.success(`Replying to ${optionsModal.note.authorName}`);
                  }
                  setOptionsModal({ isOpen: false, noteId: "", note: null });
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 text-xs font-bold text-app-text transition cursor-pointer text-left"
              >
                <CornerUpLeft className="w-4 h-4 text-app-text-muted" />
                <span>Reply / Quote Msg</span>
              </button>

              {/* SEE REACTIONS DETAIL */}
              <button
                type="button"
                onClick={() => {
                  const id = optionsModal.noteId;
                  setOptionsModal({ isOpen: false, noteId: "", note: null });
                  openReactionDetails(id);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950/40 dark:hover:text-teal-400 text-xs font-bold text-app-text transition cursor-pointer text-left"
              >
                <Smile className="w-4 h-4 text-app-text-muted" />
                <span>Who Reacted?</span>
              </button>

              {/* COPY CONTENT */}
              <button
                type="button"
                onClick={() => {
                  if (optionsModal.note) {
                    const cleanText = optionsModal.note.content.replace(/^\[REPLY_TO:[^\]]+\]\s*/, "");
                    navigator.clipboard.writeText(cleanText);
                    toast.success("Copied message to clipboard!");
                  }
                  setOptionsModal({ isOpen: false, noteId: "", note: null });
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-app-bg text-xs font-bold text-app-text transition cursor-pointer text-left"
              >
                <Copy className="w-4 h-4 text-app-text-muted" />
                <span>Copy Message Text</span>
              </button>

              <div className="border-t border-app my-2"></div>

              {/* CANCEL BUTTON */}
              <button
                type="button"
                onClick={() => setOptionsModal({ isOpen: false, noteId: "", note: null })}
                className="w-full text-center py-2 text-xs font-extrabold text-app-text-muted hover:text-red-500 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reactions Details Modal Overlay */}
      {activeReactionDetail && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-[1000] p-4 animate-fade-in animate-duration-150"
          onClick={() => setActiveReactionDetail(null)}
        >
          <div 
            className="w-full max-w-sm bg-app-surface border border-app rounded-2xl shadow-2xl p-4 overflow-hidden animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-app">
              <h3 className="text-sm font-bold text-app-text select-none">Message Reactions</h3>
              <button 
                onClick={() => setActiveReactionDetail(null)}
                className="text-xs font-bold text-app-text-muted hover:text-p-hover bg-app-bg px-2.5 py-1 rounded-full transition active:scale-95 cursor-pointer border border-app"
              >
                Close
              </button>
            </div>

            {/* Tap selector tabs like WhatsApp */}
            <div className="flex items-center gap-1.5 py-2.5 border-b border-app overflow-x-auto select-none no-scrollbar">
              <button
                onClick={() => setDetailTab("All")}
                className={`text-xs px-3 py-1 font-semibold rounded-full transition cursor-pointer shrink-0 ${
                  detailTab === "All"
                    ? "bg-app-primary text-white"
                    : "bg-app-bg text-app-text-muted hover:text-app-text"
                }`}
              >
                All {activeReactionDetail.allReactions.length}
              </button>

              {/* Find unique emojis from reactions list */}
              {Array.from(new Set(activeReactionDetail.allReactions.map(r => r.emoji))).map((emoji) => {
                const count = activeReactionDetail.allReactions.filter(r => r.emoji === emoji).length;
                return (
                  <button
                    key={emoji}
                    onClick={() => setDetailTab(emoji)}
                    className={`text-xs px-2.5 py-1 font-semibold rounded-full transition cursor-pointer flex items-center gap-1 shrink-0 ${
                      detailTab === emoji
                        ? "bg-app-primary text-white"
                        : "bg-app-bg text-app-text-muted hover:text-app-text"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span className="text-[10px] font-bold">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* User reacting profile list */}
            <div className="pt-2 max-h-60 overflow-y-auto space-y-2 select-text">
              {activeReactionDetail.allReactions
                .filter(r => detailTab === "All" || r.emoji === detailTab)
                .map((react, idx) => {
                  const isMe = react.userId === user?.id;
                  const initials = react.name ? react.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "?";
                  
                  return (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-app-bg-soft transition duration-150">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold uppercase ring-2 ring-indigo-100 shadow-xs">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-app-text">
                            {react.name} {isMe ? "(You)" : ""}
                          </span>
                          <span className="text-[9px] text-app-text-muted">Reacted dynamically</span>
                        </div>
                      </div>
                      <div className="bg-app-surface border border-app shadow-xs w-7 h-7 flex items-center justify-center rounded-full text-base">
                        {react.emoji}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
