import React, { useState } from "react";
import { Paperclip, Send, Smile, Image as ImageIcon } from "lucide-react";

interface MessageComposerProps {
  onSend: (text: string) => void;
  placeholder?: string;
  isSubmitting?: boolean;
}

export function MessageComposer({ onSend, placeholder = "Type a message...", isSubmitting = false }: MessageComposerProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim() && !isSubmitting) {
      onSend(text.trim());
      setText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t border-[#D9DADC] p-4">
      <div className="flex flex-col border border-[#D9DADC] rounded-md focus-within:ring-1 focus-within:ring-[#0052CC] focus-within:border-[#0052CC] transition-shadow shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="w-full resize-none p-3 text-sm text-[#1F2937] placeholder-[#6B7280] bg-transparent outline-none min-h-[80px]"
        />
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-[#D9DADC] rounded-b-md">
          <div className="flex items-center gap-1">
            <button className="p-1.5 text-[#6B7280] hover:text-[#1F2937] hover:bg-slate-200 rounded transition min-w-[32px] min-h-[32px] flex items-center justify-center">
              <Paperclip className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[#6B7280] hover:text-[#1F2937] hover:bg-slate-200 rounded transition min-w-[32px] min-h-[32px] flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[#6B7280] hover:text-[#1F2937] hover:bg-slate-200 rounded transition min-w-[32px] min-h-[32px] flex items-center justify-center">
              <Smile className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!text.trim() || isSubmitting}
            className="flex items-center justify-center gap-2 px-4 py-1.5 bg-[#0052CC] text-white text-sm font-semibold rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px] min-h-[36px]"
          >
            {isSubmitting ? "Sending" : "Send"}
            <Send className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
