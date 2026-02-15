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
  lead: {
    name: string | null;
  };
  createdAt: string;
}

const STATUS = [
  { value: "NEW", label: "New", color: "bg-blue-100" },
  { value: "CONFIRMED", label: "Confirmed", color: "bg-purple-100" },
  { value: "PREPARING", label: "Preparing", color: "bg-amber-100" },
  { value: "READY", label: "Ready", color: "bg-green-100" },
  { value: "DELIVERED", label: "Delivered", color: "bg-emerald-200" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-200" },
];

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
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

    fetchOrders();
  }, [token]);

  const grouped = useMemo(() => {
    return STATUS.map((s) => ({
      ...s,
      orders: orders.filter((o) => o.status === s.value),
    }));
  }, [orders]);

  return (
    <div className="p-8 space-y-8">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold">Orders Board</h1>
        <p className="opacity-90 mt-1">
          Manage order lifecycle visually
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max">
          {grouped.map((col) => (
            <div
              key={col.value}
              className="w-80 bg-white rounded-xl shadow-md border"
            >
              <div
                className={`p-4 font-semibold rounded-t-xl ${col.color}`}
              >
                {col.label} ({col.orders.length})
              </div>

              <div className="p-4 space-y-4">
                {col.orders.map((order) => (
                  <motion.div
                    key={order.id}
                    whileHover={{ scale: 1.03 }}
                    className="bg-slate-50 p-4 rounded-lg shadow-sm border"
                  >
                    <p className="font-semibold text-slate-900">
                      {order.summary}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.lead?.name || "Customer"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
