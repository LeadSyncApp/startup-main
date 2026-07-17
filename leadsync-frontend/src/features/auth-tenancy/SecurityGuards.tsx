import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth, Role } from "./AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

/**
 * Ensures user context exists; matches roles if restricted.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#020617]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-950 border-t-cyan-400" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}

/**
 * Redirects authenticated individuals directly to the Workspace to block redundant login frames.
 */
export function PublicRoute({ children }: { children?: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

/**
 * Failsafe structural element wrapper; shields portions of workspace widgets from restricted access roles.
 */
export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return null; // Silent shield
  }

  return <>{children}</>;
}
