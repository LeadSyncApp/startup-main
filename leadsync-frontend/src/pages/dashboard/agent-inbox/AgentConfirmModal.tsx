import { ConfirmModalState } from "./types";

interface Props {
  confirmModal: ConfirmModalState;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState>>;
}

export function AgentConfirmModal({ confirmModal, setConfirmModal }: Props) {
  if (!confirmModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--app-backdrop)] backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-app-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all border border-app animate-in fade-in zoom-in-95 duration-200">
        <div className="p-8">
          <h3 className="text-xl font-bold text-app-text mb-2">
            {confirmModal.title}
          </h3>
          <p className="text-sm text-app-text-muted leading-relaxed">
            {confirmModal.message}
          </p>
        </div>
        <div className="bg-app-bg-soft px-8 py-5 flex items-center justify-end gap-3 border-t border-app">
          <button
            onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
            className="px-5 py-2.5 text-sm font-bold text-app-text-muted bg-app-surface border border-app rounded-xl hover:bg-app-bg transition active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              const onConfirm = confirmModal.onConfirm;
              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
              await onConfirm();
            }}
            className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition shadow-lg shadow-red-500/20 active:scale-95"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}
