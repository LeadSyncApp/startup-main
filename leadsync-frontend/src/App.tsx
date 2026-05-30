import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

// ─── Eager (always needed on first paint) ───────────────────────
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import DashboardLayout from "./components/layout/DashboardLayout";

// ─── Lazy public pages ────────────────────────────────────────────
const Home          = lazy(() => import("./pages/Home"));
const Login         = lazy(() => import("./pages/Login"));
const Signup        = lazy(() => import("./pages/Signup"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));

// ─── Lazy dashboard pages ────────────────────────────────────────
const DashboardHome  = lazy(() => import("./pages/dashboard/dashboard-home/DashboardHome"));
const AgentInbox     = lazy(() => import("./pages/dashboard/agent-inbox/AgentInbox"));
const Conversations  = lazy(() => import("./pages/dashboard/conversations/Conversations"));
const Leads          = lazy(() => import("./pages/dashboard/leads/Leads"));
const Orders         = lazy(() => import("./pages/dashboard/orders/Orders"));
const Revenue        = lazy(() => import("./pages/dashboard/revenue/Revenue"));
const Reports        = lazy(() => import("./pages/dashboard/reports/Reports"));
const Settings       = lazy(() => import("./components/settings/Settings"));
const UserManagement = lazy(() => import("./pages/dashboard/user-management/UserManagement"));
const Broadcasts     = lazy(() => import("./pages/dashboard/broadcasts/Broadcasts"));
const OwnerDashboard = lazy(() => import("./pages/dashboard/owner-dashboard/OwnerDashboard"));

// ─── Route-level loading fallback ───────────────────────────────
function PageFallback() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* ================= PUBLIC ROUTES ================= */}
      {/* 🔐 If logged in -> Redirect to Dashboard */}
      <Route element={<PublicRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/reset-password" element={<Login />} />
        <Route path="/order-tracking" element={<OrderTracking />} />
        <Route path="/track/:id" element={<OrderTracking />} />
      </Route>

      {/* ================= DASHBOARD ================= */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Everyone logged in */}
        <Route index element={<DashboardHome />} />
        
        <Route
          path="inbox"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN", "AGENT"]}>
              <AgentInbox />
            </ProtectedRoute>
          }
        />

        <Route
          path="conversations"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN", "AGENT"]}>
              <Conversations />
            </ProtectedRoute>
          }
        />

        {/* OWNER + ADMIN */}
        <Route
          path="leads"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN", "AGENT"]}>
              <Leads />
            </ProtectedRoute>
          }
        />

        <Route
          path="orders"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN", "AGENT"]}>
              <Orders />
            </ProtectedRoute>
          }
        />

        <Route
          path="revenue"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <Revenue />
            </ProtectedRoute>
          }
        />

        <Route
          path="reports"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* ✅ OWNER + ADMIN can manage users */}
        <Route
          path="users"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="broadcasts"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <Broadcasts />
            </ProtectedRoute>
          }
        />

        <Route
          path="owner-dashboard"
          element={
            <ProtectedRoute allowedRoles={["OWNER", "ADMIN"]}>
              <OwnerDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
