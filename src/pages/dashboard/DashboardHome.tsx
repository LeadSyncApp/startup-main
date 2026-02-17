import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  MessageSquare,
  ShoppingCart,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api"; // ✅ centralized API

interface KPIData {
  leads: number;
  conversations: number;
  orders: number;
  agents: number;
}

export default function DashboardHome() {
  const { token } = useAuth();

  // Simple persist cache
  const [cachedData] = useState<KPIData | null>(() => {
    const saved = localStorage.getItem("leadsync_dashboard_cache");
    return saved ? JSON.parse(saved) : null;
  });

  const [data, setData] = useState<KPIData>(cachedData || {
    leads: 0,
    conversations: 0,
    orders: 0,
    agents: 0,
  });

  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (!token) return;

    const fetchKPIs = async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const json = await api.get("/dashboard/kpis");

        const newData = {
          leads: json.leads ?? 0,
          conversations: json.conversations ?? 0,
          orders: json.orders ?? 0,
          agents: json.agents ?? 0,
        };

        setData(newData);
        localStorage.setItem("leadsync_dashboard_cache", JSON.stringify(newData));
      } catch (err) {
        console.error("❌ Failed to load dashboard KPIs:", err);
      } finally {
        setLoading(false);
      }
    };

    if (cachedData) {
      fetchKPIs(true); // Background update
    } else {
      fetchKPIs();
    }
  }, [token]);

  const cards = [
    {
      label: "Leads",
      value: data.leads,
      icon: Users,
      path: "/dashboard/leads",
    },
    {
      label: "Conversations",
      value: data.conversations,
      icon: MessageSquare,
      path: "/dashboard/conversations",
    },
    {
      label: "Orders",
      value: data.orders,
      icon: ShoppingCart,
      path: "/dashboard/orders",
    },
    {
      label: "Team Members",
      value: data.agents,
      icon: Settings,
      path: "/dashboard/users", // Fixed path
    },
  ];

  return (
    <div className="space-y-10">
      {/* HEADER */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Welcome Back
        </h1>
        <p className="text-slate-500 leading-relaxed">
          Monitor your business performance and customer interactions.
        </p>
      </div>

      {/* KPI GRID */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, path }, idx) => (
          <Link key={label} to={path}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -2 }}
              className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all h-full"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {label}
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {loading ? "—" : value}
                  </h2>
                </div>

                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
                  <Icon className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 mb-8">
          Quick Actions
        </h2>

        <div className="grid sm:grid-cols-2 gap-6">
          <Link
            to="/dashboard/orders"
            className="group border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:bg-slate-50 transition"
          >
            <p className="text-base font-medium text-slate-900">
              Manage Orders
            </p>
            <p className="text-sm text-slate-500 mt-2">
              View and update order status in real-time.
            </p>
          </Link>

          <Link
            to="/dashboard/conversations"
            className="group border border-slate-200 rounded-xl p-6 hover:border-slate-300 hover:bg-slate-50 transition"
          >
            <p className="text-base font-medium text-slate-900">
              View Conversations
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Respond to customers and confirm new orders.
            </p>
          </Link>
        </div>
      </div>

    </div>
  );
}
