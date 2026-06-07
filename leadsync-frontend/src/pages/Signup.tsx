import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, Building2, ArrowRight, MapPin, Phone, Key, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState<"owner" | "staff">("owner");

  // Owner state
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Staff onboarding state
  const [companyCode, setCompanyCode] = useState("");
  const [staffId, setStaffId] = useState("");
  const [residingAddress, setResidingAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCompanyCode, setShowCompanyCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "owner") {
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

        login(data.user, data.company, data.token);
        navigate("/dashboard", { replace: true });
      } else {
        // Staff self-signup / onboarding completion
        const data = await api.post("/auth/staff-signup", {
          companyCode: companyCode.trim().toUpperCase(),
          staffId: staffId.trim(),
          name,
          password,
          residingAddress,
          phoneNumber,
        });

        if (!data.token) {
          setError("Invalid onboarding verification details");
          return;
        }

        login(data.user, data.company, data.token);
        navigate("/dashboard", { replace: true });
      }

    } catch (err: any) {
      console.error("❌ Registration error:", err);
      setError(err.message || "Registration failed. Verify entered access credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] px-4 py-12 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/favicon.svg" alt="LeadSync Logo" className="h-12 w-12 rounded-xl shadow-sm object-contain" />
          <div>
            <span className="text-3xl font-bold text-[var(--app-text)]">LeadSync</span>
            <p className="text-xs text-[var(--app-text-muted)]">CRM & Workspace Platform</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-8 shadow-xl shadow-slate-900/10">
          
          {/* Dual Toggle Option */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl mb-6 text-xs font-semibold select-none">
            <button
              onClick={() => {
                setMode("owner");
                setError("");
              }}
              type="button"
              className={`flex-1 py-2.5 rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === "owner"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-350"
              }`}
            >
              <Building2 size={14} />
              Register Workspace (Owner)
            </button>
            <button
              onClick={() => {
                setMode("staff");
                setError("");
              }}
              type="button"
              className={`flex-1 py-2.5 rounded-lg text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === "staff"
                  ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-xs"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-950 dark:hover:text-slate-350"
              }`}
            >
              <ShieldCheck size={14} />
              Teammate Onboarding (Staff)
            </button>
          </div>

          <h1 className="text-2xl font-bold text-[var(--app-text)] mb-1">
            {mode === "owner" ? "Create your workspace" : "Teammate Access Activation"}
          </h1>
          <p className="text-xs text-[var(--app-text-muted)] mb-6 leading-relaxed">
            {mode === "owner" 
              ? "Start managing leads and scaling operations as organization Owner-creator." 
              : "Complete onboarding check-list using your provided corporate credentials."}
          </p>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-650 font-medium">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            
            {/* Owner Section specific fields */}
            {mode === "owner" && (
              <div>
                <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                  Company Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    placeholder="e.g. Acme Corp"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full text-xs rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-4 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
              </div>
            )}

            {/* Staff specific Onboarding Credentials */}
            {mode === "staff" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                    Company Access Code
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type={showCompanyCode ? "text" : "password"}
                      placeholder="e.g. ACME123"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value)}
                      className="w-full text-xs font-mono font-bold tracking-wider rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-10 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCompanyCode(!showCompanyCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                    >
                      {showCompanyCode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                    Staff Identifier ID / Token
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      placeholder="e.g. STF-098"
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      className="w-full text-xs font-mono font-bold tracking-wider rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-4 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Shared Profile setup fields */}
            <div>
              <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  placeholder="e.g. Rachel Green"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-4 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                  required
                />
              </div>
            </div>

            {/* Email field (only required in owner signup; staff uses predefined auth record) */}
            {mode === "owner" && (
              <div>
                <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="email"
                    placeholder="rachel@company.com"
                    value={email}
                    autoComplete="off"
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-4 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                    required
                  />
                </div>
              </div>
            )}

            {/* Staff Residency & Phone Contact setup details */}
            {mode === "staff" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                    Phone / Contact Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="tel"
                      placeholder="e.g. +1 555-0199"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full text-xs rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-4 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                    Residing Physical Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      placeholder="e.g. Greenwich Village, NY"
                      value={residingAddress}
                      onChange={(e) => setResidingAddress(e.target.value)}
                      className="w-full text-xs rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-4 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[var(--app-text)] mb-1.5">
                Set Authorization Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="minimum 6 key characters"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs rounded-xl bg-[var(--app-input-bg)] border border-[var(--app-border)] py-3 pl-10 pr-10 text-[var(--app-text)] placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700/90 rounded-xl py-3 font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition shadow-sm mt-3 text-xs cursor-pointer"
            >
              {loading 
                ? (mode === "owner" ? "Deploying workspace…" : "Verifying credentials…") 
                : (mode === "owner" ? "Deploy Workspace Account" : "Activate Teammate Onboarding")}
              <ArrowRight size={14} />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[var(--app-text-muted)]">
            Already registered?{" "}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Log in securely
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
