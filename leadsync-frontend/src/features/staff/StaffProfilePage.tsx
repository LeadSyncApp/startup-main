import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Clock, ShoppingBag, User, Activity, Calendar
} from "lucide-react";
import { useAuth } from "../auth-tenancy/AuthContext";
import { authedFetch } from "../../api/client";
import { Card } from "../../components/ui/Card";

interface StaffStats {
  chatsResolvedToday: number;
  chatsResolvedWeek: number;
  avgResponseTimeSeconds: number;
  ordersProcessedToday: number;
  ordersProcessedWeek: number;
  activeChats: number;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  bgColor,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  bgColor: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl animate-pulse" style={{ backgroundColor: "var(--app-border)" }} />
        <div className="space-y-2">
          <div className="h-7 w-16 rounded-lg animate-pulse" style={{ backgroundColor: "var(--app-border)" }} />
          <div className="h-4 w-24 rounded-lg animate-pulse" style={{ backgroundColor: "var(--app-border)" }} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 flex items-center gap-4">
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: bgColor, color }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-2xl font-black" style={{ color: "var(--app-text)" }}>
          {value}
        </div>
        <div className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {label}
        </div>
        {subValue && (
          <div className="text-[10px] font-medium mt-0.5" style={{ color: "var(--app-text-muted)" }}>
            {subValue}
          </div>
        )}
      </div>
    </Card>
  );
}

export function StaffProfilePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);
        const res = await authedFetch("/api/staff/stats");
        if (!res.ok) throw new Error("Failed to load stats");
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  const displayName = user?.firstName
    ? user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName
    : user?.name || "Staff Member";

  const hasData = stats && (
    stats.chatsResolvedToday > 0 ||
    stats.chatsResolvedWeek > 0 ||
    stats.ordersProcessedToday > 0 ||
    stats.ordersProcessedWeek > 0 ||
    stats.activeChats > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="page-container"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pt-4">
        <div className="space-y-2">
          <span
            className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "var(--brand-saffron)" }}
          >
            My Profile
          </span>
          <h1
            className="text-4xl md:text-5xl font-black tracking-tight"
            style={{ color: "var(--app-text)" }}
          >
            {displayName}
          </h1>
          <p className="font-medium text-lg" style={{ color: "var(--text-secondary)" }}>
            Your personal performance at a glance.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="p-3 rounded-xl text-sm mb-6"
          style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={MessageSquare}
          label="Chats Resolved Today"
          value={loading ? "\u2014" : stats?.chatsResolvedToday ?? 0}
          subValue={loading ? undefined : `This week: ${stats?.chatsResolvedWeek ?? 0}`}
          color="var(--brand-saffron)"
          bgColor="rgba(212, 168, 67, 0.1)"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Avg Response Time"
          value={loading ? "\u2014" : formatDuration(stats?.avgResponseTimeSeconds ?? 0)}
          subValue="Last 30 days"
          color="#3b82f6"
          bgColor="rgba(59, 130, 246, 0.1)"
          loading={loading}
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders Processed Today"
          value={loading ? "\u2014" : stats?.ordersProcessedToday ?? 0}
          subValue={loading ? undefined : `This week: ${stats?.ordersProcessedWeek ?? 0}`}
          color="var(--success-green)"
          bgColor="rgba(34, 197, 94, 0.1)"
          loading={loading}
        />
        <StatCard
          icon={Activity}
          label="Active Chats"
          value={loading ? "\u2014" : stats?.activeChats ?? 0}
          subValue="Currently assigned to you"
          color="#8b5cf6"
          bgColor="rgba(139, 92, 246, 0.1)"
          loading={loading}
        />
        <StatCard
          icon={Calendar}
          label="Chats Resolved (7d)"
          value={loading ? "\u2014" : stats?.chatsResolvedWeek ?? 0}
          subValue="Last 7 days"
          color="#f59e0b"
          bgColor="rgba(245, 158, 11, 0.1)"
          loading={loading}
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders Processed (7d)"
          value={loading ? "\u2014" : stats?.ordersProcessedWeek ?? 0}
          subValue="Last 7 days"
          color="#06b6d4"
          bgColor="rgba(6, 182, 212, 0.1)"
          loading={loading}
        />
      </div>

      {/* Empty State */}
      {!loading && !hasData && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <User className="h-16 w-16" style={{ color: "var(--app-text-muted)" }} />
          <div className="text-xl font-black" style={{ color: "var(--text-secondary)" }}>
            No activity recorded yet
          </div>
          <p className="text-sm font-medium text-center max-w-sm" style={{ color: "var(--app-text-muted)" }}>
            Your resolved chats, response times, and processed orders will appear here once you start handling conversations.
          </p>
        </div>
      )}
    </motion.div>
  );
}
