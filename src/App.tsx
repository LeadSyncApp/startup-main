import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OrderTracking from "./pages/OrderTracking";

import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Leads from "./pages/dashboard/Leads";
import Conversations from "./pages/dashboard/Conversations";
import Orders from "./pages/dashboard/Orders";
import Revenue from "./pages/dashboard/Revenue";
import Reports from "./pages/dashboard/Reports";
import Settings from "./pages/dashboard/Settings";

import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";

// ✅ Staff Management Page
import UserManagement from "./pages/dashboard/UserManagement";

export default function App() {
  return (
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
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
