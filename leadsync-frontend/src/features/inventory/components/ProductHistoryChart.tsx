import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { History, TrendingUp } from "lucide-react";

export interface PriceHistoryItem {
  id: string;
  productId: string;
  variantId?: string | null;
  oldPrice: number;
  newPrice: number;
  actorName?: string | null;
  changedAt: string;
}

export interface StockHistoryItem {
  id: string;
  productId: string;
  variantId?: string | null;
  oldStock?: number | null;
  newStock: number;
  actorName?: string | null;
  changedAt: string;
}

interface ProductHistoryChartProps {
  priceHistory: PriceHistoryItem[];
  stockHistory: StockHistoryItem[];
}

export function ProductHistoryChart({ priceHistory = [], stockHistory = [] }: ProductHistoryChartProps) {
  const totalEntries = priceHistory.length + stockHistory.length;

  // Build sorted timeline event list
  const events = useMemo(() => {
    const combined = [
      ...priceHistory.map(p => ({
        id: p.id,
        type: "price" as const,
        date: new Date(p.changedAt),
        dateStr: new Date(p.changedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        content: `Price updated from ₹${p.oldPrice} to ₹${p.newPrice}`,
        price: p.newPrice,
        stock: null as number | null,
        actor: p.actorName || "System",
      })),
      ...stockHistory.map(s => ({
        id: s.id,
        type: "stock" as const,
        date: new Date(s.changedAt),
        dateStr: new Date(s.changedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        content: `Stock updated from ${s.oldStock ?? "0"} to ${s.newStock} units`,
        price: null as number | null,
        stock: s.newStock,
        actor: s.actorName || "System",
      })),
    ];

    return combined.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [priceHistory, stockHistory]);

  // Build chronological chart data points (>= 3 points)
  const chartData = useMemo(() => {
    if (totalEntries < 3) return [];

    const chronological = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());
    let currentPrice: number | null = null;
    let currentStock: number | null = null;

    return chronological.map(ev => {
      if (ev.type === "price") currentPrice = ev.price;
      if (ev.type === "stock") currentStock = ev.stock;

      return {
        timestamp: ev.dateStr,
        price: currentPrice,
        stock: currentStock,
      };
    });
  }, [events, totalEntries]);

  if (totalEntries === 0) {
    return (
      <div className="p-4 rounded-xl border text-center" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
        <p className="text-xs italic" style={{ color: "var(--app-text-muted)" }}>
          No price or stock changes recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* If >= 3 points, render Recharts Line Chart */}
      {totalEntries >= 3 && chartData.length > 0 && (
        <div className="p-4 rounded-2xl border" style={{ backgroundColor: "var(--app-bg-soft)", borderColor: "var(--app-border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-brand-saffron" />
            <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--app-text)" }}>
              Price & Stock Trends
            </h4>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" opacity={0.5} />
                <XAxis dataKey="timestamp" stroke="var(--app-text-muted)" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#D36B46" fontSize={10} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--app-surface)",
                    borderColor: "var(--app-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--app-text)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="price"
                  name="Price (₹)"
                  stroke="#D36B46"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#D36B46" }}
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="stock"
                  name="Stock (units)"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: "#10b981" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Audit Timeline List (primary view for < 3 items, supplementary for >= 3) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-brand-saffron" />
          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--app-text-muted)" }}>
            History Change Log ({totalEntries} event{totalEntries !== 1 ? "s" : ""})
          </h4>
        </div>
        <div className="pl-4 border-l-2 border-dashed space-y-3" style={{ borderColor: "var(--app-border)" }}>
          {events.map(event => (
            <div key={event.id} className="relative flex flex-col space-y-0.5">
              <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-brand-saffron" />
              <p className="text-xs font-medium" style={{ color: "var(--app-text)" }}>
                {event.content}
              </p>
              <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--app-text-muted)" }}>
                <span>{event.dateStr}</span>
                <span>•</span>
                <span>By: {event.actor}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
