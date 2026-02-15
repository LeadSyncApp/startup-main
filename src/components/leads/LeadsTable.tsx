interface LeadsTableProps {
  leads: any[];
  onRowClick?: (lead: any) => void;
}

export default function LeadsTable({
  leads,
  onRowClick,
}: LeadsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-6 py-3 text-left">Lead Name</th>
            <th className="px-6 py-3 text-left">Source</th>
            <th className="px-6 py-3 text-left">Priority</th>
            <th className="px-6 py-3 text-left">Status</th>
            <th className="px-6 py-3 text-left">Agent Assigned</th>
            <th className="px-6 py-3 text-left">Date</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {leads.map((lead) => (
            <tr
              key={lead.id}
              onClick={() => onRowClick?.(lead)}
              className="cursor-pointer hover:bg-slate-50 transition"
            >
              <td className="px-6 py-4 font-medium text-slate-900">
                {lead.name}
              </td>

              <td className="px-6 py-4">{lead.channel}</td>

              <td className="px-6 py-4">{lead.priority}</td>

              <td className="px-6 py-4">
                <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">
                  {lead.status}
                </span>
              </td>

              <td className="px-6 py-4">
                {lead.agentAssigned || "—"}
              </td>

              <td className="px-6 py-4">
                {new Date(lead.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
