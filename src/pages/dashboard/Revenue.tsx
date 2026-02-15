import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { mockDeals, mockRevenue } from "../../data/mockData";
import {
  DollarSign,
  Building2,
  TrendingUp,
} from "lucide-react";
import { formatINR } from "../../utils/formatINR";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

type Period = "day" | "month" | "year";

export default function Revenue() {
  const { companyId } = useAuth();
  const [period] = useState<Period>("month"); // fixed default

  // ✅ SAFE REVENUE DATA ACCESS
  const revenueData =
    companyId && companyId in mockRevenue
      ? mockRevenue[companyId as keyof typeof mockRevenue]
      : undefined;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const closedWon = useMemo(() => {
    return mockDeals.filter((d) => {
      if (d.companyId !== companyId) return false;
      if (d.stage !== "closed_won" || !d.closedAt) return false;

      const closed = new Date(d.closedAt);

      if (period === "month") return closed >= monthStart && closed <= now;
      if (period === "year") return closed >= yearStart && closed <= now;

      return true;
    });
  }, [companyId, period]);

  const totalRevenue = closedWon.reduce((a, d) => a + d.value, 0);

  const companyList = useMemo(() => {
    const grouped: Record<
      string,
      { revenue: number; profit: number; count: number }
    > = {};

    closedWon.forEach((d) => {
      const name = d.company || d.leadName || "Unknown";
      const profit = d.value * 0.3;

      if (!grouped[name]) {
        grouped[name] = { revenue: 0, profit: 0, count: 0 };
      }

      grouped[name].revenue += d.value;
      grouped[name].profit += profit;
      grouped[name].count += 1;
    });

    return Object.entries(grouped).map(([name, data]) => ({
      name,
      ...data,
    }));
  }, [closedWon]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* HEADER */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          Revenue Dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Revenue overview for your company.
        </p>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Total Revenue */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-emerald-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Total Revenue</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {formatINR(totalRevenue)}
          </p>
        </div>

        {/* Closed Deals */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-cyan-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-cyan-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Closed Deals</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {closedWon.length}
          </p>
        </div>

        {/* Companies */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-amber-100 p-3 rounded-lg">
              <Building2 className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Companies</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {companyList.length}
          </p>
        </div>
      </div>

      {/* COMPANY TABLE */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Revenue by Company
        </h2>

        {companyList.length === 0 ? (
          <p className="text-sm text-slate-500">
            No closed deals yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-slate-500">
                <th className="py-2">Company</th>
                <th className="py-2 text-right">Revenue</th>
                <th className="py-2 text-right">Profit</th>
                <th className="py-2 text-right">Deals</th>
              </tr>
            </thead>
            <tbody>
              {companyList.map((c) => (
                <tr key={c.name} className="border-b last:border-0">
                  <td className="py-2 font-medium text-slate-900">
                    {c.name}
                  </td>
                  <td className="py-2 text-right">
                    {formatINR(c.revenue)}
                  </td>
                  <td className="py-2 text-right text-emerald-600">
                    {formatINR(c.profit)}
                  </td>
                  <td className="py-2 text-right">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* REVENUE CHART */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Revenue Timeline
        </h2>

        {!revenueData ? (
          <p className="text-sm text-slate-500">
            No revenue chart data available.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={
                period === "day"
                  ? revenueData.daily
                  : period === "month"
                  ? revenueData.monthly
                  : revenueData.yearly
              }
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={
                  period === "month"
                    ? "month"
                    : period === "year"
                    ? "year"
                    : "date"
                }
              />
              <YAxis />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#06B6D4"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
