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
      className={`w-full lg:w-[320px] bg-app-surface flex-col shrink-0 h-full overflow-y-auto lg:overflow-visible border-l border-app ${mobileView === "context" ? "flex z-20 absolute inset-0 lg:relative lg:flex" : "hidden lg:flex"}`}
    >
      {selectedAgent ? (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4 lg:hidden">
            <button
              onClick={() => setMobileView("detail")}
              className="p-1 -ml-2 text-app-text-muted hover:bg-app-bg-soft rounded-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-app-text uppercase tracking-wider">
              Profile
            </h3>
          </div>
          <h3 className="hidden lg:block text-sm font-bold text-app-text-muted uppercase tracking-wider mb-4">
            Member Profile
          </h3>

          <div className="flex flex-col items-center text-center gap-3 mb-6 bg-app-bg-soft p-6 rounded-2xl border border-app">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold uppercase shadow-lg ring-4 ring-app-surface">
              {selectedAgent.name.charAt(0)}
            </div>
            <div>
              <h4 className="text-lg font-bold text-app-text">
                {selectedAgent.name}
              </h4>
              <p className="text-xs text-app-primary font-bold mt-1 uppercase tracking-widest">
                {selectedAgent.role}
              </p>
            </div>
          </div>

          <div className="space-y-5 mb-8">
            <div className="flex items-start gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-app-bg flex items-center justify-center shrink-0 border border-app">
                <Mail className="w-4 h-4 text-app-text-muted" />
              </div>
              <div className="break-all pt-0.5">
                <p className="text-app-text-muted text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  Email Address
                </p>
                <p className="text-app-text font-medium">
                  {selectedAgent.email}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-app-bg flex items-center justify-center shrink-0 border border-app">
                <Shield className="w-4 h-4 text-app-text-muted" />
              </div>
              <div className="pt-0.5">
                <p className="text-app-text-muted text-[10px] font-bold uppercase tracking-widest mb-0.5">
                  System Status
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedAgent.isActive ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 uppercase tracking-wider">
                      Active Account
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-app-text-muted bg-app-bg-soft px-2 py-0.5 rounded border border-app uppercase tracking-wider">
                      Disabled
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold text-app-text-muted uppercase tracking-wider mb-4 border-t border-app pt-6">
            Collaboration Tools
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMobileView("detail")}
              className="flex flex-col items-center justify-center gap-2 p-3 border border-app rounded-xl bg-app-surface hover:bg-app-bg-soft transition text-app-text min-h-[90px] group active:scale-95 shadow-sm"
            >
              <MessageSquare className="w-5 h-5 text-app-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Message</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 p-3 border border-app rounded-xl bg-app-surface hover:bg-app-bg-soft transition text-app-text min-h-[90px] group active:scale-95 shadow-sm">
              <Clock className="w-5 h-5 text-app-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Schedule Sync</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-app-text-muted p-6 text-center bg-app-bg-soft">
          <p className="text-sm font-medium">
            Select a team member to view their profile.
          </p>
        </div>
      )}
    </div>
  );
}
