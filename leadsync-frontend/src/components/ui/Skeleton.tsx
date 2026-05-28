import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
}

/** A single shimmer line/box — compose these inside skeleton layouts */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200/60 ${className}`}
    />
  );
}

/** Skeleton card matching the KPI stat card layout */
export function StatCardSkeleton() {
  return (
    <div className="bg-app-surface border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

/** Skeleton for a chart area */
export function ChartSkeleton({ height = "h-[340px]" }: { height?: string }) {
  return (
    <div className="bg-app-surface p-6 rounded-2xl border border-app shadow-sm">
      <Skeleton className="h-5 w-48 mb-6" />
      <div className={`${height} flex items-end gap-2 px-4`}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 animate-pulse rounded-t-md bg-slate-200/60"
            style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Table row skeleton */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-slate-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className={`h-4 ${i === 0 ? "w-32" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}

/** Full table skeleton with header + rows */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-app-surface rounded-xl shadow border overflow-hidden">
      <div className="bg-app-bg px-6 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <table className="min-w-full">
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** List item skeleton (for sidebar lists, conversation lists, etc.) */
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

/** Conversation list skeleton */
export function ConversationListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

/** Page-level loading with centered spinner and pulse */
export function PageSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header skeleton */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      {/* Grid skeleton */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      {/* Chart skeleton */}
      <ChartSkeleton />
    </motion.div>
  );
}

/** Dashboard home full loading state */
export function DashboardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 pb-10"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* KPI Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Chart + Side panel */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton height="h-[340px]" />
        </div>
        <div className="bg-app-surface p-6 rounded-2xl border border-app shadow-sm space-y-4">
          <Skeleton className="h-5 w-32 mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-6 h-6 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-app-surface p-6 rounded-2xl border border-app shadow-sm space-y-4">
          <Skeleton className="h-5 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-app-bg rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-app-surface p-6 rounded-xl border border-app shadow-sm">
              <Skeleton className="w-8 h-8 rounded-lg mb-3" />
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
