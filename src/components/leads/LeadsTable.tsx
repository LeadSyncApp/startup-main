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
            <th className="px-6 py-3 text-left">Customer Name</th>
            <th className="px-6 py-3 text-left">Contact / Phone</th>
            <th className="px-6 py-3 text-left">Channel</th>
            <th className="px-6 py-3 text-left">Last Interaction</th>
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
                {lead.name || "Unknown"}
              </td>

              <td className="px-6 py-4 text-slate-600">{lead.contact}</td>

              <td className="px-6 py-4 text-slate-600">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold">
                  {lead.channel}
                </span>
              </td>

              <td className="px-6 py-4 text-slate-500">
                {new Date(lead.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                No customers found yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
