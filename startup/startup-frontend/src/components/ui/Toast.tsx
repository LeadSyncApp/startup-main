/**
 * Toast Notification - Alert/notification component
 * Usage: Place in layout and control via context or state
 */
import { X } from 'lucide-react';
import type { ToastMessage } from '../../types';

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const typeStyles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 shadow-lg ${typeStyles[toast.type]}`}
      role="alert"
    >
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="rounded p-1 hover:bg-black/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
