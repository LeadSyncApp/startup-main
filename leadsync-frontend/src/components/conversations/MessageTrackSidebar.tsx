interface MessageTrackSidebarProps {
  trackSidebarExpanded: boolean;
  messageFilter: 'all' | 'bot' | 'agent';
  setMessageFilter: (filter: 'all' | 'bot' | 'agent') => void;
  totalMessagesCount: number;
}

export const MessageTrackSidebar = ({
  trackSidebarExpanded,
  messageFilter,
  setMessageFilter,
  totalMessagesCount
}: MessageTrackSidebarProps) => {
  return (
    <div 
      style={{ 
        width: trackSidebarExpanded ? '200px' : '0px',
        minWidth: trackSidebarExpanded ? '200px' : '0px',
        opacity: trackSidebarExpanded ? 1 : 0
      }}
      className="bg-app-bg border-r border-app/60 flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden font-sans"
    >
      <div className="p-3 flex flex-col gap-1.5 h-full">
        <div className="px-1.5 py-1 text-[9px] font-black text-slate-400 tracking-wider uppercase">
          Select Track
        </div>
        
        <button
          type="button"
          onClick={() => setMessageFilter('all')}
          className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 cursor-pointer ${
            messageFilter === 'all'
              ? 'bg-blue-600 text-white font-extrabold shadow-md shadow-blue-500/15'
              : 'text-app-muted hover:text-app-text hover:bg-slate-200/50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">forum</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs truncate font-bold">Unified Flow</span>
            <span className={`text-[9px] font-normal leading-none mt-0.5 ${messageFilter === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>
              ({totalMessagesCount} messages)
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMessageFilter('bot')}
          className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 cursor-pointer ${
            messageFilter === 'bot'
              ? 'bg-purple-600 text-white font-extrabold shadow-md shadow-purple-500/15'
              : 'text-app-muted hover:text-app-text hover:bg-slate-200/50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">smart_toy</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs truncate font-bold">AI Bot Track</span>
            <span className={`text-[9px] font-normal leading-none mt-0.5 ${messageFilter === 'bot' ? 'text-purple-100' : 'text-slate-400'}`}>
              Autopilot system
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMessageFilter('agent')}
          className={`w-full text-left p-2.5 rounded-xl transition-all duration-150 flex items-center gap-2 cursor-pointer ${
            messageFilter === 'agent'
              ? 'bg-emerald-600 text-white font-extrabold shadow-md shadow-emerald-500/15'
              : 'text-app-muted hover:text-app-text hover:bg-slate-200/50'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs truncate font-bold">Live Agent Track</span>
            <span className={`text-[9px] font-normal leading-none mt-0.5 ${messageFilter === 'agent' ? 'text-emerald-100' : 'text-slate-400'}`}>
              Human override
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
