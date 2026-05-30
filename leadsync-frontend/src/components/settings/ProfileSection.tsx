import { api } from "@/lib/api";
import toast from "react-hot-toast";

interface ProfileSectionProps {
  user: any;
  updateUser: (user: any) => void;
  setAgentWorkloads: (workloads: any[]) => void;
}

export function ProfileSection({ user, updateUser, setAgentWorkloads }: ProfileSectionProps) {
  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border flex flex-col md:flex-row md:items-center justify-between gap-6" id="settings-profile-section">
      <div>
        <h2 className="text-lg font-semibold mb-3">Profile</h2>
        <div className="space-y-1 text-sm text-app-muted">
          <p><strong>Name:</strong> {user?.name}</p>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Role:</strong> <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-0.5 rounded-full font-bold uppercase">{user?.role}</span></p>
        </div>
      </div>

      {/* Individual Availability Toggle */}
      <div className="border-t md:border-t-0 md:border-l border-app pt-4 md:pt-0 md:pl-6 flex flex-col justify-center min-w-[280px]">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
          Auto-Assignment Availability
        </label>
        <div className="flex items-center gap-3">
          <button
            id="settings-availability-toggle"
            onClick={async () => {
              if (!user) return;
              const newAvailableState = !(user.isAvailable !== false);
              try {
                await api.patch(`/users/${user.id}/availability`, {
                  isAvailable: newAvailableState,
                });
                updateUser({ isAvailable: newAvailableState });
                
                // Re-fetch workloads to update crew workloads widget in real-time
                const configRes = await api.get("/dashboard/bot-config");
                if (configRes.agentWorkloads) {
                  setAgentWorkloads(configRes.agentWorkloads);
                }

                toast.success(newAvailableState 
                  ? "You are now accepting auto-assigned chats! 🟢" 
                  : "You paused receiving auto-assigned chats. 🟡"
                );
              } catch (err) {
                toast.error("Failed to update availability status");
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              user?.isAvailable !== false ? "bg-emerald-500" : "bg-slate-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-app-surface shadow ring-0 transition duration-200 ease-in-out ${
                user?.isAvailable !== false ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <div>
            <span className={`text-sm font-bold ${user?.isAvailable !== false ? "text-emerald-600" : "text-amber-500"}`}>
              {user?.isAvailable !== false ? "Accepting Chats" : "On Break / Paused"}
            </span>
            <p className="text-slate-400 text-[10px] leading-tight">
              {user?.isAvailable !== false ? "Active in Round-Robin and Load-Balancer." : "No new chats will auto-assign to you."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
