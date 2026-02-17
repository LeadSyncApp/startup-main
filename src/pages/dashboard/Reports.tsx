import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, TrendingUp, Info } from "lucide-react";
import { api } from "../../lib/api";
import { formatINR } from "../../utils/formatINR";

export default function Reports() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get("/analytics/revenue").then(setStats).catch(console.error);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="mt-1 text-slate-500">
          General business performance reports.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Performance Summary */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Performance Overview</h2>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
              <span className="text-slate-500">Total Generated Revenue</span>
              <span className="font-bold text-slate-900">{formatINR(stats?.totalRevenue || 0)}</span>
            </div>
            <div className="flex justify-between text-sm py-2 border-b border-slate-50">
              <span className="text-slate-500">Total Delivered Orders</span>
              <span className="font-bold text-slate-900">{stats?.orderCount || 0}</span>
            </div>
            <div className="flex justify-between text-sm py-2">
              <span className="text-slate-500">Growth Status</span>
              <span className="text-emerald-600 font-medium flex items-center gap-1">
                <TrendingUp size={14} /> Stable
              </span>
            </div>
          </div>
        </div>

        {/* Export Center */}
        <div className="rounded-2xl border bg-slate-900 p-6 shadow-sm text-white space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Export Data</h2>
            <Download className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">Download your order and lead history for external analysis.</p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button className="bg-white/10 hover:bg-white/20 py-2 rounded-lg text-xs font-medium transition italic">
              Orders.csv
            </button>
            <button className="bg-white/10 hover:bg-white/20 py-2 rounded-lg text-xs font-medium transition italic">
              Leads.csv
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-cyan-50 border border-cyan-100 rounded-2xl p-6 flex gap-4">
        <div className="bg-cyan-100 p-2 rounded-lg h-fit">
          <Info className="text-cyan-600" size={20} />
        </div>
        <div>
          <h3 className="text-cyan-900 font-semibold text-sm">Automated Reporting</h3>
          <p className="text-cyan-700 text-xs mt-1 leading-relaxed">
            LeadSync tracks all deliveries and revenue automatically using the Telegram integration.
            Detailed per-agent performance reports are coming in the next update.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
