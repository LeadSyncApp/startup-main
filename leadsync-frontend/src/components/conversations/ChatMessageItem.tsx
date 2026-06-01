import { Message } from './types';
import { isSystemLog, formatTime } from './helpers';
import toast from 'react-hot-toast';

interface ChatMessageItemProps {
  msg: Message;
  selectedConvInitialsColor: string;
  selectedConvLeadInitials: string;
  customerName: string;
}

const renderMessageContent = (content: string) => {
  const lines = content.split('\n');
  const msgLines: string[] = [];
  const buttons: { text: string; callback: string }[] = [];
  let currentButton = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('BUTTON:')) {
      currentButton = line.replace('BUTTON:', '').trim();
    } else if (line.startsWith('CALLBACK:')) {
      const callback = line.replace('CALLBACK:', '').trim();
      if (currentButton) {
        buttons.push({ text: currentButton, callback });
        currentButton = '';
      }
    } else {
      msgLines.push(lines[i]);
    }
  }

  const cleanedText = msgLines.join('\n').trim();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{cleanedText}</p>
      
      {buttons.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-black/10 mt-1">
          {buttons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                toast(`Simulating customer option of "${btn.text}"`);
              }}
              className="px-3 py-1.5 bg-black/10 hover:bg-black/20 text-current rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-transform active:scale-95 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[12px]">smart_button</span>
              <span>{btn.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ChatMessageItem = ({
  msg,
  selectedConvInitialsColor,
  selectedConvLeadInitials,
  customerName
}: ChatMessageItemProps) => {
  // If it's a true core system log, render it as centralized capsule
  if (msg.sender === 'SYSTEM' && isSystemLog(msg.content)) {
    return (
      <div className="flex justify-center my-2 select-none w-full">
        <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-app/50 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">info</span>
          {msg.content}
        </span>
      </div>
    );
  }

  // Determine sender parameters
  const isIncoming = msg.sender === 'CLIENT';
  
  // If SYSTEM and NOT isSystemLog, it is an automated AI response written by Bot Autopilot (MessageSender.SYSTEM)
  const isBotResponse = msg.sender === 'SYSTEM';

  return (
    <div 
      className={`flex gap-3 max-w-[85%] ${
        isIncoming ? 'mr-auto flex-row' : 'ml-auto flex-row-reverse'
      }`}
    >
      {/* Avatar initials badge */}
      {isIncoming ? (
        <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-black bg-gradient-to-br ${selectedConvInitialsColor}`}>
          {selectedConvLeadInitials}
        </div>
      ) : isBotResponse ? (
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs bg-orange-500 shadow-sm leading-none">
          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
        </div>
      ) : (
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs bg-blue-900 shadow-sm leading-none">
          <span className="material-symbols-outlined text-[16px]">support_agent</span>
        </div>
      )}

      <div className={`flex flex-col ${!isIncoming ? 'items-end' : 'items-start'} max-w-[calc(100%-2.5rem)]`}>
        {/* Sender Label Indicator */}
        <div className={`flex items-center gap-1.5 mb-1 ${!isIncoming ? 'flex-row-reverse' : ''}`}>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {isIncoming ? customerName : isBotResponse ? '🤖 AI Autopilot' : '👤 Operator'}
          </span>
          {isBotResponse && (
            <span className="text-[8px] bg-orange-100 text-orange-700 px-1 rounded font-black uppercase">Auto</span>
          )}
          {!isIncoming && !isBotResponse && (
            <span className="text-[8px] bg-blue-100 text-blue-900 px-1 rounded font-black uppercase font-sans">Live</span>
          )}
        </div>

        {/* Speech Bubble Card */}
        <div className={`p-4 rounded-xl shadow-sm text-left ${
          isIncoming 
            ? 'bg-white border border-slate-200 text-slate-800' 
            : isBotResponse
              ? 'bg-orange-500 text-white font-medium'
              : 'bg-blue-900 text-white font-medium'
        }`}>
          {renderMessageContent(msg.content)}
        </div>

        {/* Timestamp helper */}
        <div className={`flex items-center gap-1.5 mt-1 text-[9px] text-slate-400 font-semibold uppercase ${!isIncoming ? 'flex-row-reverse' : ''}`}>
          <span>{formatTime(msg.createdAt)}</span>
          {!isIncoming && (
            <>
              <span>•</span>
              <span className={isBotResponse ? 'text-orange-500' : 'text-blue-500'}>Delivered</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
