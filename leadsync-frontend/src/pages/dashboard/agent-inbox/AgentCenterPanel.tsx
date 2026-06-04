import React from "react";
import { MoreHorizontal, Trash, Volume2, ArrowLeft, Users } from "lucide-react";
import { AgentChatFeed } from "./AgentChatFeed";
import { AgentChatFooter } from "./AgentChatFooter";
import { UserData } from "./types";
import { NoteData } from "../internal-note/InternalNote";

interface Props {
  mobileView: "list" | "detail" | "context";
  setMobileView: React.Dispatch<React.SetStateAction<"list" | "detail" | "context">>;
  selectedAgent: UserData | null;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  isMoreMenuOpen: boolean;
  setIsMoreMenuOpen: (v: boolean) => void;
  handleDeleteChat: (bothSides: boolean) => void;
  notesLoading: boolean;
  notes: NoteData[];
  user: any;
  reactions: Record<string, Record<string, number>>;
  reactionsDetail: Record<string, Record<string, Array<{ id: string; name: string }>>>;
  handleToggleReaction: (noteId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isSubmittingMessage: boolean;
  handleSendNote: (text: string, conversationId?: string) => void;
  replyToNote: NoteData | null;
  setReplyToNote: (n: NoteData | null) => void;
}

export function AgentCenterPanel({
  mobileView,
  setMobileView,
  selectedAgent,
  soundEnabled,
  setSoundEnabled,
  isMoreMenuOpen,
  setIsMoreMenuOpen,
  handleDeleteChat,
  notesLoading,
  notes,
  user,
  reactions,
  reactionsDetail,
  handleToggleReaction,
  messagesEndRef,
  isSubmittingMessage,
  handleSendNote,
  replyToNote,
  setReplyToNote,
}: Props) {
  return (
    <div
      className={`flex-1 flex-col bg-app-bg-soft ${mobileView === "detail" ? "flex z-10 absolute inset-0 lg:relative lg:flex" : "hidden lg:flex"}`}
    >
      {selectedAgent ? (
        <>
          <div className="flex items-center justify-between p-4 border-b border-app bg-app-surface sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileView("list")}
                className="lg:hidden p-1 -ml-2 text-app-text-muted hover:bg-app-bg-soft rounded-md"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold uppercase ring-2 ring-app-bg-soft">
                {selectedAgent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-app-text">{selectedAgent.name}</h3>
                <p className="text-xs text-app-text-muted">{selectedAgent.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Disable sound" : "Enable sound"}
                className="p-2 rounded-md text-app-text-muted hover:bg-app-bg-soft"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="More"
                className="p-2 rounded-md text-app-text-muted hover:bg-app-bg-soft"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteChat(false)}
                title="Delete chat"
                className="p-2 rounded-md text-red-500 hover:bg-red-500/10"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>
          </div>

          <AgentChatFeed
            notesLoading={notesLoading}
            notes={notes}
            user={user}
            reactions={reactions}
            reactionsDetail={reactionsDetail}
            handleToggleReaction={handleToggleReaction}
            messagesEndRef={messagesEndRef}
            handleSendNote={handleSendNote}
            setReplyToNote={setReplyToNote}
          />

          <div className="border-t border-app bg-app-surface">
            <AgentChatFooter
              selectedAgent={selectedAgent}
              isSubmittingMessage={isSubmittingMessage}
              handleSendNote={handleSendNote}
              replyToNote={replyToNote}
              setReplyToNote={setReplyToNote}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-app-text-muted bg-app-bg-soft">
          <div className="text-center p-8 bg-app-surface rounded-3xl border border-app shadow-xl max-w-sm">
            <div className="w-16 h-16 bg-app-primary-soft rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-app-primary" />
            </div>
            <p className="text-base font-bold text-app-text">Team Collaboration</p>
            <p className="text-sm text-app-text-muted mt-2 leading-relaxed">Select a teammate from the left panel to start sharing internal notes and updates.</p>
          </div>
        </div>
      )}
    </div>
  );
}
