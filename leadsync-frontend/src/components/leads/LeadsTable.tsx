import { motion } from "framer-motion";
import { Package, Clock, UserCheck, MoreVertical } from "lucide-react";

interface LeadsTableProps {
  leads: any[];
  onRowClick?: (lead: any) => void;
  onClaim?: (conversationId: string, e: any) => void;
  onClaimPendingOrder?: (leadId: string, e: any) => void;
  // bulk select
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  // User context for proper permission checks
  currentUser?: { id: string; role: string };
}

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const Avatar = ({ name }: { name: string }) => (
  <div className="h-8 w-8 rounded-full bg-app-primary/10 text-app-primary flex items-center justify-center font-bold text-xs shrink-0 border border-app-primary/20">
    {getInitials(name)}
  </div>
);

const AIScoreBar = ({ score }: { score: number }) => {
  const safeScore = score ?? 0;
  const color = safeScore >= 80 ? "bg-emerald-500" : safeScore >= 50 ? "bg-teal-400" : "bg-blue-400";
  return (
    <div className="flex items-center gap-2 w-full max-w-[100px]">
      <span className="text-xs font-semibold text-app-text w-6">{safeScore}</span>
      <div className="h-1.5 flex-1 bg-app-bg-soft rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    URGENT: "bg-red-50 text-red-700 border-red-200",
    HIGH: "bg-app-primary/10 text-app-primary border-app-primary/20",
    NORMAL: "bg-app-bg text-app-muted border-app-border",
  };
  const style = styles[status?.toUpperCase()] || styles.NORMAL;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${style}`}>
      {status || "NORMAL"}
    </span>
  );
};

const PendingOrderBadge = ({ state, claimedBy }: { state: string; claimedBy?: string }) => {
  if (state === "NONE" || !state) return null;
  
  if (state === "PENDING_APPROVAL") {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border bg-app-primary/10 text-app-primary border-app-primary/20 flex items-center gap-1 mt-1 w-fit">
        <Clock size={10} />
        New Order Arrival
      </span>
    );
  }
  
  if (state === "CLAIMED_FOR_APPROVAL") {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium border bg-green-50 text-green-700 border-green-200 flex items-center gap-1 mt-1 w-fit">
        <UserCheck size={10} />
        Claimed by {claimedBy || "Agent"}
      </span>
    );
  }
  
  return null;
};

export default function LeadsTable({ leads, onRowClick, onClaim, onClaimPendingOrder, selectedIds, onSelect, onSelectAll, allSelected, currentUser }: LeadsTableProps) {
  const hasSelect = !!onSelect;
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block bg-app-surface rounded-xl shadow-sm border border-app-border overflow-hidden relative max-h-[70vh] overflow-y-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-app-bg text-xs uppercase text-app-muted font-semibold tracking-wide border-b border-app-border sticky top-0 z-10">
            <tr>
              {hasSelect && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-app-border-strong text-app-primary cursor-pointer accent-blue-600 focus:ring-blue-500"
                    title="Select all"
                  />
                </th>
              )}
              <th className="px-6 py-4 font-semibold w-[30%]">Customer</th>
              <th className="px-6 py-4 font-semibold w-[15%]">AI Score</th>
              <th className="px-6 py-4 font-semibold w-[15%]">Status</th>
              <th className="px-6 py-4 font-semibold w-[15%]">Value</th>
              <th className="px-6 py-4 font-semibold w-[15%]">Channel</th>
              <th className="px-4 py-4 font-semibold w-[10%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const isSelected = selectedIds?.has(lead.id);
              return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onRowClick?.(lead)}
                  className={`cursor-pointer transition-colors group ${
                    isSelected ? "bg-app-primary/10" : "hover:bg-app-bg"
                  }`}
                >
                  {hasSelect && (
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => onSelect?.(lead.id)}
                        className="h-4 w-4 rounded border-app-border-strong text-app-primary cursor-pointer accent-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={lead.name} />
                      <div className="flex flex-col min-w-0">
                        <div className="font-semibold text-app-text truncate flex items-center gap-2">
                          {lead.name || "Unknown"}
                          {lead.segment === "VIP" && <span className="text-yellow-500 text-[10px]">VIP</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">
                          {lead.email || lead.phone || lead.lastMessage || "No contact info"}
                        </div>
                        
                        {/* Pending Orders Context */}
                        {lead.hasPendingOrderApproval && (
                          <div className="mt-1">
                            <PendingOrderBadge state={lead.pendingOrderState} claimedBy={lead.agentAssigned} />
                            {lead.pendingOrderAmount && (
                              <div className="text-[10px] font-semibold text-app-primary mt-1">
                                Order: ₹{lead.pendingOrderAmount.toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                        {lead.isExistingCustomer && (
                          <div className="mt-1 text-[10px] text-app-muted">
                            {lead.previousOrderCount} previous orders
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <AIScoreBar score={lead.aiScore} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge status={lead.priority} />
                      {lead.agentAssigned && (
                         <span className="text-[10px] text-slate-400 truncate w-full max-w-[100px]">
                           Agent: {lead.agentAssigned}
                         </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-app-text">
                    <div className="font-mono text-sm font-semibold">
                      ₹{lead.totalSpend?.toLocaleString() || "0"}
                    </div>
                    {lead.orderCount > 0 && <div className="text-[10px] text-slate-400">{lead.orderCount} Orders</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-app-bg-soft text-app-muted capitalize">
                      {lead.channel?.toUpperCase() === "WEBSITE" ? "offline" : (lead.channel?.toLowerCase() || "unknown")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      {lead.hasPendingOrderApproval && lead.pendingOrderState === "PENDING_APPROVAL" && (
                        <button
                          onClick={(e) => onClaimPendingOrder?.(lead.id, e)}
                          disabled={!lead.canCurrentUserClaim && currentUser?.role !== "ADMIN" && currentUser?.role !== "OWNER"}
                          className={`text-xs px-2.5 py-1.5 rounded shadow-sm font-medium transition whitespace-nowrap active:scale-95 flex items-center gap-1 ${
                            lead.canCurrentUserClaim || currentUser?.role === "ADMIN" || currentUser?.role === "OWNER"
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-app-bg-soft text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <Package size={12} />
                          {lead.pendingOrderClaimedById ? "View" : "Claim"}
                        </button>
                      )}
                      {!lead.agentAssigned && lead.conversationId && !lead.hasPendingOrderApproval && (
                        <button
                          onClick={(e) => onClaim?.(lead.conversationId, e)}
                          className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded shadow-sm hover:bg-slate-800 transition font-medium whitespace-nowrap active:scale-95"
                        >
                          Take over
                        </button>
                      )}
                      
                      {/* Vertical Ellipsis Actions Menu trigger */}
                      <button className="p-1.5 text-slate-400 hover:text-app-text rounded transition-colors focus:ring-2 focus:ring-app-primary/25 outline-none hover:bg-app-bg-soft ml-1">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {leads.map((lead) => {
          const isSelected = selectedIds?.has(lead.id);
          return (
            <motion.div
              key={lead.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onRowClick?.(lead)}
              className={`bg-app-surface rounded-xl border p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all ${
                isSelected ? "border-app-primary/20 bg-app-primary/10 ring-1 ring-app-primary/25" : "border-app-border"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  {hasSelect && (
                    <div onClick={(e) => { e.stopPropagation(); onSelect?.(lead.id); }} className="mt-1">
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => onSelect?.(lead.id)}
                        className="h-4 w-4 rounded border-app-border-strong text-app-primary cursor-pointer accent-blue-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  <Avatar name={lead.name} />
                  <div>
                    <p className="font-semibold text-app-text flex items-center gap-1.5">
                      {lead.name || "Unknown"}
                      {lead.segment === "VIP" && <span className="text-yellow-500 text-[10px] font-bold">VIP</span>}
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">
                      {lead.email || lead.phone || lead.lastMessage || "No messages yet"}
                    </p>
                    {lead.hasPendingOrderApproval && (
                      <div className="mt-1.5">
                        <PendingOrderBadge state={lead.pendingOrderState} claimedBy={lead.agentAssigned} />
                        {lead.pendingOrderAmount && (
                          <div className="text-xs font-semibold text-app-primary mt-1">
                            Order: ₹{lead.pendingOrderAmount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                   <StatusBadge status={lead.priority} />
                   <button className="p-1 text-slate-300 hover:text-app-muted -mr-1" onClick={(e) => e.stopPropagation()}>
                     <MoreVertical size={16} />
                   </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-app-border">
                <div className="flex flex-col gap-1 w-24">
                  <span className="text-[10px] uppercase font-bold text-slate-400">AI Score</span>
                  <AIScoreBar score={lead.aiScore} />
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-sm font-semibold text-app-text">
                    ₹{lead.totalSpend?.toLocaleString() || "0"}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">{lead.channel?.toUpperCase() === "WEBSITE" ? "offline" : lead.channel?.toLowerCase()}</span>
                </div>
              </div>

              {/* Mobile Actions */}
              {(lead.hasPendingOrderApproval || !lead.agentAssigned) && (
                <div className="mt-4 pt-3 border-t border-app-border flex justify-end">
                  {lead.hasPendingOrderApproval && lead.pendingOrderState === "PENDING_APPROVAL" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onClaimPendingOrder?.(lead.id, e); }}
                      disabled={!lead.canCurrentUserClaim && currentUser?.role !== "ADMIN" && currentUser?.role !== "OWNER"}
                      className={`text-xs px-4 py-2 rounded-lg shadow-sm font-medium flex items-center gap-2 ${
                        lead.canCurrentUserClaim || currentUser?.role === "ADMIN" || currentUser?.role === "OWNER"
                          ? "bg-blue-600 text-white"
                          : "bg-app-bg-soft text-slate-400"
                      }`}
                    >
                      <Package size={14} />
                      {lead.pendingOrderClaimedById ? "View Order" : "Claim Order"}
                    </button>
                  )}
                  {!lead.agentAssigned && lead.conversationId && !lead.hasPendingOrderApproval && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onClaim?.(lead.conversationId, e); }}
                      className="bg-slate-900 text-white text-xs px-4 py-2 rounded-lg shadow-sm font-medium"
                    >
                      Take over chat
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
