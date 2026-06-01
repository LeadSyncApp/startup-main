import { Conversation } from './types';
import { getInitials, getInitialsColor, formatTime } from './helpers';
import { TagChips } from './ConversationTags';

interface ConversationsListSidebarProps {
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  listFilter: 'all' | 'unread' | 'ai' | 'human';
  setListFilter: (filter: 'all' | 'unread' | 'ai' | 'human') => void;
  allSubFilter: 'channel' | 'manual';
  setAllSubFilter: (filter: 'channel' | 'manual') => void;
  loadingList: boolean;
  filteredConversations: Conversation[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const ConversationsListSidebar = ({
  sidebarExpanded,
  setSidebarExpanded,
  searchQuery,
  setSearchQuery,
  listFilter,
  setListFilter,
  allSubFilter,
  setAllSubFilter,
  loadingList,
  filteredConversations,
  selectedId,
  setSelectedId
}: ConversationsListSidebarProps) => {
  return (
    <section 
      style={{ 
        width: sidebarExpanded ? undefined : '0px', 
        minWidth: sidebarExpanded ? undefined : '0px' 
      }}
      className={`w-full md:w-[320px] bg-app-surface border-r border-app flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
        selectedId ? (sidebarExpanded ? 'hidden md:flex' : 'hidden') : 'flex'
      } ${!sidebarExpanded ? 'md:border-r-0' : ''}`}
    >
      <div className="p-4 border-b border-app flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-extrabold text-slate-800 tracking-wider">INBOX</h1>
          <button 
            type="button"
            onClick={() => setSidebarExpanded(false)}
            className="hidden md:flex p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg transition-colors items-center justify-center shrink-0"
            title="Collapse sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">menu_open</span>
          </button>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Search conversations..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-app-bg border border-app rounded-xl py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/80 outline-none transition-all placeholder:text-slate-400 text-slate-800"
          />
        </div>

        <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-app/50 font-sans">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'ai', label: 'AI Bot' },
            { id: 'human', label: 'Manual' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setListFilter(tab.id as any)}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all duration-150 ${
                listFilter === tab.id
                  ? 'bg-app-surface shadow-sm text-blue-600 border border-app/20'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-header for Channel vs Manual leads filter under All section */}
        {listFilter === 'all' && (
          <div className="flex bg-slate-100/40 p-0.5 rounded-lg border border-app/40 gap-0.5 mt-0.5 font-sans">
            <button
              type="button"
              onClick={() => setAllSubFilter('channel')}
              className={`flex-1 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-tight transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                allSubFilter === 'channel'
                  ? 'bg-blue-600 text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">language</span>
              <span>Channel Leads</span>
            </button>
            <button
              type="button"
              onClick={() => setAllSubFilter('manual')}
              className={`flex-1 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-tight transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                allSubFilter === 'manual'
                  ? 'bg-indigo-600 text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">storefront</span>
              <span>Manual Leads</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loadingList ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-slate-300 text-[32px]">progress_activity</span>
            <span className="text-xs font-bold text-slate-400">Loading inbox...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            No active conversations matched this filter.
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const leadInitials = getInitials(conv.lead?.name, conv.lead?.contact);
            const initialsColor = getInitialsColor(conv.lead?.name || conv.lead?.contact || '?');
            const isActive = selectedId === conv.id;
            
            return (
              <div 
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`px-4 py-3.5 border-b border-app/70 flex gap-3 items-start cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-blue-50/50 border-l-4 border-blue-600' 
                    : 'border-l-4 border-transparent hover:bg-app-bg/60'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-inner bg-gradient-to-br ${initialsColor}`}>
                    {leadInitials}
                  </div>
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                    conv.mode === 'BOT' ? 'bg-purple-500 animate-pulse' : 'bg-emerald-500'
                  }`} title={conv.mode === 'BOT' ? 'AI Control mode active' : 'Manual operator active'} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h4 className={`text-xs truncate ${isActive ? 'font-bold text-blue-900' : 'font-semibold text-slate-800'}`}>
                      {conv.lead?.name || 'Customer'}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {formatTime(conv.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <TagChips convId={conv.id} />
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.lastMessage || 'No messages received.'}</p>
                  
                  <div className="flex items-center justify-between gap-1 mt-1.5">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-blue-400">chat_bubble</span>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{conv.lead?.channel || 'Telegram'}</span>
                    </div>
                    {conv.mode === 'BOT' && (
                      <span className="text-[9px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.2 rounded-md">AUTO</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
