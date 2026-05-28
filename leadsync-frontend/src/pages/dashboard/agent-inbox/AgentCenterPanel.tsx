import React from "react";
import { MoreHorizontal, Trash, Volume2, ArrowLeft } from "lucide-react";
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
  handleToggleReaction: (noteId: string, emoji: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  isSubmittingMessage: boolean;
  handleSendNote: (text: string) => void;
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
  handleToggleReaction,
  messagesEndRef,
  isSubmittingMessage,
  handleSendNote,
}: Props) {
  return (
    <div
      className={`flex-1 flex-col bg-[#F4F6F8] ${mobileView === "detail" ? "flex z-10 absolute inset-0 lg:relative lg:flex" : "hidden lg:flex"}`}
    >
      {selectedAgent ? (
        <>
          <div className="flex items-center justify-between p-4 border-b border-[#E6E9EE] bg-app-bg sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileView("list")}
                className="lg:hidden p-1 -ml-2 text-[#6B7280] hover:bg-slate-100 rounded-md"
                title="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold uppercase">
                {selectedAgent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F2937]">{selectedAgent.name}</h3>
                <p className="text-xs text-slate-500">{selectedAgent.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Disable sound" : "Enable sound"}
                className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="More"
                className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleDeleteChat(false)}
                title="Delete chat"
                className="p-2 rounded-md text-red-600 hover:bg-red-50"
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
            handleToggleReaction={handleToggleReaction}
            messagesEndRef={messagesEndRef}
            handleSendNote={handleSendNote}
          />

          <div className="border-t border-[#E6E9EE] bg-app-bg">
            <AgentChatFooter
              selectedAgent={selectedAgent}
              isSubmittingMessage={isSubmittingMessage}
              handleSendNote={handleSendNote}
            />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <p className="text-sm font-medium">Select a team member to start collaborating.</p>
            <p className="text-xs text-slate-400 mt-2">Open an existing chat or start a new one from the left.</p>
          </div>
        </div>
      )}
    </div>
  );
}
