import { ConfirmModalState } from "./types";

interface Props {
  confirmModal: ConfirmModalState;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState>>;
}

export function AgentConfirmModal({ confirmModal, setConfirmModal }: Props) {
  if (!confirmModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-app-surface rounded-xl shadow-2xl max-w-md w-full overflow-hidden transform scale-100 transition-all border border-app animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <h3 className="text-lg font-bold text-app-text mb-2">
            {confirmModal.title}
          </h3>
          <p className="text-sm text-app-muted">
            {confirmModal.message}
          </p>
        </div>
        <div className="bg-app-bg px-6 py-4 flex items-center justify-end gap-3 border-t border-app">
          <button
            onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-app-surface border border-slate-300 rounded-lg hover:bg-app-bg transition"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              const onConfirm = confirmModal.onConfirm;
              setConfirmModal((prev) => ({ ...prev, isOpen: false }));
              await onConfirm();
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition shadow-sm hover:shadow"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}
