/**
 * Marketing Nav - Navigation bar for Home / Marketing page
 */

import { Link, useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function MarketingNav() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 font-bold text-slate-900"
        >
          <Zap className="h-8 w-8 text-cyan-500" />
          <span className="text-xl">LeadSync</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          {!token ? (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Log In
              </Link>

              <Link
                to="/signup"
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 transition-colors"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>

              <button
                onClick={handleLogout}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
