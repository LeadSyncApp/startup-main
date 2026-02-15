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
  { value: "NEW", label: "New", color: "bg-blue-100 border-blue-300" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-purple-100 border-purple-300" },
  { value: "PREPARING", label: "Preparing", color: "bg-amber-100 border-amber-300" },
  { value: "READY", label: "Ready", color: "bg-green-100 border-green-300" },
  { value: "DELIVERED", label: "Delivered", color: "bg-emerald-200 border-emerald-400" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-200 border-red-400" },
];

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchOrders = async () => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/orders`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => {
    return STATUS.map((s) => ({
      ...s,
      orders: orders.filter((o) => o.status === s.value),
    }));
  }, [orders]);

  return (
    <div className="p-8 space-y-8">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-8 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold">Orders Board</h1>
        <p className="opacity-90 mt-2">
          Track lifecycle, revenue & performance
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-8 min-w-max pb-4">
          {grouped.map((col) => (
            <div
              key={col.value}
              className="w-96 bg-white rounded-2xl shadow-lg border flex flex-col"
            >
              <div
                className={`p-5 text-lg font-semibold rounded-t-2xl border-b ${col.color}`}
              >
                {col.label} ({col.orders.length})
              </div>

              <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                {col.orders.map((order) => (
                  <motion.div
                    key={order.id}
                    whileHover={{ scale: 1.02 }}
                    className="bg-slate-50 p-5 rounded-xl shadow-sm border space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-slate-900 text-base">
                        {order.summary}
                      </h3>

                      <span className="text-sm font-bold text-indigo-600">
                        ₹{order.amount.toFixed(2)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      <p>
                        👤 {order.lead?.name || "Customer"}
                      </p>

                      {order.processedBy && (
                        <p>
                          🧑 Processed by: {order.processedBy.name}
                        </p>
                      )}

                      <p>
                        🕒 {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <select
                        value={order.status}
                        onChange={(e) =>
                          updateStatus(
                            order.id,
                            e.target.value as OrderStatus
                          )
                        }
                        disabled={loading}
                        className="w-full mt-2 px-3 py-2 text-sm border rounded-lg bg-white"
                      >
                        {STATUS.map((s) => (
                          <option key={s.value} value={s.value}>
                            Move to {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                ))}

                {col.orders.length === 0 && (
                  <div className="text-sm text-slate-400 text-center py-6">
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
