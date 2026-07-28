import { motion } from "framer-motion";
import {
  BarChart3,
  MessageSquare,
  ShoppingCart,
  Users,
  Bot,
  TrendingUp,
} from "lucide-react";

export function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto max-w-4xl mt-12 sm:mt-16"
    >
      {/* Glow effect behind the preview */}
      <div
        className="absolute -inset-4 rounded-3xl blur-2xl opacity-30"
        style={{ background: "var(--brand-saffron)" }}
      />

      {/* Dashboard frame */}
      <div
        className="relative rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
          boxShadow: "var(--app-shadow-lg)",
        }}
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-4 py-3 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--danger-red)" }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--warning-amber)" }} />
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--success-green)" }} />
          </div>
          <div
            className="flex-1 mx-4 rounded-lg px-3 py-1 text-xs font-medium text-center"
            style={{ backgroundColor: "var(--app-bg-soft)", color: "var(--app-text-muted)" }}
          >
            dashboard.saLira.app
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 sm:p-6 grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Stat cards */}
          {[
            { icon: MessageSquare, label: "New Leads", value: "24", color: "var(--brand-saffron)" },
            { icon: ShoppingCart, label: "Orders Today", value: "12", color: "var(--success-green)" },
            { icon: Users, label: "Customers", value: "156", color: "var(--info-blue)" },
            { icon: TrendingUp, label: "Revenue", value: "₹8.4K", color: "var(--brand-saffron)" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-3 sm:p-4 border"
              style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                <span className="text-[10px] sm:text-xs font-medium" style={{ color: "var(--app-text-muted)" }}>
                  {stat.label}
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: "var(--app-text)" }}>
                {stat.value}
              </p>
            </div>
          ))}

          {/* Chart placeholder */}
          <div
            className="col-span-3 sm:col-span-4 rounded-xl p-4 border"
            style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: "var(--brand-saffron)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--app-text)" }}>
                  Revenue Trend
                </span>
              </div>
              <span className="text-[10px] font-medium" style={{ color: "var(--app-text-muted)" }}>
                Last 7 days
              </span>
            </div>
            {/* Mini bar chart */}
            <div className="flex items-end gap-1.5 h-16">
              {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 5 ? "var(--brand-saffron)" : "var(--app-border)",
                    opacity: i === 5 ? 1 : 0.5,
                  }}
                />
              ))}
            </div>
          </div>

          {/* AI Bot indicator */}
          <div
            className="col-span-3 sm:col-span-4 rounded-xl p-3 border flex items-center gap-3"
            style={{ backgroundColor: "var(--app-bg)", borderColor: "var(--app-border)" }}
          >
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--brand-saffron-soft)" }}
            >
              <Bot className="h-4 w-4" style={{ color: "var(--brand-saffron)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--app-text)" }}>
                AI Auto-Reply Active
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--app-text-muted)" }}>
                Handling 8 conversations automatically
              </p>
            </div>
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: "var(--success-green)" }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
