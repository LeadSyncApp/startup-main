import { Sparkles, Tag, X, ChevronDown } from "lucide-react";
import { MessageComposer } from "@/pages/dashboard/message-composer/MessageComposer";
import { UserData } from "./types";
import { useState, useEffect } from "react";
import { api } from "../../../lib/api";

import { NoteData } from "../internal-note/InternalNote";

interface Props {
  selectedAgent: UserData;
  isSubmittingMessage: boolean;
  handleSendNote: (text: string, conversationId?: string) => void;
  replyToNote: NoteData | null;
  setReplyToNote: (n: NoteData | null) => void;
}

export function AgentChatFooter({
  selectedAgent,
  isSubmittingMessage,
  handleSendNote,
  replyToNote,
  setReplyToNote,
}: Props) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    api.get("/conversations")
      .then((res) => {
        if (res && Array.isArray(res.items)) {
          // Exclude direct team internal conversations from the list of leads to tag
          const filtered = res.items.filter(
            (c: any) => c.lead?.contact !== "INTERNAL_COLLAB"
          );
          setConversations(filtered);
        }
      })
      .catch((err) =>
        console.error("Could not fetch active conversations for tagging selector:", err)
      );
  }, []);

  return (
    <>
      {/* Collaboration Chips */}
      <div className="px-4 py-2.5 bg-app-surface border-t border-app flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-app-text-muted uppercase tracking-widest flex items-center gap-1 select-none">
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
            onClick={() => {
              handleSendNote(chip.text, selectedConv?.id);
              setSelectedConv(null);
            }}
            className="text-[11px] font-semibold px-2.5 py-1 bg-app-bg hover:bg-app-primary-soft text-app-text-muted hover:text-app-primary border border-app hover:border-app-primary/30 rounded-full transition-all shadow-xs cursor-pointer select-none active:scale-95"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Dynamic Tagging Tool Area */}
      <div className="px-4 py-2 bg-app-bg-soft border-t border-app flex items-center justify-between">
        {selectedConv ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-app-text-muted select-none">
              Linked Client:
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-app-primary bg-app-primary-soft/80 border border-app-primary/20 px-2.5 py-1 rounded-lg font-semibold animate-fade-in animate-duration-200">
              <Tag className="w-3 h-3" />
              {selectedConv.lead?.name || "Customer"}{" "}
              {selectedConv.lead?.contact ? ` (${selectedConv.lead.contact})` : ""}
              <button
                onClick={() => setSelectedConv(null)}
                className="text-app-primary hover:text-red-500 font-bold ml-1 hover:bg-app-primary-soft p-0.5 rounded-full"
                title="Remove link"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 text-xs text-app-text-muted hover:text-app-text bg-app-surface hover:bg-app-bg px-3 py-1.5 border border-app rounded-lg transition active:scale-95 shadow-xs"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Tag Client Conversation...</span>
              <ChevronDown className="w-3 h-3 text-app-text-muted" />
            </button>

            {showDropdown && (
              <div className="absolute left-0 bottom-full mb-2 bg-app-surface border border-app rounded-xl shadow-xl w-64 max-h-56 overflow-y-auto z-50 p-2 animate-fade-in animate-duration-200">
                <div className="pb-2 border-b border-app mb-2">
                  <input
                    type="text"
                    placeholder="Search active leads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-app rounded-md outline-none bg-app-bg focus:ring-1 focus:ring-app-primary text-app-text"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  {conversations.filter((c: any) => {
                    const name = c.lead?.name || "";
                    const contact = c.lead?.contact || "";
                    return (
                      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      contact.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                  }).length === 0 ? (
                    <p className="text-[11px] text-app-text-muted text-center py-4">
                      No active assigned leads found
                    </p>
                  ) : (
                    conversations
                      .filter((c: any) => {
                        const name = c.lead?.name || "";
                        const contact = c.lead?.contact || "";
                        return (
                          name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          contact.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                      })
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedConv(c);
                            setShowDropdown(false);
                            setSearchQuery("");
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-app-bg text-xs flex flex-col gap-0.5 text-app-text transition"
                        >
                          <span className="font-bold">{c.lead?.name || "Customer"}</span>
                          <span className="text-[10px] text-app-text-muted">
                            {c.lead?.contact} ({c.lead?.channel || "Web"})
                          </span>
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="text-[10px] text-app-text-muted italic select-none">
          Context is completely optional.
        </div>
      </div>

      {/* WhatsApp style Reply preview box */}
      {replyToNote && (
        <div className="mx-4 my-2 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border-l-4 border-indigo-500 rounded-lg flex items-start justify-between gap-3 animate-fade-in relative z-20">
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 block leading-tight select-none">
              Replying to {replyToNote.authorName}
            </span>
            <span className="text-xs text-app-text-muted truncate max-w-[90%] block mt-0.5 whitespace-nowrap overflow-hidden">
              {replyToNote.content.replace(/^\[REPLY_TO:[^\]]+\]\s*/, "")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setReplyToNote(null)}
            className="p-1.5 text-app-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition cursor-pointer shrink-0"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Composer Input */}
      <MessageComposer
        onSend={(text) => {
          handleSendNote(text, selectedConv?.id);
          setSelectedConv(null);
        }}
        isLoading={isSubmittingMessage}
        placeholder={`Send an instant note to ${selectedAgent.name.split(" ")[0]}...`}
      />
    </>
  );
}
