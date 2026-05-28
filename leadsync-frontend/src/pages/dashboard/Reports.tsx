import { useState, useEffect } from "react";
import { BarChart3, Download, TrendingUp, TrendingDown, Info } from "lucide-react";
import { api } from "../../lib/api";
import { formatINR } from "../../utils/formatINR";
import { PageTransition } from "../../components/ui/Animations";

async function downloadFile(endpoint: string, filename: string) {
  const token = localStorage.getItem("token");
  const base = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") || "";
  const res = await fetch(`${base}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [stats, setStats] = useState<any>(null);
  const [exportingOrders, setExportingOrders] = useState(false);
  const [exportingLeads, setExportingLeads] = useState(false);

  useEffect(() => {
    api.get("/analytics/revenue").then(setStats).catch(console.error);
  }, []);

  const trend: number | null = stats?.trend ?? null;
  const trendPositive = trend !== null && trend >= 0;

  return (
    <PageTransition className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-app-text">Reports & Analytics</h1>
        <p className="mt-1 text-app-muted">
          General business performance reports.
        </p>
      </div>

      <div className="grid gap-4 lg:gap-6 md:grid-cols-2">
        {/* Performance Summary */}
        <div className="rounded-2xl border bg-app-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-app-text">Performance Overview</h2>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>

          {!stats ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex justify-between py-2 border-b border-slate-50">
                  <div className="h-4 bg-app-bg-soft rounded w-1/3" />
                  <div className="h-4 bg-app-bg-soft rounded w-1/5" />
                </div>
              ))}
            </div>
          ) : (
          <div className="space-y-3">
            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
              <span className="text-app-muted">Total Generated Revenue</span>
              <span className="font-bold text-app-text">{formatINR(stats?.totalRevenue || 0)}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
              <span className="text-app-muted">Total Delivered Orders</span>
              <span className="font-bold text-app-text">{stats?.orderCount || 0}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
              <span className="text-app-muted">Avg. Order Value</span>
              <span className="font-bold text-app-text">{formatINR(stats?.avgOrderValue || 0)}</span>
            </div>
            <div className="flex justify-between text-sm py-2">
              <span className="text-app-muted">vs Previous Period</span>
              {trend !== null ? (
                <span className={`font-medium flex items-center gap-1 ${trendPositive ? "text-emerald-600" : "text-red-500"}`}>
                  {trendPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(trend).toFixed(1)}% {trendPositive ? "growth" : "decline"}
                </span>
              ) : (
                <span className="text-slate-400 text-xs">Not enough data</span>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Export Center */}
        <div className="rounded-2xl border bg-slate-900 p-6 shadow-sm text-white space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Export Data</h2>
            <Download className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">Download your order and lead history for external analysis.</p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              disabled={exportingOrders}
              onClick={async () => {
                setExportingOrders(true);
                try { await downloadFile("/analytics/export", `leadsync-orders-${Date.now()}.xlsx`); }
                catch { /* toast handled by caller */ }
                finally { setExportingOrders(false); }
              }}
              className="bg-app-surface/10 hover:bg-app-surface/20 disabled:opacity-50 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exportingOrders ? "Exporting…" : "Orders.xlsx"}
            </button>
            <button
              disabled={exportingLeads}
              onClick={async () => {
                setExportingLeads(true);
                try { await downloadFile("/analytics/export-leads", `leadsync-leads-${Date.now()}.xlsx`); }
                catch { /* silent */ }
                finally { setExportingLeads(false); }
              }}
              className="bg-app-surface/10 hover:bg-app-surface/20 disabled:opacity-50 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {exportingLeads ? "Exporting…" : "Leads.xlsx"}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-app-primary/10 border border-app-primary/20 rounded-2xl p-6 flex gap-4">
        <div className="bg-app-primary/10 p-2 rounded-lg h-fit">
          <Info className="text-app-primary" size={20} />
        </div>
        <div>
          <h3 className="text-app-primary font-semibold text-sm">Automated Reporting</h3>
          <p className="text-app-primary text-xs mt-1 leading-relaxed">
            LeadSync tracks all deliveries and revenue automatically using the Telegram integration.
            Detailed per-agent performance reports are available on the Revenue page.
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
