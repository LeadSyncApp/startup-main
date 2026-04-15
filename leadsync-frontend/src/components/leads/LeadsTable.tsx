import { motion } from "framer-motion";
import { Package, Clock, UserCheck } from "lucide-react";

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
  // 🆕 User context for proper permission checks
  currentUser?: { id: string; role: string };
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    URGENT: "bg-red-500/10 text-red-400 border-red-500/20",
    HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    NORMAL: "bg-background-elevated text-text-muted border-border",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${colors[priority] || colors.NORMAL}`}>
      {priority}
    </span>
  );
};

const IntentBadge = ({ intent }: { intent: string }) => {
  if (!intent || intent === "BROWSING") return null;
  const colors: Record<string, string> = {
    ORDERING: "text-green-400 bg-green-500/10 border-green-500/20",
    COMPLAINT: "text-red-400 bg-red-500/10 border-red-500/20",
    SUPPORT: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  return (
    <span className={`px-2 py-0.5 ml-2 rounded text-[10px] font-medium border ${colors[intent] || "text-text-muted"}`}>
      {intent}
    </span>
  );
};

const PendingOrderBadge = ({ state, claimedBy }: { state: string; claimedBy?: string }) => {
  if (state === "NONE") return null;
  
  if (state === "PENDING_APPROVAL") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
        <Clock size={10} />
        New Order Arrival
      </span>
    );
  }
  
  if (state === "CLAIMED_FOR_APPROVAL") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-green-500/10 text-green-400 border-green-500/20 flex items-center gap-1">
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
      <div className="hidden md:block bg-background-secondary rounded-xl shadow-card border border-border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-background-tertiary text-xs uppercase text-text-muted font-semibold tracking-wide">
            <tr>
              {hasSelect && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-border text-accent cursor-pointer accent-indigo-500"
                    title="Select all"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left w-[25%]">Customer</th>
              <th className="px-6 py-3 text-left w-[12%]">AI Score</th>
              <th className="px-6 py-3 text-left w-[15%]">Status</th>
              <th className="px-6 py-3 text-left w-[15%]">Value (CRM)</th>
              <th className="px-6 py-3 text-left w-[13%]">Channel</th>
              <th className="px-6 py-3 text-left w-[20%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((lead) => {
              const isSelected = selectedIds?.has(lead.id);
              return (
              <motion.tr
                key={lead.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => onRowClick?.(lead)}
                className={`cursor-pointer transition duration-150 group ${
                  isSelected ? "bg-indigo-500/10" :
                  lead.priority === "URGENT" ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-background-tertiary/50"
                }`}
              >
                {hasSelect && (
                  <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => onSelect?.(lead.id)}
                      className="h-4 w-4 rounded border-border text-accent cursor-pointer accent-indigo-500"
                    />
                  </td>
                )}
                <td className="px-6 py-4">
                  <div className="font-bold text-text-primary flex items-center gap-2">
                    {lead.name || "Unknown"}
                    {lead.segment === "VIP" && <span className="text-yellow-500 text-xs">⭐</span>}
                  </div>
                  <div className="text-xs text-text-muted truncate max-w-[180px]">
                    {lead.lastMessage || "No messages yet"}
                  </div>
                  {lead.hasPendingOrderApproval && (
                    <div className="mt-1">
                      <PendingOrderBadge state={lead.pendingOrderState} claimedBy={lead.agentAssigned} />
                      {lead.pendingOrderAmount && (
                        <div className="text-xs font-semibold text-blue-400 mt-1">
                          Order: ₹{lead.pendingOrderAmount.toLocaleString()}
                        </div>
                      )}
                      {lead.pendingOrderSummary && (
                        <div className="text-xs text-text-muted mt-0.5 truncate max-w-[180px]">
                          {lead.pendingOrderSummary}
                        </div>
                      )}
                      {/* 🆕 Customer history context */}
                      {lead.isExistingCustomer && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-text-secondary font-medium">
                            📦 Existing Customer ({lead.previousOrderCount} orders, ₹{lead.previousSpend?.toLocaleString()})
                          </div>
                          {lead.previousAgentName && (
                            <div className="text-xs text-text-muted italic">
                              Previously handled by: {lead.previousAgentName}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {lead.suggestedAction && lead.suggestedAction !== "Monitor" && (
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                      → {lead.suggestedAction}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1 w-16">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-text-secondary">{lead.aiScore ?? 0}</span>
                      <span className="text-[9px] text-text-disabled">/100</span>
                    </div>
                    <div className="h-1.5 bg-background-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (lead.aiScore ?? 0) >= 70 ? "bg-emerald-500" :
                          (lead.aiScore ?? 0) >= 40 ? "bg-amber-500" : "bg-red-400"
                        }`}
                        style={{ width: `${lead.aiScore ?? 0}%` }}
                      />
                    </div>
                    {(lead.daysSinceActive ?? 0) > 7 && (
                      <span className="text-[9px] text-red-400 font-bold">{lead.daysSinceActive}d inactive</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1">
                    <PriorityBadge priority={lead.priority} />
                    <IntentBadge intent={lead.intent} />
                    {lead.agentAssigned ? (
                      <span className="text-[10px] text-text-muted font-mono mt-1 bg-background-tertiary rounded px-1">
                        {lead.agentAssigned}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-disabled italic mt-1">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-text-secondary">
                  <div className="flex flex-col text-xs">
                    <span className="font-semibold text-text-primary">₹{lead.totalSpend?.toLocaleString() || "0"}</span>
                    <span className="text-text-disabled">{lead.orderCount || 0} Orders</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-background-tertiary px-2 py-1 rounded text-xs font-semibold text-text-secondary">{lead.channel}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col text-xs text-text-disabled">
                      <span>{new Date(lead.lastActiveAt || lead.createdAt).toLocaleDateString()}</span>
                      <span>{new Date(lead.lastActiveAt || lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {lead.hasPendingOrderApproval && lead.pendingOrderState === "PENDING_APPROVAL" && (
                      <button
                        onClick={(e) => onClaimPendingOrder?.(lead.id, e)}
                        disabled={!lead.canCurrentUserClaim && currentUser?.role !== "ADMIN" && currentUser?.role !== "OWNER"}
                        className={`text-xs px-3 py-1.5 rounded-md shadow-sm transition font-medium whitespace-nowrap ml-auto active:scale-95 flex items-center gap-1 ${
                          lead.canCurrentUserClaim || currentUser?.role === "ADMIN" || currentUser?.role === "OWNER"
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "bg-background-elevated text-text-disabled cursor-not-allowed"
                        }`}
                      >
                        <Package size={12} />
                        {lead.pendingOrderClaimedById ? "View Order" : "Claim Order"}
                      </button>
                    )}
                    {!lead.agentAssigned && lead.conversationId && !lead.hasPendingOrderApproval && (
                      <button
                        onClick={(e) => onClaim?.(lead.conversationId, e)}
                        className="bg-accent text-white text-xs px-3 py-1.5 rounded-md shadow-sm hover:bg-accent-hover transition font-medium whitespace-nowrap ml-auto active:scale-95"
                      >
                        Claim Chat
                      </button>
                    )}
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
            className={`bg-background-secondary rounded-xl border p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all ${
              isSelected ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30" :
              lead.priority === "URGENT" ? "border-red-500/30 bg-red-500/5" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start gap-2">
                {hasSelect && (
                  <div onClick={e => { e.stopPropagation(); onSelect?.(lead.id); }} className="mt-0.5">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => onSelect?.(lead.id)}
                      className="h-4 w-4 rounded border-border text-accent cursor-pointer accent-indigo-500"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                )}
                <div>
                  <p className="font-bold text-text-primary flex items-center gap-1.5">
                    {lead.name || "Unknown"}
                    {lead.segment === "VIP" && <span className="text-yellow-500 text-xs">⭐</span>}
                  </p>
                  <p className="text-xs text-text-muted truncate max-w-[200px]">
                    {lead.lastMessage || "No messages yet"}
                  </p>
                  {lead.hasPendingOrderApproval && (
                    <div className="mt-1">
                      <PendingOrderBadge state={lead.pendingOrderState} claimedBy={lead.agentAssigned} />
                      {lead.pendingOrderAmount && (
                        <div className="text-xs font-semibold text-blue-400 mt-1">
                          Order: ₹{lead.pendingOrderAmount.toLocaleString()}
                        </div>
                      )}
                      {lead.pendingOrderSummary && (
                        <div className="text-xs text-text-muted mt-0.5 truncate max-w-[200px]">
                          {lead.pendingOrderSummary}
                        </div>
                      )}
                      {/* 🆕 Customer history context */}
                      {lead.isExistingCustomer && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-text-secondary font-medium">
                            📦 Existing Customer ({lead.previousOrderCount} orders, ₹{lead.previousSpend?.toLocaleString()})
                          </div>
                          {lead.previousAgentName && (
                            <div className="text-xs text-text-muted italic">
                              Previously handled by: {lead.previousAgentName}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="bg-background-tertiary px-2 py-1 rounded text-[10px] font-semibold text-text-secondary shrink-0">
                {lead.channel}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={lead.priority} />
                <IntentBadge intent={lead.intent} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-secondary">₹{lead.totalSpend?.toLocaleString() || "0"}</span>
                {lead.hasPendingOrderApproval && lead.pendingOrderState === "PENDING_APPROVAL" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClaimPendingOrder?.(lead.id, e); }}
                    disabled={!lead.canCurrentUserClaim && currentUser?.role !== "ADMIN" && currentUser?.role !== "OWNER"}
                    className={`text-xs px-3 py-1.5 rounded-md shadow-sm font-medium active:scale-95 flex items-center gap-1 ${
                      lead.canCurrentUserClaim || currentUser?.role === "ADMIN" || currentUser?.role === "OWNER"
                        ? "bg-blue-600 text-white"
                        : "bg-background-elevated text-text-disabled cursor-not-allowed"
                    }`}
                  >
                    <Package size={12} />
                    {lead.pendingOrderClaimedById ? "View Order" : "Claim Order"}
                  </button>
                )}
                {!lead.agentAssigned && lead.conversationId && !lead.hasPendingOrderApproval && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClaim?.(lead.conversationId, e); }}
                    className="bg-accent text-white text-xs px-3 py-1.5 rounded-md shadow-sm font-medium active:scale-95"
                  >
                    Claim
                  </button>
                )}
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
    </>
  );
}
