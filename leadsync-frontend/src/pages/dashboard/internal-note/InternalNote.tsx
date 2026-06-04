import { Clock } from "lucide-react";

export interface NoteData {
  id: string;
  authorName: string;
  authorInitials: string;
  content: string;
  createdAt: string;
  isSystem?: boolean;
  conversationId?: string;
  leadName?: string;
  authorId?: string;
}

interface InternalNoteProps {
  note: NoteData;
}

export function InternalNote({ note }: InternalNoteProps) {
  if (note.isSystem) {
    return (
      <div className="flex gap-3 py-3 px-4 bg-app-bg border border-app rounded-md text-sm text-[#6B7280] font-['Inter',sans-serif]">
        <div className="mt-0.5">
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <Clock className="w-3 h-3 text-slate-500" />
          </div>
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-700">{note.content}</p>
          <span className="text-xs text-slate-400 mt-1 block">{note.createdAt}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-3 font-['Inter',sans-serif]">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0052CC] font-bold text-xs flex items-center justify-center border border-blue-200">
          {note.authorInitials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-[#1F2937] truncate">{note.authorName}</span>
          <span className="text-xs text-[#6B7280] whitespace-nowrap">{note.createdAt}</span>
        </div>
        <div className="text-sm text-[#1F2937] bg-app-surface border border-[#D9DADC] p-3 rounded-md rounded-tl-none leading-relaxed shadow-sm">
          <div>{note.content}</div>
          {note.conversationId && 
            note.leadName !== "Team Collaboration" && 
            note.leadName !== "INTERNAL_COLLAB" && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-app mt-1.5">
              <span className="text-[10px] text-slate-400">Context:</span>
              <a 
                href={`/dashboard/conversations?id=${note.conversationId}`}
                className="text-[10px] font-semibold text-[#0052CC] hover:underline bg-blue-50/50 px-2 py-0.5 rounded border border-blue-100"
              >
                Lead: {note.leadName || "customer"}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

