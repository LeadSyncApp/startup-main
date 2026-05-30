import { Users, Search, MoreVertical, MessageSquare } from "lucide-react";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { UserData } from "./types";
import React from "react";

interface Props {
  mobileView: "list" | "detail" | "context";
  loading: boolean;
  activeInboxAgents: UserData[];
  filteredAgents: UserData[];
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  selectedAgent: UserData | null;
  handleSelectAgent: (agent: UserData) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (v: boolean) => void;
  isSelectionMode: boolean;
  setIsSelectionMode: (v: boolean) => void;
  selectedListIds: string[];
  toggleListSelection: (id: string, e: React.MouseEvent) => void;
  clearSelection: () => void;
  handleBulkDelete: (bothSides: boolean) => void;
  listMenuOpenId: string | null;
  setListMenuOpenId: (id: string | null) => void;
  handleDeleteSingleListChat: (agentId: string, bothSides: boolean, e: React.MouseEvent) => void;
}

export function AgentLeftPanel({
  mobileView,
  loading,
  activeInboxAgents,
  filteredAgents,
  searchQuery,
  setSearchQuery,
  selectedAgent,
  handleSelectAgent,
  isDropdownOpen,
  setIsDropdownOpen,
  isSelectionMode,
  setIsSelectionMode,
  selectedListIds,
  toggleListSelection,
  clearSelection,
  handleBulkDelete,
  listMenuOpenId,
  setListMenuOpenId,
  handleDeleteSingleListChat,
}: Props) {
  return (
    <div
      className={`w-full lg:w-[380px] bg-app-surface border-r border-app flex-col z-10 shrink-0 h-full overflow-hidden ${mobileView === "list" ? "flex" : "hidden lg:flex"}`}
    >
      <div className="p-4 border-b border-app bg-app-surface flex flex-col gap-3 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-app-text">Team Inbox</h2>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 bg-app-surface border border-app hover:border-app-primary rounded-lg shadow-sm text-sm transition-all"
          >
            <span className="text-app-text-muted flex items-center gap-2">
              <Users className="w-4 h-4" /> Start a new chat...
            </span>
            <span className="text-xs font-semibold text-app-primary">
              Select Agent
            </span>
          </button>

          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute top-full left-0 right-0 mt-1 bg-app-surface border border-app shadow-lg rounded-lg max-h-[300px] overflow-y-auto z-40">
                <div className="p-2 border-b border-app sticky top-0 bg-app-surface">
                  <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">
                    Available Agents
                  </p>
                </div>
                {filteredAgents.length === 0 ? (
                  <div className="p-4 text-center text-sm text-app-text-muted">
                    No other agents found
                  </div>
                ) : (
                  filteredAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        handleSelectAgent(agent);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-app-bg border-b border-app last:border-0 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-app-bg-soft flex items-center justify-center text-app-text-muted font-bold uppercase text-xs">
                            {agent.name.charAt(0)}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-app-surface ${agent.isActive ? "bg-green-500" : "bg-slate-400"}`}
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-app-text">
                            {agent.name}
                          </div>
                          <div className="text-[10px] text-app-text-muted">
                            {agent.role}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${agent.isActive ? "bg-green-500/10 text-green-500" : "bg-app-bg text-app-text-muted"}`}
                      >
                        {agent.isActive ? "Active" : "Away"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <p className="text-xs font-semibold text-app-text-muted uppercase tracking-widest pl-1">
            Recent Chats
          </p>
          <div className="flex items-center gap-2 relative">
            <Search className="w-4 h-4 text-app-text-muted absolute left-3" />
            <input
              type="text"
              placeholder="Filter recent chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-app-bg border border-app rounded-md text-sm outline-none focus:border-app-primary focus:ring-1 focus:ring-app-primary transition-shadow placeholder-app-text-muted"
            />
          </div>
        </div>
      </div>

      <div className="flex bg-app-bg border-b border-app px-4 py-2 items-center justify-between z-10">
        <button
          onClick={() => {
            if (isSelectionMode) clearSelection();
            else setIsSelectionMode(true);
          }}
          className="text-xs font-semibold text-app-primary hover:opacity-80 transition-colors"
        >
          {isSelectionMode ? "Cancel Selection" : "Select Chats"}
        </button>
        {isSelectionMode && selectedListIds.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkDelete(false)}
              className="text-[10px] px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 font-semibold transition"
            >
              Delete for Me
            </button>
            <button
              onClick={() => handleBulkDelete(true)}
              className="text-[10px] px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-semibold transition shadow-xs"
            >
              Delete Both Sides
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-app-bg-soft">
        {loading ? (
          <div className="text-center py-10 text-app-text-muted text-sm">
            Loading inbox...
          </div>
        ) : activeInboxAgents.length === 0 ? (
          <div className="text-center py-10 text-app-text-muted flex flex-col items-center">
            <MessageSquare className="w-8 h-8 text-app-border-strong mb-2" />
            <p className="text-sm font-medium text-app-text">
              No active chats
            </p>
            <p className="text-xs text-app-text-muted mt-1">
              Select an agent from the dropdown to start chatting.
            </p>
          </div>
        ) : (
          activeInboxAgents.map((agent) => {
            const isSelected = selectedAgent?.id === agent.id;
            const isChecked = selectedListIds.includes(agent.id);

            return (
              <div
                key={agent.id}
                onClick={(e) => {
                  if (isSelectionMode) {
                    toggleListSelection(agent.id, e);
                  } else {
                    handleSelectAgent(agent);
                  }
                }}
                className={`relative overflow-visible cursor-pointer bg-app-surface border rounded-lg p-4 transition-all duration-200 hover:shadow-xs group ${
                  isSelected && !isSelectionMode
                    ? "border-app-primary ring-1 ring-app-primary/50 shadow-xs"
                    : isChecked
                      ? "border-app-primary ring-1 ring-app-primary/30 bg-app-primary-soft"
                      : "border-app hover:border-app-border-strong"
                }`}
              >
                {isSelected && !isSelectionMode && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-app-primary rounded-l-lg" />
                )}

                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {isSelectionMode && (
                      <div className="mr-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => toggleListSelection(agent.id, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-app-primary border-app bg-app-bg rounded focus:ring-app-primary cursor-pointer"
                        />
                      </div>
                    )}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-xs uppercase">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-app-surface bg-green-500"
                        style={{
                          backgroundColor: agent.isActive ? "#22C55E" : "#94A3B8",
                        }}
                      >
                        {agent.isActive && (
                          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                        )}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-app-text leading-tight flex items-center gap-1.5">
                        {agent.name}
                      </h4>
                      <p className="text-[11px] text-app-text-muted mt-1 font-medium select-none">
                        {agent.role}
                      </p>
                    </div>
                  </div>

                  {!isSelectionMode && (
                    <div className="flex items-center gap-2 relative">
                      <StatusBadge
                        status={agent.isActive ? "success" : "neutral"}
                        label={agent.isActive ? "Active" : "Away"}
                        className="scale-90 origin-right transition-opacity group-hover:opacity-0"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setListMenuOpenId(
                            listMenuOpenId === agent.id ? null : agent.id,
                          );
                        }}
                        className="absolute right-0 opacity-0 group-hover:opacity-100 p-1.5 text-app-text-muted hover:text-app-text hover:bg-app-bg-soft rounded-md transition"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {listMenuOpenId === agent.id && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setListMenuOpenId(null);
                            }}
                          ></div>
                          <div
                            className="absolute top-8 right-0 w-44 bg-app-surface border border-app shadow-lg rounded-md overflow-hidden z-30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleDeleteSingleListChat(agent.id, false, e)}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-500/10 transition-colors"
                            >
                              Delete (For me)
                            </button>
                            <button
                              onClick={(e) => handleDeleteSingleListChat(agent.id, true, e)}
                              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-500/10 transition-colors border-t border-app"
                            >
                              Delete (Both sides)
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
