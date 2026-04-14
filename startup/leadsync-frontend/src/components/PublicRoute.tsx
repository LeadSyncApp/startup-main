import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface PublicRouteProps {
    children?: JSX.Element;
}

/**
 * Public Route Guard
 * - If user is logged in: Redirect to /dashboard
 * - If user is guest: Render children (or Outlet)
 */
export default function PublicRoute({ children }: PublicRouteProps) {
    const { user, isLoading } = useAuth();

    // 1. Wait for auth check (prevent flicker)
    if (isLoading) return null;

    // 2. If User is Authenticated -> Redirect to Dashboard
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    // 3. Otherwise, render content
    return children ? children : <Outlet />;
}
