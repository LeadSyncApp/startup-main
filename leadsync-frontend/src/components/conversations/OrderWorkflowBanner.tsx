interface ActiveOrder {
  id: string;
  status: string;
  summary: string;
  amount?: number | null;
  version: number;
}

interface OrderWorkflowBannerProps {
  activeOrder: ActiveOrder | null;
  customerName: string;
  onApproveReject: (action: 'approve' | 'reject') => void;
  onUpdateStatus: (newStatus: string) => void;
  onTakeCustomOrder: () => void;
}

const getNextStatuses = (current: string) => {
  switch (current) {
    case 'PENDING':
    case 'USER_CONFIRMED_PENDING_AGENT':
    case 'NEW':
      return [
        { status: 'PROCESSING', label: '⚙️ Accept Order', color: 'bg-indigo-600 hover:bg-indigo-700' },
        { status: 'CANCELLED', label: '🚫 Cancel Order', color: 'bg-slate-500 hover:bg-slate-600' }
      ];
    case 'PROCESSING':
    case 'CONFIRMED':
    case 'PREPARING':
    case 'READY':
    case 'SHIPPED':
    case 'DELIVERED':
      return [
        { status: 'CANCELLED', label: '🚫 Cancel Order', color: 'bg-slate-500 hover:bg-slate-600' }
      ];
    default:
      return [
        { status: 'PROCESSING', label: '⚙️ Move to Processing', color: 'bg-cyan-600 hover:bg-cyan-700' },
        { status: 'CANCELLED', label: '🚫 Cancel Order', color: 'bg-slate-500 hover:bg-slate-600' }
      ];
  }
};

export const OrderWorkflowBanner = ({
  activeOrder,
  customerName,
  onApproveReject,
  onUpdateStatus,
  onTakeCustomOrder
}: OrderWorkflowBannerProps) => {

  // Completed or Terminal Orders
  if (activeOrder && ['COMPLETED', 'DELIVERED', 'ARCHIVED', 'CANCELLED', 'REJECTED'].includes(activeOrder.status.toUpperCase())) {
    return null;
  }

  // Awaiting Agent Confirmation
  if (activeOrder && ['PENDING', 'USER_CONFIRMED_PENDING_AGENT'].includes(activeOrder.status)) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/60 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner font-sans">
        <div className="flex gap-2.5 items-start">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">shopping_cart_checkout</span>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-amber-800 tracking-tight">Customer Order Request</h4>
            <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
              Items: <strong className="text-app-text font-bold">{activeOrder.summary}</strong> ({activeOrder.amount ? `₹${activeOrder.amount}` : "Pending Amount"})
            </p>
            <span className="inline-flex items-center gap-1 text-[9px] bg-amber-200 text-amber-800 font-black uppercase px-2 py-0.5 rounded-full mt-1.5 shadow-sm border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
              Status: Awaiting Agent Confirmation
            </span>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => onApproveReject('approve')}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1 border border-emerald-500/10"
          >
            <span className="material-symbols-outlined text-[15px]">done</span>
            <span>Accept Order</span>
          </button>
          <button
            type="button"
            onClick={() => onApproveReject('reject')}
            className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-xs uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1 border border-rose-500/10"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
            <span>Reject Order</span>
          </button>
        </div>
      </div>
    );
  }

  // Active Processing Orders
  if (activeOrder && ['PROCESSING', 'PREPARING', 'READY', 'SHIPPED', 'NEW', 'CONFIRMED'].includes(activeOrder.status)) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200/50 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm font-sans">
        <div className="flex gap-2.5 items-start">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[18px]">engineering</span>
          </div>
          <div>
            <h4 className="text-xs font-black uppercase text-blue-800 tracking-tight">Active Customer Order</h4>
            <p className="text-[11px] text-blue-700 font-semibold mt-0.5">
              Items: <strong className="text-app-text font-bold">{activeOrder.summary}</strong> ({activeOrder.amount ? `₹${activeOrder.amount}` : "Pending Amount"})
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 text-[9px] bg-blue-100/80 text-blue-800 font-black uppercase px-2.5 py-1 rounded-full shadow-sm border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                Stage: {activeOrder.status}
              </span>
              <span className="text-[10px] text-slate-400 font-medium font-mono">
                v{activeOrder.version}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {getNextStatuses(activeOrder.status).map((opt) => (
            <button
              key={opt.status}
              type="button"
              onClick={() => onUpdateStatus(opt.status)}
              className={`px-3 py-1.5 ${opt.color} text-white font-extrabold text-[10px] uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1`}
            >
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // No active Order
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-200/50 p-4 shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm font-sans">
      <div className="flex gap-2.5 items-start">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
        </div>
        <div>
          <h4 className="text-xs font-black uppercase text-emerald-800 tracking-tight">No Active Order for {customerName}</h4>
          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 font-sans">
            You can instantly record a manual order taken during this chat thread.
          </p>
        </div>
      </div>
      <button
        type="button"
        id="take-order-during-chat-btn"
        onClick={onTakeCustomOrder}
        className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs uppercase rounded-lg transition-transform hover:scale-[1.02] active:scale-95 shadow-sm flex items-center justify-center gap-1.5 border border-emerald-500/10 font-sans"
      >
        <span className="material-symbols-outlined text-[15px]">shopping_cart</span>
        <span>Take Custom Order</span>
      </button>
    </div>
  );
};
