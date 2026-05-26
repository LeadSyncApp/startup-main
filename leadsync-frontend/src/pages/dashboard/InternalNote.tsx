import { Clock } from "lucide-react";

export interface NoteData {
  id: string;
  authorName: string;
  authorInitials: string;
  content: string;
  createdAt: string;
  isSystem?: boolean;
}

interface InternalNoteProps {
  note: NoteData;
}

export function InternalNote({ note }: InternalNoteProps) {
  if (note.isSystem) {
    return (
      <div className="flex gap-3 py-3 px-4 bg-slate-50 border border-slate-100 rounded-md text-sm text-[#6B7280]">
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
    <div className="flex gap-3 py-3">
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
        <div className="text-sm text-[#1F2937] bg-white border border-[#D9DADC] p-3 rounded-md rounded-tl-none leading-relaxed shadow-sm">
          {note.content}
        </div>
      </div>
    </div>
  );
}
