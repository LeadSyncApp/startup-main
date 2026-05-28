import { MessageSquare, Phone, Calendar, Clock, CheckCircle, MoreHorizontal } from "lucide-react";
import { StatusBadge } from "../../components/ui/StatusBadge";

export interface DashboardTask {
  id: string;
  type: "call" | "message" | "meeting" | "todo";
  title: string;
  contactName: string;
  organization?: string;
  dueAt: string;
  status: "pending" | "in_progress" | "completed";
  priority: "high" | "medium" | "low";
}

interface AgentTaskCardProps {
  task: DashboardTask;
  onAction?: (action: string, task: DashboardTask) => void;
}

export function AgentTaskCard({ task, onAction }: AgentTaskCardProps) {
  const getIcon = () => {
    switch (task.type) {
      case "call": return <Phone className="w-4 h-4" />;
      case "message": return <MessageSquare className="w-4 h-4" />;
      case "meeting": return <Calendar className="w-4 h-4" />;
      case "todo": return <CheckCircle className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getPriorityStatus = () => {
    if (task.status === "completed") return { status: "success", label: "Done" };
    if (task.priority === "high") return { status: "danger", label: "Urgent" };
    if (task.priority === "medium") return { status: "warning", label: "Medium" };
    return { status: "neutral", label: "Normal" };
  };

  const pStatus = getPriorityStatus();

  return (
    <div className="group bg-app-surface border border-app-border rounded-md p-4 transition hover:shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-app-bg text-app-muted rounded border border-app-border">
            {getIcon()}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-app-text leading-tight">{task.title}</h4>
            <p className="text-xs text-app-muted">
              {task.contactName} {task.organization ? `• ${task.organization}` : ""}
            </p>
          </div>
        </div>
        <button 
          className="text-slate-400 hover:text-app-text p-1 opacity-0 group-hover:opacity-100 transition"
          aria-label="More options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={pStatus.status as any} label={pStatus.label} />
          <div className="flex items-center gap-1 text-xs text-app-muted font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>{task.dueAt}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("mark_done", task);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-app-surface border border-app-border text-app-text rounded hover:bg-app-bg transition min-w-[44px]"
          >
            Done
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("start", task);
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-[#0052CC] text-white rounded hover:bg-blue-700 transition min-w-[44px]"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
