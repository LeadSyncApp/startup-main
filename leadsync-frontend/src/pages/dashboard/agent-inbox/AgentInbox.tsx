import { useAgentInboxState } from "./useInboxState";
import { AgentLeftPanel } from "./AgentLeftPanel";
import { AgentCenterPanel } from "./AgentCenterPanel";
import { AgentRightPanel } from "./AgentRightPanel";
import { AgentConfirmModal } from "./AgentConfirmModal";

export default function AgentInbox() {
  const state = useAgentInboxState();

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-80px)] bg-app-bg -mx-6 lg:-mx-10 -my-8 lg:-my-10 overflow-hidden">
      <AgentLeftPanel
        mobileView={state.mobileView}
        loading={state.loading}
        activeInboxAgents={state.activeInboxAgents}
        filteredAgents={state.filteredAgents}
        searchQuery={state.searchQuery}
        setSearchQuery={state.setSearchQuery}
        selectedAgent={state.selectedAgent}
        handleSelectAgent={state.handleSelectAgent}
        isDropdownOpen={state.isDropdownOpen}
        setIsDropdownOpen={state.setIsDropdownOpen}
        isSelectionMode={state.isSelectionMode}
        setIsSelectionMode={state.setIsSelectionMode}
        selectedListIds={state.selectedListIds}
        toggleListSelection={state.toggleListSelection}
        clearSelection={state.clearSelection}
        handleBulkDelete={state.handleBulkDelete}
        listMenuOpenId={state.listMenuOpenId}
        setListMenuOpenId={state.setListMenuOpenId}
        handleDeleteSingleListChat={state.handleDeleteSingleListChat}
      />

      <AgentCenterPanel
        mobileView={state.mobileView}
        setMobileView={state.setMobileView}
        selectedAgent={state.selectedAgent}
        soundEnabled={state.soundEnabled}
        setSoundEnabled={state.setSoundEnabled}
        isMoreMenuOpen={state.isMoreMenuOpen}
        setIsMoreMenuOpen={state.setIsMoreMenuOpen}
        handleDeleteChat={state.handleDeleteChat}
        notesLoading={state.notesLoading}
        notes={state.notes}
        user={state.user}
        reactions={state.reactions}
        handleToggleReaction={state.handleToggleReaction}
        messagesEndRef={state.messagesEndRef}
        isSubmittingMessage={state.isSubmittingMessage}
        handleSendNote={state.handleSendNote}
      />

      <AgentRightPanel
        selectedAgent={state.selectedAgent}
        mobileView={state.mobileView}
        setMobileView={state.setMobileView}
      />

      <AgentConfirmModal
        confirmModal={state.confirmModal}
        setConfirmModal={state.setConfirmModal}
      />
    </div>
  );
}