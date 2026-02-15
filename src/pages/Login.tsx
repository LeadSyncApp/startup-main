import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, Mail, Lock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api"; // ✅ centralized API

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ✅ Using centralized API
      const data = await api.post("/auth/login", {
        email,
        password,
      });

      if (!data.token) {
        console.error("❌ Token missing in response");
        setError("Invalid login response");
        return;
      }

      // ✅ Correct order
      login(data.user, data.company, data.token);

      console.log("✅ Login successful");
      navigate("/dashboard", { replace: true });

    } catch (err: any) {
      console.error("❌ Login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-cyan-600 rounded-xl p-2.5">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <div>
            <span className="text-3xl font-bold text-cyan-400">LeadSync</span>
            <p className="text-xs text-slate-400">CRM Platform</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-xl">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-slate-400 mb-6">Sign in to your account</p>

          {error && (
            <p className="mb-4 text-sm text-red-400">{error}</p>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
            <div>
              <label className="block text-sm text-slate-200 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 py-3 pl-11 pr-4 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-200 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 py-3 pl-11 pr-4 text-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-700 rounded-lg py-3 font-semibold text-white flex items-center justify-center gap-2"
            >
              {loading ? "Signing in…" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don’t have an account?{" "}
            <Link
              to="/signup"
              className="text-cyan-400 font-semibold"
            >
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
