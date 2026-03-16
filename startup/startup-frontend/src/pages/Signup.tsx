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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
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
          <h1 className="text-3xl font-bold text-white mb-2">
            Create your account
          </h1>
          <p className="text-slate-400 mb-6">
            Start managing leads in minutes
          </p>

          {error && (
            <p className="mb-4 text-sm text-red-400">{error}</p>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
            <div>
              <label className="block text-sm text-slate-200 mb-2">
                Company name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 py-3 pl-11 pr-4 text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-200 mb-2">
                Full name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 py-3 pl-11 pr-4 text-white"
                  required
                />
              </div>
            </div>

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
              className="w-full bg-cyan-600 hover:bg-cyan-700 rounded-lg py-3 font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="text-cyan-400 font-semibold">
              Log in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
