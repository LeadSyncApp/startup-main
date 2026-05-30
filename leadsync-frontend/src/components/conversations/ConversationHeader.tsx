import toast from 'react-hot-toast';
import { Conversation } from './types';
import { getInitials, getInitialsColor } from './helpers';
import { TagButton } from './ConversationTags';
import { IconButton } from './ContactIntelligence';

interface ConversationHeaderProps {
  selectedConv: Conversation;
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  setSelectedId: (id: string | null) => void;
  showProfile: boolean;
  setShowProfile: (show: boolean) => void;
}

export const ConversationHeader = ({
  selectedConv,
  sidebarExpanded,
  setSidebarExpanded,
  setSelectedId,
  showProfile,
  setShowProfile
}: ConversationHeaderProps) => {
  const selectedConvLeadInitials = getInitials(selectedConv?.lead?.name, selectedConv?.lead?.contact);
  const selectedConvInitialsColor = getInitialsColor(selectedConv?.lead?.name || selectedConv?.lead?.contact || '?');

  return (
    <header className="h-16 border-b border-app bg-app-surface flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 w-full font-sans">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {!sidebarExpanded && (
          <button 
            type="button"
            onClick={() => setSidebarExpanded(true)}
            className="hidden md:flex p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg items-center justify-center shrink-0 mr-1 transition-all cursor-pointer"
            title="Expand sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
        )}

        <button 
          type="button"
          onClick={() => setSelectedId(null)}
          className="md:hidden p-1 mr-1 text-slate-500 hover:bg-app-bg rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
          title="Back to inbox list"
        >
          <span className="material-symbols-outlined text-[22px] sm:text-[24px]">arrow_back</span>
        </button>

        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white text-[13px] sm:text-sm font-black shadow-inner leading-none bg-gradient-to-br ${selectedConvInitialsColor}`}>
          {selectedConvLeadInitials}
        </div>
        
        <div className="min-w-0">
          <h2 className="text-xs sm:text-sm font-bold text-app-text flex items-center gap-1.5 truncate">
            {selectedConv?.lead?.name || 'Customer'}
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          </h2>
          <p className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider truncate font-sans">
            {selectedConv?.lead?.channel} • {selectedConv?.lead?.contact}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TagButton convId={selectedConv.id} />

        <IconButton 
          icon="call" 
          onClick={() => {
            const contact = selectedConv?.lead?.contact;
            if (contact) {
              window.open(`tel:${contact}`);
              toast.success(`Initiating voice call stream to ${contact}...`);
            } else {
              toast.error("No contact registration found for this lead");
            }
          }} 
          title="Call Customer" 
        />

        <button 
          type="button"
          onClick={() => setShowProfile(!showProfile)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
            showProfile 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-app'
          }`}
        >
          {showProfile ? 'Hide Profile' : 'View Profile'}
        </button>
      </div>
    </header>
  );
};
