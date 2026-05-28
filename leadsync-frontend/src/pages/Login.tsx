import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Zap, Mail, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

type Mode = "login" | "forgot" | "reset";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  // Check for reset token in URL params
  const resetToken = searchParams.get('token');
  
  const [mode, setMode] = useState<Mode>(resetToken ? "reset" : "login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [token, setToken] = useState(resetToken || "");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= LOGIN ================= */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.post("/auth/login", {
        email,
        password,
      });

      login(data.user, data.company, data.token);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= FORGOT PASSWORD ================= */
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.post("/auth/forgot-password", { email });

      // In development, show the token for testing
      if (data.resetToken) {
        console.log('Development reset token:', data.resetToken);
        setToken(data.resetToken);
        setMode("reset");
      } else {
        // In production, just show success message
        alert("Password reset link has been sent to your email. Please check your inbox.");
        setMode("login");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  /* ================= RESET PASSWORD ================= */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword,
      });

      setMode("login");
      setToken("");
      setNewPassword("");
      alert("Password updated successfully. Please login.");
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] px-4 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-cyan-600 rounded-xl p-2.5 shadow-sm">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <div>
            <span className="text-3xl font-bold text-app-primary dark:text-app-primary">
              LeadSync
            </span>
            <p className="text-xs text-[var(--app-text-muted)]">
              CRM Platform
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-xl shadow-slate-900/10">
          <h1 className="text-3xl font-bold text-[var(--app-text)] mb-2">
            {mode === "login"
              ? "Welcome back"
              : mode === "forgot"
                ? "Forgot Password"
                : "Reset Password"}
          </h1>

          <p className="text-[var(--app-text-muted)] mb-6">
            {mode === "login"
              ? "Sign in to your account"
              : "Follow the steps below"}
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-500">{error}</p>
          )}

          {/* ================= LOGIN FORM ================= */}
          {mode === "login" && (
            <form
              onSubmit={handleLogin}
              autoComplete="off"
              className="space-y-5"
            >
              <div>
                <label className="block text-sm text-[var(--app-text)] mb-2">
                  Email / Staff ID
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-11 pr-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    placeholder="Enter email or staff ID"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[var(--app-text)] mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-11 pr-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-app-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 rounded-lg py-3 font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? "Signing in…" : "Sign in"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* ================= FORGOT FORM ================= */}
          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-5">
              <input
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 px-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 rounded-lg py-3 font-semibold text-white"
              >
                {loading ? "Checking…" : "Continue"}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-sm text-[var(--app-text-muted)]"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* ================= RESET FORM ================= */}
          {mode === "reset" && (
            <form onSubmit={handleReset} className="space-y-5">
              {!resetToken && (
                <div>
                  <label className="block text-sm text-slate-200 mb-2">
                    Reset Token
                  </label>
                  <input
                    type="text"
                    placeholder="Enter reset token from email"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 px-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    required
                  />
                </div>
              )}
              
              <input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) =>
                  setNewPassword(e.target.value)
                }
                className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 px-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full text-sm text-[var(--app-text-muted)]"
              >
                {loading ? "Updating…" : "Reset Password"}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-sm text-[var(--app-text-muted)]"
              >
                Back to Login
              </button>
            </form>
          )}

          {mode === "login" && (
            <p className="mt-6 text-center text-sm text-[var(--app-text-muted)]">
              Don’t have an account?{" "}
              <Link to="/signup" className="text-app-primary dark:text-app-primary font-semibold">
                Sign up
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
