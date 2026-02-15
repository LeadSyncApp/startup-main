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
  { value: "NEW", label: "New", color: "bg-blue-100 text-blue-700" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-purple-100 text-purple-700" },
  { value: "PREPARING", label: "Preparing", color: "bg-amber-100 text-amber-700" },
  { value: "READY", label: "Ready", color: "bg-green-100 text-green-700" },
  { value: "DELIVERED", label: "Delivered", color: "bg-emerald-100 text-emerald-700" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return;

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

      await fetch(`${import.meta.env.VITE_API_URL}/orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      await fetchOrders();
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.amount, 0);

  const grouped = useMemo(() => {
    return STATUS.map((s) => ({
      ...s,
      orders: orders.filter((o) => o.status === s.value),
    }));
  }, [orders]);

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-3xl shadow-xl">
        <h1 className="text-3xl font-bold">Orders Dashboard</h1>
        <p className="text-sm opacity-90 mt-2">
          Track lifecycle, monitor revenue and manage workflow
        </p>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Orders" value={orders.length} />
        <MetricCard
          title="Revenue"
          value={`₹${totalRevenue.toFixed(2)}`}
        />
        <MetricCard
          title="Pending Approval"
          value={
            orders.filter((o) => o.status === "NEW").length
          }
        />
      </div>

      {/* BOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {grouped.map((col) => (
          <div key={col.value} className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-slate-700">
                {col.label}
              </h2>
              <span className={`text-xs px-3 py-1 rounded-full ${col.color}`}>
                {col.orders.length}
              </span>
            </div>

            <div className="space-y-4">
              {col.orders.map((order) => (
                <motion.div
                  key={order.id}
                  whileHover={{ scale: 1.03 }}
                  className="bg-white p-4 rounded-2xl shadow-md border border-slate-100 space-y-3"
                >
                  <div className="flex justify-between">
                    <h3 className="font-semibold text-slate-800">
                      {order.summary}
                    </h3>
                    <span className="font-bold text-indigo-600">
                      ₹{order.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p>👤 {order.lead?.name || "Customer"}</p>
                    {order.processedBy && (
                      <p>🧑 {order.processedBy.name}</p>
                    )}
                    <p>
                      🕒 {new Date(order.createdAt).toLocaleDateString()}
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
                    className="w-full px-3 py-2 text-xs border rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
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
                <div className="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl">
                  No orders
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
      <p className="text-xs text-slate-500 uppercase tracking-wide">
        {title}
      </p>
      <h2 className="text-2xl font-bold text-slate-800 mt-2">
        {value}
      </h2>
    </div>
  );
}
