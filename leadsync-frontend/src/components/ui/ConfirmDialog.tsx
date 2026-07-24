import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-md"
            style={{ backgroundColor: "var(--app-backdrop)" }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative w-full max-w-md rounded-[2.5rem] shadow-[0_48px_80px_-24px_rgba(0,0,0,0.35)] overflow-hidden flex flex-col z-10"
            style={{
              backgroundColor: "var(--app-surface)",
              border: "1px solid var(--app-border)",
            }}
          >
            <div
              className="px-8 py-6 flex justify-between items-center"
              style={{
                borderBottom: "1px solid var(--app-border)",
                backgroundColor: "var(--app-bg-soft)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: isDestructive
                      ? "rgba(239, 68, 68, 0.1)"
                      : "rgba(212, 168, 67, 0.1)",
                    color: isDestructive ? "#ef4444" : "var(--brand-saffron)",
                  }}
                >
                  <AlertTriangle className="h-5 w-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-lg font-black" style={{ color: "var(--app-text)" }}>
                    {title}
                  </h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: "var(--app-surface)",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-muted)",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <p
                className="font-semibold text-sm leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {message}
              </p>

              <div
                className="flex gap-4 pt-4 justify-end"
                style={{ borderTop: "1px solid var(--app-border)" }}
              >
                <Button
                  variant="secondary"
                  onClick={onClose}
                  className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                >
                  {cancelLabel}
                </Button>
                <Button
                  variant={isDestructive ? "secondary" : "primary"}
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl"
                  style={
                    isDestructive
                      ? {
                          color: "#ef4444",
                          borderColor: "rgba(239, 68, 68, 0.2)",
                          backgroundColor: "rgba(239, 68, 68, 0.06)",
                        }
                      : undefined
                  }
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
