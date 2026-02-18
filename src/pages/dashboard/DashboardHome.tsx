import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Award
} from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export default function DashboardHome() {
  const { token, companyId, company } = useAuth();
  const [loading, setLoading] = useState(true);

  // Data State
  const [kpis, setKpis] = useState({ leads: 0, conversations: 0, orders: 0, agents: 0 });
  const [analytics, setAnalytics] = useState<any>(null); // { revenueChart, topProducts, topAgents, aggregates }

  useEffect(() => {
    if (!token || !companyId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Parallel fetch: Basic KPIs (counts) + Advanced Analytics (revenue, charts)
        const [kpiData, analyticsData] = await Promise.all([
          api.get("/dashboard/kpis").catch(() => ({})),
          api.get("/analytics/dashboard").catch(() => null)
        ]);

        setKpis({
          leads: kpiData.leads ?? 0,
          conversations: kpiData.conversations ?? 0,
          orders: kpiData.orders ?? 0,
          agents: kpiData.agents ?? 0
        });
        setAnalytics(analyticsData);
      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, companyId]);

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-400 animate-pulse">Loading Analytics Dashboard...</div>;
  }

  // Fallback if analytics failed (e.g. no data yet)
  const revenue30d = analytics?.aggregates?.revenue30d || 0;
  const orders30d = analytics?.aggregates?.orders30d || 0;
  const aov = analytics?.aggregates?.aov || 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-10"
    >
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500">
            Overview for <span className="font-semibold text-slate-700">{company?.name || "Your Company"}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/orders" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition shadow-sm">
            Manage Orders
          </Link>
        </div>
      </div>

      {/* KPI GRID (Top Row) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue (30d)" value={`₹${revenue30d.toLocaleString()}`} icon={DollarSign} color="text-green-600 bg-green-50" />
        <StatCard label="Orders (30d)" value={orders30d} icon={ShoppingCart} color="text-blue-600 bg-blue-50" />
        <StatCard label="Avg Order Value" value={`₹${aov}`} icon={TrendingUp} color="text-indigo-600 bg-indigo-50" />
        <StatCard label="Total Leads" value={kpis.leads} icon={Users} color="text-orange-600 bg-orange-50" />
      </div>

      {/* CHART SECTION */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Chart: Revenue */}
        <motion.div variants={item} className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Revenue Trend (14 Days)</h3>
          {analytics?.revenueChart && analytics.revenueChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={analytics.revenueChart}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [`₹${val}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 italic">No revenue data available yet.</div>
          )}
        </motion.div>

        {/* Side Panel: Top Products */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            Top Products
          </h3>
          <div className="space-y-4">
            {analytics?.topProducts?.map((prod: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="font-medium text-slate-700 truncate max-w-[150px]">{prod.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{prod.count} sold</span>
              </div>
            ))}
            {(!analytics?.topProducts || analytics.topProducts.length === 0) && (
              <div className="text-center py-10 text-slate-400 text-sm">No sales data yet.</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* BOTTOM SECTION: Agents & Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Agents */}
        <motion.div variants={item} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            Top Performing Agents
          </h3>
          <div className="space-y-4">
            {analytics?.topAgents?.map((agent: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                    {agent.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-slate-700">{agent.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{agent.count} Orders</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Processed</p>
                </div>
              </div>
            ))}
            {(!analytics?.topAgents || analytics.topAgents.length === 0) && (
              <div className="text-center py-6 text-slate-400 text-sm">No agent activity yet.</div>
            )}
          </div>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={item} className="grid sm:grid-cols-2 gap-4">
          <Link to="/dashboard/leads" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group">
            <Users className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-bold text-slate-900">Leads CRM</h4>
            <p className="text-xs text-slate-500 mt-1">Manage customer pipeline.</p>
          </Link>
          <Link to="/dashboard/conversations" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group">
            <MessageSquare className="w-8 h-8 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
            <h4 className="font-bold text-slate-900">Inbox</h4>
            <p className="text-xs text-slate-500 mt-1">Chat with customers.</p>
          </Link>
          <Link to="/dashboard/orders" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition group sm:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <ShoppingCart className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-slate-900">Live Operations Center</h4>
                <p className="text-xs text-slate-500 mt-1">Manage active orders and dispatch.</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-slate-900">{kpis.orders}</span>
                <p className="text-xs text-slate-400">Total Orders</p>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <h2 className="text-2xl font-bold text-slate-900">{value}</h2>
      </div>
    </motion.div>
  );
}
