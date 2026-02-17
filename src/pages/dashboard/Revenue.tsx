import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Clock,
} from "lucide-react";
import { formatINR } from "../../utils/formatINR";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function Revenue() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/analytics/revenue");
        setData(res);
      } catch (err) {
        console.error("Failed to fetch revenue data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  const totalRevenue = data?.totalRevenue || 0;
  const orderCount = data?.orderCount || 0;
  const timeline = data?.timeline || [];
  const recentOrders = data?.recentOrders || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Revenue Insights</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track your sales performance and delivered orders.
        </p>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900">{formatINR(totalRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100">
              <Receipt className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders Delivered</p>
              <p className="text-2xl font-bold text-slate-900">{orderCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
              <TrendingUp className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Order Value</p>
              <p className="text-2xl font-bold text-slate-900">
                {formatINR(orderCount > 0 ? totalRevenue / orderCount : 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CHART */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-6">Revenue Growth (Last 6 Months)</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(v: any) => formatINR(v)}
              />
              <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RECENT SALES */}
      <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Deliveries</h2>
          <Clock className="h-4 w-4 text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {recentOrders.map((o: any, idx: number) => (
            <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition">
              <div>
                <p className="font-medium text-slate-900">{o.customer}</p>
                <p className="text-xs text-slate-500">{new Date(o.date).toLocaleDateString()}</p>
              </div>
              <p className="font-bold text-emerald-600">{formatINR(o.amount)}</p>
            </div>
          ))}
          {recentOrders.length === 0 && (
            <p className="p-10 text-center text-slate-400">No delivered orders found.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
