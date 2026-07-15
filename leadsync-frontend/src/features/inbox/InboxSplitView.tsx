import { useState } from "react";
import InboxList from "./InboxList";
import InboxDetail from "./InboxDetail";

interface InboxSplitViewProps {
  initialLeadId?: string | null;
}

export default function InboxSplitView({ initialLeadId = null }: InboxSplitViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialLeadId);

  return (
    <div className="flex h-full w-full min-h-0 overflow-hidden">
      {/* Left column: fixed 380px, scrollable, full-height border */}
      <div
        className="flex-shrink-0 min-h-0 overflow-y-auto border-r border-slate-800 h-full"
        style={{ width: "380px" }}
      >
        <InboxList
          selectedLeadId={selectedLeadId}
          onSelectLead={(leadId: string) => setSelectedLeadId(leadId)}
        />
      </div>

      {/* Right column: fills remaining width */}
      <div className="flex-1 min-h-0 overflow-hidden h-full">
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