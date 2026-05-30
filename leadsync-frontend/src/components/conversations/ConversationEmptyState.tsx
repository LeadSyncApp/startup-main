interface ConversationEmptyStateProps {
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
}

export const ConversationEmptyState = ({
  sidebarExpanded,
  setSidebarExpanded
}: ConversationEmptyStateProps) => {
  return (
    <div className="flex-1 flex flex-col bg-app-bg/10 font-sans w-full">
      {!sidebarExpanded && (
        <header className="h-16 border-b border-app bg-app-surface flex items-center px-4 sm:px-6 shrink-0">
          <button 
            type="button"
            onClick={() => setSidebarExpanded(true)}
            className="hidden md:flex p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 rounded-lg items-center justify-center shrink-0 mr-1 transition-all cursor-pointer"
            title="Expand sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">menu</span>
          </button>
          <span className="ml-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Inbox Directory</span>
        </header>
      )}
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center bg-transparent">
        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[36px]">forum</span>
        </div>
        <h2 className="text-sm font-bold text-slate-800 mb-2 font-sans">Select a Conversation</h2>
        <p className="text-xs max-w-xs leading-relaxed text-slate-500 font-sans">
          Pick a customer session from the directory to review transaction notes or chat manual overrides.
        </p>
      </div>
    </div>
  );
};
