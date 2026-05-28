import { Mail, Shield, MessageSquare, Clock, ArrowLeft } from "lucide-react";
import { UserData } from "./types";

interface Props {
  selectedAgent: UserData | null;
  mobileView: "list" | "detail" | "context";
  setMobileView: React.Dispatch<React.SetStateAction<"list" | "detail" | "context">>;
}

export function AgentRightPanel({ selectedAgent, mobileView, setMobileView }: Props) {
  return (
    <div
      className={`w-full lg:w-[320px] bg-app-surface flex-col shrink-0 h-full overflow-y-auto lg:overflow-visible border-l border-[#D9DADC] ${mobileView === "context" ? "flex z-20 absolute inset-0 lg:relative lg:flex" : "hidden lg:flex"}`}
    >
      {selectedAgent ? (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4 lg:hidden">
            <button
              onClick={() => setMobileView("detail")}
              className="p-1 -ml-2 text-[#6B7280] hover:bg-slate-100 rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider">
              Profile
            </h3>
          </div>
          <h3 className="hidden lg:block text-sm font-bold text-[#1F2937] uppercase tracking-wider mb-4">
            Member Profile
          </h3>

          <div className="flex flex-col items-center text-center gap-3 mb-6 bg-app-bg p-4 rounded-xl border border-app">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold uppercase shadow-sm">
              {selectedAgent.name.charAt(0)}
            </div>
            <div>
              <h4 className="text-base font-bold text-[#1F2937]">
                {selectedAgent.name}
              </h4>
              <p className="text-sm text-[#6B7280] font-medium mt-1 uppercase tracking-wider">
                {selectedAgent.role}
              </p>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3 text-sm">
              <Mail className="w-4 h-4 text-[#6B7280] mt-0.5" />
              <div className="break-all">
                <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-0.5">
                  Email Address
                </p>
                <p className="text-[#1F2937] font-medium">
                  {selectedAgent.email}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Shield className="w-4 h-4 text-[#6B7280] mt-0.5" />
              <div>
                <p className="text-[#6B7280] text-xs uppercase tracking-wider mb-0.5">
                  System Status
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedAgent.isActive ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                      Active Account
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-app">
                      Disabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-[#1F2937] uppercase tracking-wider mb-4 border-t border-[#D9DADC] pt-6">
            Collaboration Tools
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMobileView("detail")}
              className="flex flex-col items-center justify-center gap-2 p-3 border border-[#D9DADC] rounded-md hover:bg-app-bg transition text-[#1F2937] min-h-[80px]"
            >
              <MessageSquare className="w-5 h-5 text-[#0052CC]" />
              <span className="text-xs font-semibold">Message</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-3 border border-[#D9DADC] rounded-md hover:bg-app-bg transition text-[#1F2937] min-h-[80px]">
              <Clock className="w-5 h-5 text-[#0052CC]" />
              <span className="text-xs font-semibold">Schedule Sync</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#6B7280] p-6 text-center">
          <p className="text-sm">
            Select a team member to view their profile.
          </p>
        </div>
      )}
    </div>
  );
}
