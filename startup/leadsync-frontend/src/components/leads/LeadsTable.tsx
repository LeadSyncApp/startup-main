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
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    URGENT: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    NORMAL: "bg-slate-100 text-slate-600 border-slate-200",
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
    ORDERING: "text-green-600 bg-green-50 border-green-200",
    COMPLAINT: "text-red-600 bg-red-50 border-red-200",
    SUPPORT: "text-blue-600 bg-blue-50 border-blue-200",
  };
  return (
    <span className={`px-2 py-0.5 ml-2 rounded text-[10px] font-medium border ${colors[intent] || "text-gray-500"}`}>
      {intent}
    </span>
  );
};

const PendingOrderBadge = ({ state, claimedBy }: { state: string; claimedBy?: string }) => {
  if (state === "NONE") return null;
  
  if (state === "PENDING_APPROVAL") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
        <Clock size={10} />
        Pending Order
      </span>
    );
  }
  
  if (state === "CLAIMED_FOR_APPROVAL") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
        <UserCheck size={10} />
        Claimed by {claimedBy || "Agent"}
      </span>
    );
  }
  
  return null;
};

export default function LeadsTable({ leads, onRowClick, onClaim, onClaimPendingOrder, selectedIds, onSelect, onSelectAll, allSelected }: LeadsTableProps) {
  const hasSelect = !!onSelect;
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600 font-semibold tracking-wide">
            <tr>
              {hasSelect && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer accent-indigo-600"
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
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const isSelected = selectedIds?.has(lead.id);
              return (
              <motion.tr
                key={lead.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => onRowClick?.(lead)}
                className={`cursor-pointer transition duration-150 group ${
                  isSelected ? "bg-indigo-50/60" :
                  lead.priority === "URGENT" ? "bg-red-50/30 hover:bg-red-50" : "hover:bg-slate-50"
                }`}
              >
                {hasSelect && (
                  <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => onSelect?.(lead.id)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer accent-indigo-600"
                    />
                  </td>
                )}
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    {lead.name || "Unknown"}
                    {lead.segment === "VIP" && <span className="text-yellow-500 text-xs">⭐</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate max-w-[180px]">
                    {lead.lastMessage || "No messages yet"}
                  </div>
                  {lead.hasPendingOrderApproval && (
                    <div className="mt-1">
                      <PendingOrderBadge state={lead.pendingOrderState} claimedBy={lead.agentAssigned} />
                      {lead.pendingOrderAmount && (
                        <div className="text-xs font-semibold text-amber-600 mt-1">
                          Order: ₹{lead.pendingOrderAmount.toLocaleString()}
                        </div>
                      )}
                      {lead.pendingOrderSummary && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[180px]">
                          {lead.pendingOrderSummary}
                        </div>
                      )}
                    </div>
                  )}
                  {lead.suggestedAction && lead.suggestedAction !== "Monitor" && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      → {lead.suggestedAction}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1 w-16">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700">{lead.aiScore ?? 0}</span>
                      <span className="text-[9px] text-slate-400">/100</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (lead.aiScore ?? 0) >= 70 ? "bg-emerald-500" :
                          (lead.aiScore ?? 0) >= 40 ? "bg-amber-500" : "bg-red-400"
                        }`}
                        style={{ width: `${lead.aiScore ?? 0}%` }}
                      />
                    </div>
                    {(lead.daysSinceActive ?? 0) > 7 && (
                      <span className="text-[9px] text-red-500 font-bold">{lead.daysSinceActive}d inactive</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1">
                    <PriorityBadge priority={lead.priority} />
                    <IntentBadge intent={lead.intent} />
                    {lead.agentAssigned ? (
                      <span className="text-[10px] text-slate-500 font-mono mt-1 bg-slate-100 rounded px-1">
                        {lead.agentAssigned}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic mt-1">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  <div className="flex flex-col text-xs">
                    <span className="font-semibold text-slate-900">₹{lead.totalSpend?.toLocaleString() || "0"}</span>
                    <span className="text-slate-400">{lead.orderCount || 0} Orders</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold text-slate-600">{lead.channel}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col text-xs text-slate-400">
                      <span>{new Date(lead.lastActiveAt || lead.createdAt).toLocaleDateString()}</span>
                      <span>{new Date(lead.lastActiveAt || lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {lead.hasPendingOrderApproval && lead.pendingOrderState === "PENDING_APPROVAL" && (
                      <button
                        onClick={(e) => onClaimPendingOrder?.(lead.id, e)}
                        className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm hover:bg-amber-700 transition font-medium whitespace-nowrap ml-auto active:scale-95 flex items-center gap-1"
                      >
                        <Package size={12} />
                        Claim Order
                      </button>
                    )}
                    {!lead.agentAssigned && lead.conversationId && !lead.hasPendingOrderApproval && (
                      <button
                        onClick={(e) => onClaim?.(lead.conversationId, e)}
                        className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm hover:bg-indigo-700 transition font-medium whitespace-nowrap ml-auto active:scale-95"
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
            className={`bg-white rounded-xl border p-4 shadow-sm cursor-pointer active:scale-[0.98] transition-all ${
              isSelected ? "border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200" :
              lead.priority === "URGENT" ? "border-red-200 bg-red-50/30" : "border-slate-200"
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
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 cursor-pointer accent-indigo-600"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    {lead.name || "Unknown"}
                    {lead.segment === "VIP" && <span className="text-yellow-500 text-xs">⭐</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate max-w-[200px]">
                    {lead.lastMessage || "No messages yet"}
                  </p>
                  {lead.hasPendingOrderApproval && (
                    <div className="mt-1">
                      <PendingOrderBadge state={lead.pendingOrderState} claimedBy={lead.agentAssigned} />
                      {lead.pendingOrderAmount && (
                        <div className="text-xs font-semibold text-amber-600 mt-1">
                          Order: ₹{lead.pendingOrderAmount.toLocaleString()}
                        </div>
                      )}
                      {lead.pendingOrderSummary && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">
                          {lead.pendingOrderSummary}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-semibold text-slate-600 shrink-0">
                {lead.channel}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <PriorityBadge priority={lead.priority} />
                <IntentBadge intent={lead.intent} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700">₹{lead.totalSpend?.toLocaleString() || "0"}</span>
                {lead.hasPendingOrderApproval && lead.pendingOrderState === "PENDING_APPROVAL" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClaimPendingOrder?.(lead.id, e); }}
                    className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm font-medium active:scale-95 flex items-center gap-1"
                  >
                    <Package size={12} />
                    Claim Order
                  </button>
                )}
                {!lead.agentAssigned && lead.conversationId && !lead.hasPendingOrderApproval && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClaim?.(lead.conversationId, e); }}
                    className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm font-medium active:scale-95"
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
