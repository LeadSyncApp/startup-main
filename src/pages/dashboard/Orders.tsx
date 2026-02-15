import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { motion } from "framer-motion";

type OrderStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

interface Order {
  id: string;
  summary: string;
  status: OrderStatus;
  amount: number;
  processedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  lead: {
    name: string | null;
  };
  createdAt: string;
}

const STATUS = [
  { value: "NEW", label: "New", color: "bg-blue-50 border-blue-200" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-purple-50 border-purple-200" },
  { value: "PREPARING", label: "Preparing", color: "bg-amber-50 border-amber-200" },
  { value: "READY", label: "Ready", color: "bg-green-50 border-green-200" },
  { value: "DELIVERED", label: "Delivered", color: "bg-emerald-100 border-emerald-300" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 border-red-300" },
];

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setOrders(data);
  };

  useEffect(() => {
    if (!token) return;
    fetchOrders();
  }, [token]);

  const updateStatus = async (id: string, status: OrderStatus) => {
    try {
      setLoading(true);

      await fetch(
        `${import.meta.env.VITE_API_URL}/orders/${id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      await fetchOrders();
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     METRICS
  =============================== */

  const totalRevenue = orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.amount, 0);

  const totalPending = orders.filter((o) => o.status === "NEW").length;
  const totalOrders = orders.length;

  const grouped = useMemo(() => {
    return STATUS.map((s) => ({
      ...s,
      orders: orders.filter((o) => o.status === s.value),
    }));
  }, [orders]);

  return (
    <div className="p-8 space-y-8">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-bold tracking-tight">
          Orders Dashboard
        </h1>
        <p className="opacity-90 mt-2 text-sm">
          Track lifecycle, monitor revenue and manage workflow
        </p>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Orders" value={totalOrders} />
        <MetricCard title="New Orders" value={totalPending} />
        <MetricCard
          title="Revenue"
          value={`₹${totalRevenue.toFixed(2)}`}
        />
      </div>

      {/* BOARD */}
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-4">
          {grouped.map((col) => (
            <div
              key={col.value}
              className="w-80 bg-white rounded-3xl shadow-lg border border-slate-200 flex flex-col"
            >
              <div
                className={`p-4 text-sm font-semibold rounded-t-3xl border-b ${col.color}`}
              >
                <div className="flex justify-between items-center">
                  <span>{col.label}</span>
                  <span className="bg-white px-2 py-0.5 text-xs rounded-full shadow">
                    {col.orders.length}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {col.orders.map((order) => (
                  <motion.div
                    key={order.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-slate-50 hover:bg-white transition-all p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-slate-800 text-sm">
                        {order.summary}
                      </h3>

                      <span className="text-sm font-bold text-indigo-600">
                        ₹{order.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <p>👤 {order.lead?.name || "Customer"}</p>

                      {order.processedBy && (
                        <p>🧑 {order.processedBy.name}</p>
                      )}

                      <p>
                        🕒{" "}
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <select
                      value={order.status}
                      onChange={(e) =>
                        updateStatus(
                          order.id,
                          e.target.value as OrderStatus
                        )
                      }
                      disabled={loading}
                      className="w-full mt-2 px-3 py-2 text-xs border rounded-xl bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
                    >
                      {STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          Move to {s.label}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                ))}

                {col.orders.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-6">
                    No orders here
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===============================
   METRIC CARD COMPONENT
=============================== */

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-md p-6 border border-slate-200">
      <p className="text-xs text-slate-500 uppercase tracking-wide">
        {title}
      </p>
      <h2 className="text-2xl font-bold text-slate-800 mt-2">
        {value}
      </h2>
    </div>
  );
}
