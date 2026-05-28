import { ArrowLeft, UserCheck, UserX, Mail, Volume2, VolumeX, MoreVertical } from "lucide-react";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { UserData } from "./types";
import toast from "react-hot-toast";

interface Props {
  selectedAgent: UserData;
  setMobileView: (v: "list" | "detail" | "context") => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  isMoreMenuOpen: boolean;
  setIsMoreMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDeleteChat: (bothSides: boolean) => void;
}

export function AgentChatHeader({
  selectedAgent,
  setMobileView,
  soundEnabled,
  setSoundEnabled,
  isMoreMenuOpen,
  setIsMoreMenuOpen,
  handleDeleteChat,
}: Props) {
  return (
    <div className="p-4 lg:p-6 border-b border-[#D9DADC] bg-app-surface flex items-start justify-between sticky top-0 z-10 shadow-xs">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setMobileView("list")}
          className="mt-1 p-1 -ml-2 lg:hidden text-[#6B7280] hover:bg-slate-100 rounded-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          <div className="flex items-center gap-3 mb-1 sm:mb-2">
            <h2 className="text-xl font-bold text-[#1F2937] leading-tight flex items-center gap-2">
              {selectedAgent.name}
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${selectedAgent.isActive ? "bg-green-400" : "bg-slate-300"}`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${selectedAgent.isActive ? "bg-green-500" : "bg-slate-400"}`}
                ></span>
              </span>
            </h2>
            <StatusBadge
              status={
                selectedAgent.role === "OWNER"
                  ? "warning"
                  : selectedAgent.role === "ADMIN"
                    ? "info"
                    : "neutral"
              }
              label={selectedAgent.role}
              className="hidden sm:inline-flex"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-[#6B7280]">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {selectedAgent.email}
            </span>
            {selectedAgent.isActive ? (
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <UserCheck className="w-3.5 h-3.5" /> Currently Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-500">
                <UserX className="w-3.5 h-3.5" /> Offline / Inactive
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            toast.success(
              soundEnabled
                ? "Notification sounds muted"
                : "Notification sounds enabled",
              { duration: 1500 },
            );
          }}
          title={
            soundEnabled
              ? "Mute notification sounds"
              : "Unmute notification sounds"
          }
          className={`p-2 border rounded-md transition-colors duration-200 flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer ${
            soundEnabled
              ? "bg-blue-50 text-[#0052CC] border-blue-200 hover:bg-blue-100"
              : "bg-app-bg text-slate-400 border-app hover:bg-slate-100"
          }`}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setMobileView("context")}
          className="px-3 py-2 text-xs font-semibold bg-[#F8F9FB] text-[#0052CC] border border-[#D9DADC] rounded-md hover:bg-blue-50 transition lg:hidden w-full sm:w-auto"
        >
          View Profile
        </button>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => setIsMoreMenuOpen((prev) => !prev)}
            className="p-2 border border-[#D9DADC] rounded-md text-[#6B7280] hover:bg-app-bg transition min-w-[44px] min-h-[44px] flex justify-center items-center"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMoreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsMoreMenuOpen(false)}
              ></div>
              <div className="absolute top-full right-0 mt-1 w-48 bg-app-surface border border-[#E2E8F0] shadow-lg rounded-md overflow-hidden z-30">
                <button
                  onClick={() => handleDeleteChat(false)}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete Chat (For me)
                </button>
                <button
                  onClick={() => handleDeleteChat(true)}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-[#E2E8F0]"
                >
                  Delete Chat (For both sides)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
