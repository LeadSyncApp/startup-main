import { useState } from 'react';
import { SavedRepliesPopup } from './SavedReplies';
import { IconButton } from './ContactIntelligence';

interface MessageComposerProps {
  isLocked: boolean;
  currentConvMode: 'BOT' | 'HUMAN';
  onToggleMode: (mode: 'BOT' | 'HUMAN') => void;
  onSendMessage: (content: string) => Promise<void>;
  onSuggestReply: () => Promise<string | null>;
}

export const MessageComposer = ({
  isLocked,
  currentConvMode,
  onToggleMode,
  onSendMessage,
  onSuggestReply
}: MessageComposerProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showRepliesPopup, setShowRepliesPopup] = useState(false);
  const [replyQuery, setReplyQuery] = useState("");

  const handleSend = async () => {
    if (!newMessage.trim() || isLocked) return;
    const content = newMessage.trim();
    setNewMessage('');
    setShowRepliesPopup(false);
    await onSendMessage(content);
  };

  const handleSuggest = async () => {
    if (isSuggesting || isLocked) return;
    setIsSuggesting(true);
    try {
      const suggestion = await onSuggestReply();
      if (suggestion) {
        setNewMessage(suggestion);
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <div className="p-4 bg-app-surface border-t border-app w-full font-sans">
      <div className="border border-app rounded-xl focus-within:ring-2 focus-within:ring-blue-500/15 focus-within:border-blue-500/50 transition-all shadow-sm">
        
        {showRepliesPopup && (
          <div className="relative">
            <SavedRepliesPopup 
              query={replyQuery}
              onSelect={(content: string) => {
                setNewMessage(content);
                setShowRepliesPopup(false);
              }}
              onClose={() => setShowRepliesPopup(false)}
            />
          </div>
        )}

        <div className="flex items-center justify-between p-2.5 border-b border-app flex-wrap gap-2 bg-app-bg/50">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button 
              type="button"
              onClick={() => { setShowRepliesPopup(p => !p); setReplyQuery(""); }}
              disabled={isLocked}
              className="px-2 sm:px-3 py-1.5 text-blue-600 font-extrabold text-[10px] uppercase bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-45"
            >
              <span className="material-symbols-outlined text-[15px]">menu_book</span>
              <span className="hidden sm:inline">Replies</span>
            </button>
            
            <button 
              type="button"
              onClick={handleSuggest}
              disabled={isSuggesting || isLocked}
              className="px-2 sm:px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 font-extrabold text-[10px] uppercase rounded-lg transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
              title="Generates a contextual reply powered by Google Gemini AI models"
            >
              {isSuggesting ? (
                <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[15px]">magic_button</span>
              )}
              <span>
                <span className="hidden sm:inline">AI Suggest</span>
                <span className="sm:hidden">AI</span>
              </span>
            </button>

            <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1"></div>
            
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-app/50">
              <button
                type="button"
                onClick={() => onToggleMode('BOT')}
                className={`px-2 sm:px-3 py-1 rounded text-[9px] font-black uppercase tracking-tight transition cursor-pointer ${
                  currentConvMode === 'BOT' 
                    ? 'bg-app-surface text-blue-600 shadow-sm border border-app/20' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="AI bot takes full automated control of communications flow"
              >
                <span className="hidden sm:inline">AI </span>Pilot
              </button>
              <button
                type="button"
                onClick={() => onToggleMode('HUMAN')}
                className={`px-2 sm:px-3 py-1 rounded text-[9px] font-black uppercase tracking-tight transition cursor-pointer ${
                  currentConvMode === 'HUMAN' 
                    ? 'bg-app-surface text-blue-600 shadow-sm border border-app/20' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Pause bot automated responses. Operator will reply manually."
              >
                Manual
              </button>
            </div>
          </div>

          <div className="flex gap-0.5 sm:gap-1">
            <IconButton icon="mood" title="Emojis" />
            <IconButton icon="attach_file" title="Attach file" />
          </div>
        </div>

        <textarea 
          placeholder={isLocked ? "🔒 Conversation is locked. Claim thread to respond." : "Type a message... Type '/' for templates."}
          value={newMessage}
          disabled={isLocked}
          onChange={(e) => {
            const val = e.target.value;
            setNewMessage(val);
            if (val.startsWith("/")) {
              setShowRepliesPopup(true);
              setReplyQuery(val.slice(1));
            } else {
              setShowRepliesPopup(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !showRepliesPopup && !isLocked) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="w-full p-4 text-xs md:text-sm border-none focus:ring-0 focus:outline-none min-h-[90px] resize-none text-slate-800 bg-transparent placeholder:text-slate-400"
        />
        
        <div className="flex items-center justify-between p-2.5 sm:p-3 bg-app-bg/50 rounded-b-xl border-t border-app">
          <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold select-none">
            {currentConvMode === 'BOT' ? '🤖 AI Autopilot actively responding' : '👤 Manual operator overrides active'}
          </span>
          <button 
            type="button"
            onClick={handleSend}
            disabled={isLocked || !newMessage.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-xs font-extrabold hover:bg-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
          >
            <span>Send Message</span>
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
};
