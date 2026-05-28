import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Clock,
  Radio,
  Download,
  ChevronRight,
  BarChart2,
  Trophy,
} from "lucide-react";
import { formatINR } from "../../utils/formatINR";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { PageTransition } from "../../components/ui/Animations";
import { ChartSkeleton, StatCardSkeleton } from "../../components/ui/Skeleton";

export default function Revenue() {
  const [data, setData] = useState<any>(null);
  const [funnelData, setFunnelData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [agentStats, setAgentStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [res, funnel, forecast, agents] = await Promise.all([
          api.get("/analytics/revenue"),
          api.get("/dashboard/funnel").catch(() => null),
          api.get("/dashboard/forecast").catch(() => null),
          api.get("/dashboard/agent-stats").catch(() => []),
        ]);
        setData(res);
        setFunnelData(funnel);
        setForecastData(forecast);
        setAgentStats(agents || []);
      } catch (err) {
        console.error("Failed to fetch revenue data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const base = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, "") || "";
      const response = await fetch(`${base}/analytics/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leadsync-orders-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error", err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <PageTransition className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2 animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-48" />
            <div className="h-4 bg-slate-200 rounded w-64" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <ChartSkeleton />
      </PageTransition>
    );
  }

  const totalRevenue = data?.totalRevenue ?? 0;
  const orderCount = data?.orderCount ?? 0;
  const avgOrderValue = data?.avgOrderValue ?? 0;
  const trend: number | null = data?.trend ?? null;
  const timeline: { name: string; value: number; orders: number }[] = data?.timeline ?? [];
  const recentOrders: any[] = data?.recentOrders ?? [];
  const agentPerformance: any[] = data?.agentPerformance ?? [];
  const channelAttribution: any[] = data?.channelAttribution ?? [];

  // Enhanced forecast chart — prefer new /dashboard/forecast data if available
  const chartData = forecastData
    ? [
        ...(forecastData.historical ?? []).map((d: any) => ({ name: d.date, revenue: d.revenue })),
        ...(forecastData.forecast ?? []).map((d: any) => ({ name: d.date, forecast: d.revenue })),
      ]
    : [
        ...timeline.map((d) => ({ name: d.name, revenue: d.value, orders: d.orders })),
        ...(data?.forecast ?? []).map((d: any) => ({ name: d.name, forecast: d.forecast })),
      ];

  const funnelStages: { label: string; value: number; color: string }[] =
    funnelData?.stages ?? [];
  const funnelMax = Math.max(...funnelStages.map((s) => s.value), 1);

  const CHANNEL_COLORS: Record<string, string> = {
    TELEGRAM: "bg-blue-500",
    INSTAGRAM: "bg-pink-500",
    WEBSITE: "bg-cyan-500",
    WHATSAPP: "bg-green-500",
    MANUAL: "bg-slate-400",
  };

  return (
    <PageTransition className="space-y-8">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-app-text">Revenue Insights</h1>
          <p className="mt-1 text-sm text-slate-500">Last 30 days · delivered &amp; paid orders</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting…" : "Export Excel"}
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-app-surface p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</p>
              <p className="text-2xl font-bold text-app-text">{formatINR(totalRevenue)}</p>
              {trend !== null && (
                <p className={`mt-0.5 text-xs font-medium flex items-center gap-0.5 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend).toFixed(1)}% vs prev period
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-app-surface p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-cyan-50 p-3 rounded-xl border border-cyan-100">
              <Receipt className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Orders Delivered</p>
              <p className="text-2xl font-bold text-app-text">{orderCount}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-app-surface p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
              <TrendingUp className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Order Value</p>
              <p className="text-2xl font-bold text-app-text">{formatINR(avgOrderValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* REVENUE + FORECAST CHART */}
      <div className="rounded-2xl border bg-app-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-app-text mb-1">Revenue &amp; 14-Day Forecast</h2>
        <p className="text-xs text-slate-400 mb-6">Solid = actual · dashed amber = AI linear regression forecast</p>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} interval={4} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                formatter={(v: number, name: string) => [formatINR(v), name === "revenue" ? "Revenue" : "Forecast"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" connectNulls={false} />
              <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SALES FUNNEL */}
      {funnelStages.length > 0 && (
        <div className="rounded-2xl border bg-app-surface p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-app-text">Sales Funnel</h2>
          </div>
          <p className="text-xs text-slate-400 mb-5">
            Conversion rate: <span className="font-bold text-emerald-600">{funnelData?.conversionRate ?? 0}%</span> of {funnelData?.totalLeads ?? 0} total leads
          </p>
          <div className="space-y-3">
            {funnelStages.map((stage, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <ChevronRight size={12} className="text-slate-300" />
                    <span className="text-sm font-semibold text-slate-700">{stage.label}</span>
                  </div>
                  <span className="text-sm font-bold text-app-text">{stage.value.toLocaleString()}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(stage.value / funnelMax) * 100}%`, background: stage.color || "#6366f1" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AGENT PERFORMANCE + CHANNEL ATTRIBUTION */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-app-surface overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-app flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h2 className="text-lg font-semibold text-app-text">Agent Leaderboard</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(agentStats.length > 0 ? agentStats : agentPerformance).length === 0 ? (
              <p className="p-10 text-center text-slate-400 text-sm">No agent-processed orders yet.</p>
            ) : (
              (agentStats.length > 0 ? agentStats : agentPerformance).map((a: any, i: number) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-app-bg transition">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-slate-200 text-app-muted"}`}>
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">{a.name}</p>
                      <p className="text-xs text-slate-400">
                        {a.orders ?? 0} order{(a.orders ?? 0) !== 1 ? "s" : ""}
                        {a.conversations ? ` · ${a.conversations} convos` : a.avgValue ? ` · avg ${formatINR(a.avgValue)}` : ""}
                      </p>
                    </div>
                  </div>
                  {a.revenue != null && (
                    <p className="font-bold text-emerald-600 text-sm">{formatINR(a.revenue)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-app-surface overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-app flex items-center gap-2">
            <Radio className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-app-text">Channel Attribution</h2>
          </div>
          <div className="px-6 py-6 space-y-5">
            {channelAttribution.length === 0 ? (
              <p className="text-center text-slate-400 text-sm">No channel data yet.</p>
            ) : (
              channelAttribution.map((c: any, i: number) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-700">{c.channel}</span>
                    <span className="text-slate-500">{formatINR(c.revenue)} · {c.percentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${CHANNEL_COLORS[c.channel] || "bg-slate-400"}`}
                      style={{ width: `${c.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RECENT DELIVERIES */}
      <div className="rounded-2xl border bg-app-surface overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-app flex items-center justify-between">
          <h2 className="text-lg font-semibold text-app-text">Recent Deliveries</h2>
          <Clock className="h-4 w-4 text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {recentOrders.length === 0 ? (
            <p className="p-10 text-center text-slate-400">No delivered orders found.</p>
          ) : (
            recentOrders.map((o: any, idx: number) => (
              <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-app-bg transition">
                <div>
                  <p className="font-medium text-app-text">{o.customer}</p>
                  <p className="text-xs text-slate-400">{new Date(o.date).toLocaleDateString("en-IN")}</p>
                </div>
                <p className="font-bold text-emerald-600">{formatINR(o.amount)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </PageTransition>
  );
}
