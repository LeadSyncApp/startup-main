import { MessageSquare, ExternalLink, ThumbsUp } from "lucide-react";
import { NoteData } from "../internal-note/InternalNote";

interface Props {
  notesLoading: boolean;
  notes: NoteData[];
  user: any;
  reactions: Record<string, Record<string, number>>;
  handleToggleReaction: (noteId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleSendNote: (text: string) => void;
}

export function AgentChatFeed({
  notesLoading,
  notes,
  user,
  reactions,
  handleToggleReaction,
  messagesEndRef,
  handleSendNote,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-app-bg-soft">
      <div className="max-w-3xl mx-auto space-y-4 pb-4">
        <div className="flex justify-center my-2">
          <span className="text-[11px] font-semibold text-app-text-muted bg-app-surface/60 px-3 py-1 rounded-full uppercase tracking-wider border border-app">
            Interactive Workspace Feed
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
                      className="text-xs p-2 bg-app-bg hover:bg-app-primary-soft text-app-text hover:text-app-primary border border-app hover:border-app-primary/30 rounded-lg text-left transition"
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
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-app-text-muted">
                      <span className="font-medium text-app-text-muted">
                        {isMe ? "You" : note.authorName}
                      </span>
                      <span>•</span>
                      <span>{note.createdAt}</span>
                    </div>

                    <div
                      className={`relative p-3.5 rounded-2xl ${
                        isMe
                          ? "bg-app-primary text-white rounded-tr-none shadow-sm"
                          : "bg-app-surface text-app-text border border-app rounded-tl-none shadow-xs"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>

                      {note.conversationId && (
                        <div
                          className={`flex items-center gap-1.5 pt-2 border-t mt-2 ${
                            isMe ? "border-white/20" : "border-app"
                          }`}
                        >
                          <span
                            className={`text-[10px] ${isMe ? "text-cyan-100" : "text-app-text-muted"}`}
                          >
                            Client context:
                          </span>
                          <a
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

                      <div className="flex items-center gap-1 mt-2.5">
                        <button
                          onClick={() => handleToggleReaction(note.id, "👍")}
                          className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 transition ${
                            msgReactions["👍"]
                              ? isMe
                                ? "bg-white/20 border-white/30 text-white"
                                : "bg-app-primary-soft border-app-primary/30 text-app-primary"
                              : isMe
                                ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                                : "bg-app-bg border-app text-app-text-muted hover:bg-app-bg-soft"
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
                      <div className="w-8 h-8 rounded-full bg-app-primary-soft text-app-primary font-bold text-xs flex items-center justify-center shadow-xs uppercase border border-app-primary/20">
                        {note.authorInitials || "ME"}
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
    </div>
  );
}
