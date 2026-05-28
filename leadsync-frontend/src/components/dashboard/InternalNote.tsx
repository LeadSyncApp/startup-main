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
      <div className="flex gap-3 py-3 px-4 bg-app-bg border border-app-border rounded-md text-sm text-app-muted font-['Inter',sans-serif]">
        <div className="mt-0.5">
          <div className="w-6 h-6 rounded-full bg-app-bg-soft flex items-center justify-center">
            <Clock className="w-3 h-3 text-app-muted" />
          </div>
        </div>
        <div className="flex-1">
          <p className="font-medium text-app-text">{note.content}</p>
          <span className="text-xs text-slate-400 mt-1 block">{note.createdAt}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-3 font-['Inter',sans-serif]">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-app-primary/10 text-app-primary font-bold text-xs flex items-center justify-center border border-app-primary/20">
          {note.authorInitials}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-sm font-bold text-app-text truncate">{note.authorName}</span>
          <span className="text-xs text-app-muted whitespace-nowrap">{note.createdAt}</span>
        </div>
        <div className="text-sm text-app-text bg-app-surface border border-app-border p-3 rounded-md rounded-tl-none leading-relaxed shadow-sm">
          <div>{note.content}</div>
          {note.conversationId && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-app-border mt-1.5">
              <span className="text-[10px] text-slate-400">Context:</span>
              <a 
                href={`/dashboard/conversations?id=${note.conversationId}`}
                className="text-[10px] font-semibold text-app-primary hover:underline bg-app-primary/10 px-2 py-0.5 rounded border border-app-primary/20"
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

