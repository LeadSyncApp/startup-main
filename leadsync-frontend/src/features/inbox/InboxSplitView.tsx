import { useState, useEffect } from "react";
import InboxList from "./InboxList";
import InboxDetail from "./InboxDetail";

interface InboxSplitViewProps {
  initialLeadId?: string | null;
}

export default function InboxSplitView({ initialLeadId = null }: InboxSplitViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId);

  // Broadcast the currently-open conversation so other surfaces (e.g. the
  // "My Chats" sidebar badge) can exclude it from unread counts on the SAME
  // tick the chat row reacts — no waiting on a server round-trip. Fires on
  // open, on switch, and with null when the conversation is closed.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("conversation:open", { detail: { leadId: selectedLeadId } })
    );
  }, [selectedLeadId]);

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* Left column: fixed 320px, scrollable, full-height border */}
      <div className="w-[320px] shrink-0 min-h-0 overflow-y-auto border-r border-[var(--app-border)] h-full bg-app-surface flex flex-col">
        <InboxList
          selectedLeadId={selectedLeadId}
          onSelectLead={(leadId: string) => setSelectedLeadId(leadId)}
        />
      </div>

      {/* Right column: fills remaining width flexibly */}
      <div data-tour="chat-detail-panel" className="flex-1 min-w-0 min-h-0 overflow-hidden h-full flex flex-col relative">
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