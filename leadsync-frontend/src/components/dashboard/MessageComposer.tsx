import { Send } from "lucide-react";
import { useState } from "react";

interface MessageComposerProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function MessageComposer({ onSend, isLoading = false, placeholder = "Write a message..." }: MessageComposerProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex gap-2 items-end p-4 bg-app-surface border-t border-[#D9DADC]">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        rows={3}
        className="flex-1 px-3 py-2 border border-[#D9DADC] rounded-md text-sm resize-none outline-none focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] transition-shadow placeholder-[#6B7280]"
        disabled={isLoading}
      />
      <button
        onClick={handleSend}
        disabled={isLoading || !message.trim()}
        className="p-2 bg-[#0052CC] text-white rounded-md hover:bg-[#0844A3] disabled:bg-[#D9DADC] transition min-w-[36px] min-h-[36px] flex items-center justify-center"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
