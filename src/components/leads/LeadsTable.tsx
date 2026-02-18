import { motion } from "framer-motion";

interface LeadsTableProps {
  leads: any[];
  onRowClick?: (lead: any) => void;
  onClaim?: (conversationId: string, e: any) => void;
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

export default function LeadsTable({ leads, onRowClick, onClaim }: LeadsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600 font-semibold tracking-wide">
          <tr>
            <th className="px-6 py-3 text-left w-[25%]">Customer</th>
            <th className="px-6 py-3 text-left w-[15%]">Status</th>
            <th className="px-6 py-3 text-left w-[20%]">Value (CRM)</th>
            <th className="px-6 py-3 text-left w-[15%]">Channel</th>
            <th className="px-6 py-3 text-left w-[25%]">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <motion.tr
              key={lead.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => onRowClick?.(lead)}
              className={`cursor-pointer transition duration-150 group ${lead.priority === "URGENT" ? "bg-red-50/30 hover:bg-red-50" : "hover:bg-slate-50"
                }`}
            >
              {/* Customer Name & Message Preview */}
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  {lead.name || "Unknown"}
                  {lead.segment === "VIP" && <span className="text-yellow-500 text-xs">⭐</span>}
                </div>
                <div className="text-xs text-slate-500 truncate max-w-[180px]">
                  {lead.lastMessage || "No messages yet"}
                </div>
              </td>

              {/* Priority & Intent */}
              <td className="px-6 py-4">
                <div className="flex flex-col items-start gap-1">
                  <PriorityBadge priority={lead.priority} />
                  <IntentBadge intent={lead.intent} />
                  {/* Assigned Agent badge */}
                  {lead.agentAssigned ? (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 w-full bg-slate-100 rounded px-1">
                      👤 {lead.agentAssigned}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic mt-1">Unassigned</span>
                  )}
                </div>
              </td>

              {/* CRM Value Stats */}
              <td className="px-6 py-4 text-slate-600">
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-slate-900">
                    ₹{lead.totalSpend?.toLocaleString() || "0"}
                  </span>
                  <span className="text-slate-400">
                    {lead.orderCount || 0} Orders
                  </span>
                </div>
              </td>

              {/* Channel */}
              <td className="px-6 py-4">
                <span className="bg-slate-100 px-2 py-1 rounded text-xs font-semibold text-slate-600">
                  {lead.channel}
                </span>
              </td>

              {/* Actions */}
              <td className="px-6 py-4">
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col text-xs text-slate-400">
                    <span>{new Date(lead.lastActiveAt || lead.createdAt).toLocaleDateString()}</span>
                    <span>{new Date(lead.lastActiveAt || lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {!lead.agentAssigned && lead.conversationId && (
                    <button
                      onClick={(e) => onClaim?.(lead.conversationId, e)}
                      className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-md shadow-sm hover:bg-indigo-700 transition font-medium whitespace-nowrap ml-auto"
                    >
                      Claim Chat
                    </button>
                  )}
                </div>
              </td>
            </motion.tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                No active conversations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
