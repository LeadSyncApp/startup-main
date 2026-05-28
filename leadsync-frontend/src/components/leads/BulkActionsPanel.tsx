import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, UserCheck, AlertTriangle, Trash, X } from "lucide-react";

interface BulkActionsPanelProps {
  selectedCount: number;
  filter: string;
  userRole?: string;
  onBulkAssign: () => void;
  onBulkPriority: (priority: "URGENT" | "HIGH" | "NORMAL") => void;
  onTriggerDelete: () => void;
  onClearSelection: () => void;
}

export default function BulkActionsPanel({
  selectedCount,
  filter,
  userRole,
  onBulkAssign,
  onBulkPriority,
  onTriggerDelete,
  onClearSelection,
}: BulkActionsPanelProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-slate-900/40 border border-slate-700"
        >
          <CheckSquare size={16} className="text-app-primary shrink-0" />
          <span className="text-sm font-black mr-2 min-w-[80px] font-sans">
            {selectedCount} selected
          </span>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          {filter === "manual" ? (
            <>
              {["ADMIN", "OWNER"].includes(userRole || "") ? (
                <button
                  onClick={onTriggerDelete}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-xl transition active:scale-95 cursor-pointer font-sans"
                >
                  <Trash size={13} />
                  Delete Orders
                </button>
              ) : (
                <span className="text-xs font-medium text-slate-400 font-sans">
                  Bulk operations restricted to Admin/Owner
                </span>
              )}
            </>
          ) : (
            <>
              <button
                onClick={onBulkAssign}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition active:scale-95 cursor-pointer font-sans"
              >
                <UserCheck size={13} />
                Assign to me
              </button>
              <button
                onClick={() => onBulkPriority("URGENT")}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-xl transition active:scale-95 cursor-pointer font-sans"
              >
                <AlertTriangle size={13} />
                Mark Urgent
              </button>
              <button
                onClick={() => onBulkPriority("HIGH")}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-orange-600 hover:bg-orange-500 rounded-xl transition active:scale-95 cursor-pointer font-sans"
              >
                <AlertTriangle size={13} />
                High Priority
              </button>
              {/* Only show delete button for ADMIN and OWNER roles */}
              {["ADMIN", "OWNER"].includes(userRole || "") && (
                <button
                  onClick={onTriggerDelete}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-xl transition active:scale-95 cursor-pointer font-sans"
                >
                  <Trash size={13} />
                  Delete
                </button>
              )}
            </>
          )}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button
            onClick={onClearSelection}
            className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1.5 rounded-xl transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
