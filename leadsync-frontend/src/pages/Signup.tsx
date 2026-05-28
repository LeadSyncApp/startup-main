import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, Mail, Lock, User, Building2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api"; // ✅ centralized API

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.post("/auth/signup", {
        companyName,
        name,
        email,
        password,
      });

      if (!data.token) {
        setError("Invalid signup response");
        return;
      }

      // ✅ login(user, company, token)
      login(data.user, data.company, data.token);

      navigate("/dashboard", { replace: true });

    } catch (err: any) {
      console.error("❌ Signup error:", err);
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] px-4 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-cyan-600 rounded-xl p-2.5 shadow-sm">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <div>
            <span className="text-3xl font-bold text-cyan-500 dark:text-cyan-400">LeadSync</span>
            <p className="text-xs text-[var(--app-text-muted)]">CRM Platform</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-xl shadow-slate-900/10">
          <h1 className="text-3xl font-bold text-[var(--app-text)] mb-2">
            Create your account
          </h1>
          <p className="text-[var(--app-text-muted)] mb-6">
            Start managing leads in minutes
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-500">{error}</p>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
            <div>
              <label className="block text-sm text-[var(--app-text)] mb-2">
                Company name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-11 pr-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[var(--app-text)] mb-2">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-11 pr-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-[var(--app-text)] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-text-muted)]" />
                <input
                  type="email"
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-11 pr-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
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
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-11 pr-4 text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 rounded-lg py-3 font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--app-text-muted)]">
            Already have an account?{" "}
            <Link to="/login" className="text-cyan-600 dark:text-cyan-400 font-semibold">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
