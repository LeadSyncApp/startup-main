import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Award,
  Megaphone,
  FileText,
  ArrowUpRight,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { DashboardSkeleton } from "../../components/ui/Skeleton";

export default function DashboardHome() {
  const { token, companyId, isOwner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Data State
  const [kpis, setKpis] = useState({ leads: 0, conversations: 0, orders: 0, agents: 0 });
  const [analytics, setAnalytics] = useState<any>(null);
  const [alertKpis, setAlertKpis] = useState<{
    urgentLeads: number; pendingOrders: number; botConversations: number;
  } | null>(null);

  useEffect(() => {
    if (!token || !companyId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Parallel fetch: Basic KPIs (counts) + Advanced Analytics (revenue, charts)
        const [kpiData, analyticsData, alertData] = await Promise.all([
          api.get("/dashboard/kpis").catch(() => ({})),
          api.get("/analytics/dashboard").catch(() => null),
          api.get("/dashboard/alerts").catch(() => null),
        ]);

        setKpis({
          leads: kpiData.leads ?? 0,
          conversations: kpiData.conversations ?? 0,
          orders: kpiData.orders ?? 0,
          agents: kpiData.agents ?? 0
        });
        setAnalytics(analyticsData);
        if (alertData) setAlertKpis(alertData);
      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, companyId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  // Fallback if analytics failed (e.g. no data yet)
  const revenue30d = analytics?.aggregates?.revenue30d || 0;
  const orders30d = analytics?.aggregates?.orders30d || 0;
  const aov = analytics?.aggregates?.aov || 0;

  return (
    <div className="min-h-screen bg-[#0B1120] px-8 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
      {/* TOP ACTION BAR */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
            <p className="text-slate-400 mt-1">Overview of sales, leads, and conversations</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate('/dashboard/orders')} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2.5 font-medium transition">
              Create Order
            </button>
            <button onClick={() => navigate('/dashboard/leads')} className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl px-4 py-2.5 font-medium transition">
              Add Lead
            </button>
            <button onClick={() => navigate('/dashboard/conversations')} className="bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl px-4 py-2.5 font-medium transition">
              View Conversations
            </button>
          </div>
        </div>

      {/* LIVE ALERT STRIP */}
      {alertKpis && (alertKpis.urgentLeads > 0 || alertKpis.pendingOrders > 0 || alertKpis.botConversations > 0) && (
        <div className="flex flex-wrap gap-2">
            {alertKpis.urgentLeads > 0 && (
              <Link
                to="/dashboard/leads"
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold hover:bg-red-500/30 transition active:scale-95 group"
              >
                <AlertTriangle size={13} className="animate-pulse" />
                {alertKpis.urgentLeads} Urgent Lead{alertKpis.urgentLeads !== 1 ? "s" : ""}
                <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition" />
              </Link>
            )}
            {alertKpis.pendingOrders > 0 && (
              <Link
                to="/dashboard/leads?filter=pendingApproval"
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition active:scale-95 group"
              >
                <ShoppingCart size={13} />
                {alertKpis.pendingOrders} Order{alertKpis.pendingOrders !== 1 ? "s" : ""} Awaiting Approval
                <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition" />
              </Link>
            )}
            {alertKpis.botConversations > 0 && (
              <Link
                to="/dashboard/conversations"
                className="flex items-center gap-2 px-3 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 text-xs font-bold hover:bg-indigo-500/30 transition active:scale-95 group"
              >
                <Zap size={13} />
                {alertKpis.botConversations} Active Bot Chat{alertKpis.botConversations !== 1 ? "s" : ""}
                <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition" />
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
          <StatCard label="Revenue" value={`₹${revenue30d.toLocaleString()}`} icon={DollarSign} iconBg="bg-green-500/10 text-green-400" trend="+12%" />
          <StatCard label="Orders" value={orders30d} icon={ShoppingCart} iconBg="bg-blue-500/10 text-blue-400" />
          <StatCard label="AOV" value={`₹${aov}`} icon={TrendingUp} iconBg="bg-violet-500/10 text-violet-400" />
          <StatCard label="Leads" value={kpis.leads} icon={Users} iconBg="bg-orange-500/10 text-orange-400" />
        </div>

      {/* CHART SECTION */}
        <div className="grid grid-cols-12 gap-6">
          {/* Main Chart: Revenue */}
          <div className="col-span-12 xl:col-span-8 rounded-2xl border border-white/10 bg-[#111827] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Revenue Trend
          </h2>
          <p className="text-sm text-slate-400 mb-6">Last 14 days</p>
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
          </div>

          {/* Side Panel: Top Products */}
          <div className="col-span-12 xl:col-span-4 rounded-2xl border border-white/10 bg-[#111827] p-6 h-full">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-500" />
              Top Products
            </h3>
            <div className="space-y-4">
              {analytics?.topProducts?.map((prod: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-400 text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-white truncate max-w-[150px]">{prod.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-white">{prod.count} sold</span>
                </div>
              ))}
              {(!analytics?.topProducts || analytics.topProducts.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white">No sales yet</h3>
                  <p className="mt-2 max-w-xs text-sm text-slate-400">
                    Start by creating your first order to see product performance here.
                  </p>
                  <button onClick={() => navigate('/dashboard/orders')} className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700">
                    Create First Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* BOTTOM SECTION: Agents & Quick Actions */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top Agents */}
          <div className="rounded-2xl border border-white/10 bg-[#111827] p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Top Performing Agents
            </h3>
            <div className="space-y-4">
              {analytics?.topAgents?.map((agent: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      {agent.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-white">{agent.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{agent.count} Orders</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Processed</p>
                  </div>
                </div>
              ))}
              {(!analytics?.topAgents || analytics.topAgents.length === 0) && (
                <div className="text-center py-6 text-slate-400 text-sm">No agent activity yet.</div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/dashboard/leads" className="rounded-2xl border border-white/10 bg-[#111827] p-6 hover:border-indigo-500/30 transition-all group">
              <Users className="w-8 h-8 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-white">Leads CRM</h4>
              <p className="text-xs text-slate-400 mt-1">Manage customer pipeline.</p>
            </Link>
            <Link to="/dashboard/conversations" className="rounded-2xl border border-white/10 bg-[#111827] p-6 hover:border-indigo-500/30 transition-all group">
              <MessageSquare className="w-8 h-8 text-green-500 mb-3 group-hover:scale-110 transition-transform" />
              <h4 className="font-bold text-white">Inbox</h4>
              <p className="text-xs text-slate-400 mt-1">Chat with customers.</p>
            </Link>
            {(isOwner || isAdmin) && (
              <Link to="/dashboard/broadcasts" className="rounded-2xl border border-white/10 bg-[#111827] p-6 hover:border-indigo-500/30 transition-all group">
                <Megaphone className="w-8 h-8 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-white">Broadcasts</h4>
                <p className="text-xs text-slate-400 mt-1">Send bulk messages to segments.</p>
              </Link>
            )}
            {(isOwner || isAdmin) && (
              <Link to="/dashboard/reports" className="rounded-2xl border border-white/10 bg-[#111827] p-6 hover:border-indigo-500/30 transition-all group">
                <FileText className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-white">Reports</h4>
                <p className="text-xs text-slate-400 mt-1">Export orders & leads data.</p>
              </Link>
            )}
            <Link to="/dashboard/orders" className="rounded-2xl border border-white/10 bg-[#111827] p-6 hover:border-indigo-500/30 transition-all group sm:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <ShoppingCart className="w-8 h-8 text-purple-500 mb-3 group-hover:scale-110 transition-transform" />
                  <h4 className="font-bold text-white">Live Operations Center</h4>
                  <p className="text-xs text-slate-400 mt-1">Manage active orders and dispatch.</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-white">{kpis.orders}</span>
                  <p className="text-xs text-slate-400">Total Orders</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, trend }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border border-white/10 bg-[#111827] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-indigo-500/30"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <h2 className="text-3xl font-semibold tracking-tight text-white">{value}</h2>
      </div>
    </motion.div>
  );
}
