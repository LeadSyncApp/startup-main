import { useState, useEffect } from "react";
import InboxList from "./InboxList";
import InboxDetail from "./InboxDetail";
import { ArrowLeft } from "lucide-react";

interface InboxSplitViewProps {
  initialLeadId?: string | null;
}

export default function InboxSplitView({ initialLeadId = null }: InboxSplitViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId);
  const [isMobileDetail, setIsMobileDetail] = useState(false);

  // Broadcast the currently-open conversation so other surfaces (e.g. the
  // "My Chats" sidebar badge) can exclude it from unread counts on the SAME
  // tick the chat row reacts — no waiting on a server round-trip. Fires on
  // open, on switch, and with null when the conversation is closed.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("conversation:open", { detail: { leadId: selectedLeadId } })
    );
  }, [selectedLeadId]);

  const handleSelectLead = (leadId: string) => {
    setSelectedLeadId(leadId);
    setIsMobileDetail(true);
  };

  const handleBackToList = () => {
    setIsMobileDetail(false);
  };

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* Left column: list panel - hidden on mobile when detail is open */}
      <div className={`${isMobileDetail ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] shrink-0 min-h-0 overflow-y-auto border-r border-[var(--app-border)] h-full bg-app-surface flex-col`}>
        <InboxList
          selectedLeadId={selectedLeadId}
          onSelectLead={handleSelectLead}
        />
      </div>

      {/* Right column: detail panel - hidden on mobile when list is showing */}
      <div data-tour="chat-detail-panel" className={`${!isMobileDetail ? 'hidden md:flex' : 'flex'} flex-1 min-w-0 min-h-0 overflow-hidden h-full flex-col relative`}>
        {/* Mobile back button */}
        <button
          onClick={handleBackToList}
          className="md:hidden absolute top-3 left-3 z-10 p-2 rounded-lg bg-[var(--app-surface)] border border-[var(--app-border)] shadow-sm cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[var(--app-text)]" />
        </button>
        {selectedLeadId ? (
          <InboxDetail leadId={selectedLeadId} showBackButton={false} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-slate-500">Select a conversation to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}