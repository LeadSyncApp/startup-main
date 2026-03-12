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
const DashboardHome  = lazy(() => import("./pages/dashboard/DashboardHome"));
const Leads          = lazy(() => import("./pages/dashboard/Leads"));
const Conversations  = lazy(() => import("./pages/dashboard/Conversations"));
const Orders         = lazy(() => import("./pages/dashboard/Orders"));
const Revenue        = lazy(() => import("./pages/dashboard/Revenue"));
const Reports        = lazy(() => import("./pages/dashboard/Reports"));
const Settings       = lazy(() => import("./pages/dashboard/Settings"));
const UserManagement = lazy(() => import("./pages/dashboard/UserManagement"));
const Broadcasts     = lazy(() => import("./pages/dashboard/Broadcasts"));

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
        <Route path="conversations" element={<Conversations />} />

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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
