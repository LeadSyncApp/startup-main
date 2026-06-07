import { useState, useEffect } from "react";
import { api } from "../../lib/api";

export function AuditLogsSection() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await api.get("/audit-logs");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border border-[var(--app-border)] space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span>📋</span> Security Audit Logs
        </h2>
        <p className="text-sm text-slate-500">
          Track and review system-level changes across your organization.
        </p>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-widest text-[10px]">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
             {isLoading ? (
               <tr>
                 <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Loading audit trail...</td>
               </tr>
             ) : (!logs || logs.length === 0) ? (
               <tr>
                 <td colSpan={4} className="px-4 py-8 text-center text-slate-400">No recent security events found.</td>
               </tr>
             ) : (
               logs.map((log) => (
                 <tr key={log.id} className="hover:bg-slate-50 transition">
                   <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                     {new Date(log.createdAt).toLocaleString()}
                   </td>
                   <td className="px-4 py-3">
                     <span className="font-semibold text-slate-700">{log.user?.name || "System"}</span>
                     <div className="text-[10px] text-slate-400">{log.user?.email || ""}</div>
                   </td>
                   <td className="px-4 py-3">
                     <span className="bg-blue-50 text-blue-700 font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-blue-100">
                       {log.action}
                     </span>
                   </td>
                   <td className="px-4 py-3">
                     <pre className="text-[9px] bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-600 font-mono max-w-[200px] overflow-x-auto">
                       {log.metadata ? JSON.stringify(log.metadata, null, 2) : "-"}
                     </pre>
                   </td>
                 </tr>
               ))
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
