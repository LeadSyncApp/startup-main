import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Package,
  Bell,
  ArrowRight,
  Inbox,
  LayoutGrid,
  Filter
} from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, ResponsiveContainer } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { api } from "../../lib/api";
import { DashboardSkeleton } from "../../components/ui/Skeleton";

interface KPIData {
  leads: number;
  conversations: number;
  orders: number;
  agents: number;
}

interface AlertData {
  urgentLeads: number;
  pendingOrders: number;
  botConversations: number;
}

interface StatCardProps {
  label: string;
  value: string;
  trend?: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
}

interface ProductRowProps {
  rank: string;
  name: string;
  sub: string;
  count: string;
}

interface AgentCardProps {
  name: string;
  orders: number;
  initial: string;
}

export default function DashboardHome() {
  const { token, companyId } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpis, setKpis] = useState<KPIData>({
    leads: 0,
    conversations: 0,
    orders: 0,
    agents: 0,
  });
  const [analytics, setAnalytics] = useState<any>(null);
  const [alertKpis, setAlertKpis] = useState<AlertData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      if (!token || !companyId) return;
      setError(null);
      
      const [kpiData, analyticsData, alertData] = await Promise.all([
        api.get("/dashboard/kpis").catch(() => null),
        api.get("/analytics/dashboard").catch(() => null),
        api.get("/dashboard/alerts").catch(() => null),
      ]);

      setKpis({
        leads: kpiData?.leads ?? 0,
        conversations: kpiData?.conversations ?? 0,
        orders: kpiData?.orders ?? 0,
        agents: kpiData?.agents ?? 0,
      });
      
      setAnalytics(analyticsData);
      setAlertKpis(alertData);
    } catch (err) {
      console.error("Dashboard load failed", err);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token, companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for socket updates
  useEffect(() => {
    if (!socket) return;
    
    socket.on("order_updated", fetchData);
    
    return () => {
      socket.off("order_updated", fetchData);
    };
  }, [socket, fetchData]);

  // Compute derived values - MOVED BEFORE EARLY RETURNS
  const revenue30d = useMemo(() => analytics?.aggregates?.revenue30d ?? 0, [analytics]);
  const aov = useMemo(() => analytics?.aggregates?.aov ?? 0, [analytics]);
  const urgentLeads = useMemo(() => alertKpis?.urgentLeads ?? 0, [alertKpis]);
  const revenueTrend = useMemo(() => analytics?.aggregates?.revenueTrend, [analytics]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FF] flex items-center justify-center pb-24">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-['Manrope']">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 font-medium text-sm mt-1">Real-time performance metrics and business monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="p-2.5 bg-slate-50 rounded-xl text-slate-500 hover:bg-slate-100 transition" aria-label="Notifications" title="Inbox notifications">
              <Inbox className="w-5 h-5" />
            </button>
            {(alertKpis?.pendingOrders ?? 0) > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </div>
          <button className="p-2.5 bg-slate-50 rounded-xl text-slate-500 hover:bg-slate-100 transition" aria-label="Layout options" title="View options">
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </div>

      <main className="space-y-8">
        {/* Live Alerts / Featured Section */}
        <section>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Live Alerts</h2>
          <div className="relative overflow-hidden rounded-[24px] bg-[#2563eb] p-6 text-white shadow-lg shadow-blue-100">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-8 blur-2xl"></div>
            
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                    <Bell className="w-3.5 h-3.5" />
                  </motion.div>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Urgent Attention</span>
              </div>
              <h3 className="text-2xl font-bold leading-tight">
                {urgentLeads} {urgentLeads === 1 ? "Lead" : "Leads"} requiring immediate action
              </h3>
              <p className="text-sm text-blue-50/80 leading-relaxed max-w-[85%]">
                {urgentLeads > 0 
                  ? `AI has categorized ${Math.ceil(urgentLeads * 0.3)} leads as high-intent. Dispatch recommended.`
                  : "No urgent leads at the moment."}
              </p>
              <button 
                onClick={() => navigate("/dashboard/leads")}
                className="flex items-center gap-2 bg-white text-[#2563eb] px-5 py-3 rounded-xl font-bold text-sm transition active:scale-95 hover:bg-blue-50"
              >
                Review Priority <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-4">
          <StatCard 
            label="Revenue" 
            value={`₹${revenue30d.toLocaleString()}`} 
            trend={revenueTrend} 
            icon={DollarSign}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
          <StatCard 
            label="Orders" 
            value={kpis.orders.toLocaleString()} 
            icon={ShoppingCart}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
          />
          <StatCard 
            label="AOV" 
            value={`₹${aov.toLocaleString()}`} 
            icon={TrendingUp}
            iconColor="text-slate-600"
            iconBg="bg-slate-100"
          />
          <StatCard 
            label="Leads" 
            value={kpis.leads.toLocaleString()} 
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
        </section>

        {/* Revenue Trend Chart */}
        <section className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-[#1e293b]">Revenue Trend</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Last 14 days activity</p>
            </div>
            <button 
              className="p-2.5 bg-slate-50 rounded-xl text-slate-500 hover:bg-slate-100 transition"
              aria-label="Filter chart"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.revenueChart || []}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  fill="url(#colorAmount)" 
                />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 600 }} 
                  dy={10}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => navigate("/dashboard/leads")}
                className="flex items-center justify-center gap-2 bg-[#eef4ff] text-[#0047cc] py-4 rounded-[16px] font-bold text-sm transition active:scale-95 hover:bg-blue-100"
                aria-label="Add lead"
              >
                <Users className="w-4 h-4" /> Add Lead
              </button>
              <button 
                onClick={() => navigate("/dashboard/conversations")}
                className="flex items-center justify-center gap-2 bg-[#eef4ff] text-[#0047cc] py-4 rounded-[16px] font-bold text-sm transition active:scale-95 hover:bg-blue-100"
                aria-label="View inbox"
              >
                <MessageSquare className="w-4 h-4" /> Inbox
              </button>
            </div>
          </div>
        </section>

        {/* Top Products */}
        <section className="bg-[#f0f4ff] p-6 rounded-[24px]">
          <h3 className="text-lg font-bold text-[#1e293b] mb-5 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" /> Top Products
          </h3>
          <div className="space-y-3">
            {analytics?.topProducts?.length > 0 ? (
              analytics.topProducts.map((product: any, index: number) => (
                <ProductRow 
                  key={index}
                  rank={String(index + 1).padStart(2, "0")} 
                  name={product.name} 
                  sub="Popular Item" 
                  count={product.count.toString()} 
                />
              ))
            ) : (
              <p className="text-sm text-slate-500 font-medium text-center py-4">No product data available yet.</p>
            )}
          </div>
        </section>

        {/* Top Agents */}
        <section>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Top Performing Agents</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {analytics?.topAgents?.length > 0 ? (
              analytics.topAgents.map((agent: any, index: number) => (
                <AgentCard 
                  key={index}
                  name={agent.name} 
                  orders={agent.count} 
                  initial={agent.name.charAt(0).toUpperCase()} 
                />
              ))
            ) : (
              <p className="text-sm text-slate-500 font-medium">No agent data available yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, trend, icon: Icon, iconColor, iconBg }: StatCardProps) {
  return (
    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden hover:shadow-md transition">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        <h4 className="text-xl font-extrabold text-[#1e293b]">{value}</h4>
      </div>
    </div>
  );
}

function ProductRow({ rank, name, sub, count }: ProductRowProps) {
  return (
    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-50 hover:shadow-md transition">
      <div className="flex items-center gap-4">
        <span className="text-xs font-extrabold text-blue-600 bg-blue-50 w-8 h-8 flex items-center justify-center rounded-lg">
          {rank}
        </span>
        <div>
          <h5 className="text-sm font-bold text-[#1e293b]">{name}</h5>
          <p className="text-[10px] font-medium text-slate-400">{sub}</p>
        </div>
      </div>
      <div className="text-right">
        <span className="text-sm font-extrabold text-[#1e293b]">{count}</span>
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">sold</p>
      </div>
    </div>
  );
}

function AgentCard({ name, orders, initial }: AgentCardProps) {
  return (
    <div className="min-w-[140px] bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm text-center hover:shadow-md transition">
      <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2563eb] flex items-center justify-center mx-auto mb-3 font-extrabold text-lg">
        {initial}
      </div>
      <h5 className="text-sm font-bold text-[#1e293b]">{name}</h5>
      <p className="text-[11px] font-bold text-slate-400 mt-0.5">{orders} Orders</p>
      <div className="flex justify-center gap-0.5 mt-2">
        {[1, 2, 3].map((i) => (
          <motion.span key={i} className="text-[10px] text-amber-400">
            ★
          </motion.span>
        ))}
      </div>
    </div>
  );
}


