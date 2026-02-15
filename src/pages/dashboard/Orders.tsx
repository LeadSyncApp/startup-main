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
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Failed to fetch orders:", res.status);
      return;
    }

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
        `${import.meta.env.VITE_API_URL}/api/orders/${id}/status`,
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
    <div className="p-6 space-y-6 w-full">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold">Orders Dashboard</h1>
        <p className="text-sm opacity-90 mt-1">
          Track lifecycle, monitor revenue and manage workflow
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Total Orders" value={totalOrders} />
        <MetricCard title="New Orders" value={totalPending} />
        <MetricCard title="Revenue" value={`₹${totalRevenue.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {grouped.map((col) => (
          <div
            key={col.value}
            className="bg-white rounded-2xl shadow border flex flex-col h-[65vh]"
          >
            <div
              className={`p-3 text-sm font-semibold rounded-t-2xl border-b ${col.color}`}
            >
              <div className="flex justify-between items-center">
                <span>{col.label}</span>
                <span className="bg-white px-2 py-0.5 text-xs rounded-full shadow">
                  {col.orders.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {col.orders.map((order) => (
                <motion.div
                  key={order.id}
                  whileHover={{ scale: 1.02 }}
                  className="bg-slate-50 hover:bg-white transition p-3 rounded-xl shadow-sm border text-sm"
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-slate-800 truncate">
                      {order.summary}
                    </h3>
                    <span className="font-semibold text-indigo-600 text-xs">
                      ₹{order.amount.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 mt-2 space-y-1">
                    <p>👤 {order.lead?.name || "Customer"}</p>
                    {order.processedBy && <p>🧑 {order.processedBy.name}</p>}
                    <p>
                      🕒 {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <select
                    value={order.status}
                    onChange={(e) =>
                      updateStatus(order.id, e.target.value as OrderStatus)
                    }
                    disabled={loading}
                    className="w-full mt-2 px-2 py-1 text-xs border rounded-lg bg-white focus:ring-2 focus:ring-indigo-400 outline-none"
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
    <div className="bg-white rounded-2xl shadow border p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">
        {title}
      </p>
      <h2 className="text-xl font-bold text-slate-800 mt-1">{value}</h2>
    </div>
  );
}
