import { Sparkles } from "lucide-react";
import { MessageComposer } from "@/pages/dashboard/message-composer/MessageComposer";
import { UserData } from "./types";

interface Props {
  selectedAgent: UserData;
  isSubmittingMessage: boolean;
  handleSendNote: (text: string) => void;
}

export function AgentChatFooter({
  selectedAgent,
  isSubmittingMessage,
  handleSendNote,
}: Props) {
  return (
    <>
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
            onClick={() => handleSendNote(chip.text)}
            className="text-[11px] font-semibold px-2.5 py-1 bg-app-bg hover:bg-app-primary-soft text-app-text-muted hover:text-app-primary border border-app hover:border-app-primary/30 rounded-full transition-all shadow-xs cursor-pointer select-none active:scale-95"
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
  );
}
