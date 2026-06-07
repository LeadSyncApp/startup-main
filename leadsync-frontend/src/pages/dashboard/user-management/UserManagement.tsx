import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import { 
  Trash2, 
  Shield, 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  Edit2, 
  KeyRound, 
  X, 
  BarChart3, 
  Radio, 
  UserPlus, 
  Clock, 
  Lock,
  Sparkles,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  roleDefinitionId?: string;
  roleDefinition?: { name: string };
  isActive: boolean;
  isAvailable?: boolean;
  staffId?: string;
  createdAt: string;
  workspaceAuthScale?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  phoneNumber?: string | null;
  residingAddress?: string | null;
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-amber-50 text-amber-800 border border-amber-200/60 font-bold",
  ADMIN: "bg-indigo-50 text-indigo-800 border border-indigo-200/60 font-medium",
  AGENT: "bg-slate-50 text-slate-800 border border-slate-200 font-normal",
};

const CHANNEL_ICONS: Record<string, string> = {
  WEBSITE: "🌐",
  TELEGRAM: "✈️",
  WHATSAPP: "💚",
  INSTAGRAM: "📸"
};

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  
  const sizeClasses = {
    sm: "w-8 h-8 text-[10px]",
    md: "w-10 h-10 text-xs",
    lg: "w-14 h-14 text-base"
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm border border-white/20`}>
      {initials}
    </div>
  );
}

function formatLastSeen(dateStr: string | null | Date, isOnline: boolean) {
  if (isOnline) return "Online";
  if (!dateStr) return "Offline";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDisable, setConfirmDisable] = useState<User | null>(null);
  const [activeAgentDrawer, setActiveAgentDrawer] = useState<User | null>(null);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<{ id: string; name: string; companyCode: string } | null>(null);
  const [showCompanyCode, setShowCompanyCode] = useState(false);

  const [customRoles, setCustomRoles] = useState<{id: string, name: string}[]>([]);

  async function fetchCompanyDetails() {
    try {
      const res = await api.get("/users/my-company");
      setCompanyDetails(res);
    } catch (err) {
      console.error("Failed to load company details:", err);
    }
  }

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ADMIN" | "AGENT" | "OWNER" | "ONLINE" | "INACTIVE">("ALL");

  const [form, setForm] = useState({
    name: "",
    email: "",
    staffId: "",
    password: "",
    role: "AGENT" as "ADMIN" | "AGENT",
    roleDefinitionId: "" as string,
    isActive: true,
    workspaceAuthScale: "Medium (Level 2 — Broadcasts, Automation)",
  });

  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsers(res);
      
      if (user?.role === "OWNER" || user?.role === "ADMIN") {
        try {
          const statsRes = await api.get("/users/owner-dashboard");
          setDashboardStats(statsRes);
          
          if (user?.role === "OWNER") {
            const roleRes = await api.get("/rbac");
            setCustomRoles(Array.isArray(roleRes) ? roleRes : []);
          }
        } catch (err) {
          console.error("Failed to load owner analytics or roles:", err);
        }
      }
    } catch {
      toast.error("Failed to fetch team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    fetchUsers(); 
    fetchCompanyDetails();
  }, [user]);

  async function handleCreateUser() {
    if (!form.staffId || !form.email || !form.workspaceAuthScale) {
      toast.error("Email, Staff ID Token, and Workspace Authorization Scale are required");
      return;
    }
    try {
      await api.post("/users/onboard-invite", {
        email: form.email,
        staffId: form.staffId.trim(),
        workspaceAuthScale: form.workspaceAuthScale,
        role: form.role,
        roleDefinitionId: form.roleDefinitionId || null,
      });
      toast.success("Teammate onboarding invite saved successfully!");
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create onboard invitation");
    }
  }

  async function handleUpdateUser() {
    if (!editingUser) return;
    if (!form.name || !form.email || !form.staffId) {
      toast.error("Name, Email and Staff ID are required");
      return;
    }
    try {
      await api.put(`/users/${editingUser.id}`, {
        name: form.name,
        email: form.email,
        staffId: form.staffId.trim(),
        role: form.role,
        roleDefinitionId: form.roleDefinitionId,
        isActive: form.isActive,
      });
      toast.success("Teammate profile updated!");
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
      
      // Update drawer info if drawer is open for this teammate
      if (activeAgentDrawer?.id === editingUser.id) {
        setActiveAgentDrawer(prev => prev ? { ...prev, name: form.name, email: form.email, staffId: form.staffId, role: form.role, isActive: form.isActive } : null);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile");
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordUser) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    try {
      await api.patch(`/users/${resetPasswordUser.id}/password`, {
        password: newPassword,
      });
      toast.success(`Password reset for ${resetPasswordUser.name}`);
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset password");
    }
  }

  async function handleDisable(u: User) {
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`${u.name} deactivated successfully`);
      setConfirmDisable(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to deactivate user");
    }
  }

  function handleEditClick(u: User) {
    setModalMode("edit");
    setEditingUser(u);
    setForm({
      name: u.name,
      email: u.email,
      staffId: u.staffId || "",
      password: "", // Leave empty
      role: u.role as any,
      roleDefinitionId: u.roleDefinitionId || "",
      isActive: u.isActive,
      workspaceAuthScale: u.workspaceAuthScale || "Medium (Level 2 — Broadcasts, Automation)",
    });
    setShowModal(true);
  }

  function resetForm() {
    setForm({ 
      name: "", 
      email: "", 
      staffId: "", 
      password: "", 
      role: "AGENT", 
      roleDefinitionId: "", 
      isActive: true, 
      workspaceAuthScale: "Medium (Level 2 — Broadcasts, Automation)" 
    });
  }

  // Statistics Computations
  const total = users.length;
  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = total - activeCount;
  const adminsCount = users.filter((u) => u.role === "ADMIN" || u.role === "OWNER").length;

  // Filter application
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    const queryMatch =
      !query ||
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.staffId && u.staffId.toLowerCase().includes(query));

    if (!queryMatch) return false;

    if (activeTab === "ALL") return true;
    if (activeTab === "ADMIN") return u.role === "ADMIN";
    if (activeTab === "AGENT") return u.role === "AGENT";
    if (activeTab === "OWNER") return u.role === "OWNER";
    if (activeTab === "ONLINE") return u.isActive && u.isAvailable !== false;
    if (activeTab === "INACTIVE") return !u.isActive;
    return true;
  });

  // Get active agent's KPI metrics from owner-dashboard
  const getAgentPerformance = (agentId: string) => {
    if (!dashboardStats?.agentStats) return null;
    return dashboardStats.agentStats.find((s: any) => s.agentId === agentId);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-text tracking-tight flex items-center gap-2">
            Team Workspace & Identity
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Edit profiles, configure system access levels, and audit agent capacities.</p>
        </div>
        {canManage && (
          <button
            onClick={() => {
              setModalMode("create");
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition duration-150 text-sm font-semibold shadow-sm"
          >
            <UserPlus size={16} />
            Onboard Teammate
          </button>
        )}
      </div>

      {/* 🔐 Company Access Code Banner widget */}
      {companyDetails && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-2xs relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-bl-full pointer-events-none" />
          <div className="flex items-start gap-3.5 relative z-10">
            <div className="bg-amber-100 text-amber-700 p-2.5 rounded-xl flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
            </div>
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-800">Company Access Code / Login ID</h4>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xl font-extrabold text-amber-900 font-mono tracking-widest">
                  {showCompanyCode ? companyDetails.companyCode : "••••••••••••"}
                </p>
                <button
                  type="button"
                  onClick={() => setShowCompanyCode(!showCompanyCode)}
                  className="text-amber-700 hover:text-amber-900 transition bg-amber-200/50 hover:bg-amber-200 p-1.5 rounded-lg"
                  title={showCompanyCode ? "Hide code" : "Reveal code"}
                >
                  {showCompanyCode ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1 max-w-2xl leading-normal">
                This is your unique organizational key. Pass this Access Code along with their assigned Staff ID token to incoming teammates so they can register and details automatically sync.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(companyDetails.companyCode);
              toast.success("Company Access Code copied!");
            }}
            className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 border border-amber-700/20 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Code
          </button>
        </div>
      )}

      {/* Numerical Performance KPIs Widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Handlers", value: total, icon: Users, color: "text-indigo-600 bg-indigo-50/70 border-indigo-100" },
          { label: "Active Handlers", value: activeCount, icon: UserCheck, color: "text-emerald-600 bg-emerald-50/70 border-emerald-100" },
          { label: "On Rest / Inactive", value: inactiveCount, icon: UserX, color: "text-slate-500 bg-slate-50 border-slate-200" },
          { label: "Admin Core", value: adminsCount, icon: Shield, color: "text-amber-600 bg-amber-50/70 border-amber-100" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-app-surface border border-app rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color} border`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-app-text">{value}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Directory & Workspace Controls */}
      <div className="bg-app-surface rounded-2xl border border-app shadow-sm overflow-hidden space-y-4 py-4">
        
        {/* Search and Filters Hub */}
        <div className="px-5 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          
          {/* Tab Filters */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl max-w-max self-start text-xs font-semibold">
            {[
              { id: "ALL", label: "All Squad" },
              { id: "ADMIN", label: "Admins" },
              { id: "AGENT", label: "Agents" },
              { id: "ONLINE", label: "Online" },
              { id: "INACTIVE", label: "Deactivated" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition duration-150 ${
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative flex-1 max-w-md min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or Staff ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-slate-700 bg-app-bg border border-app rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors shadow-2xs"
            />
          </div>

        </div>

        {/* Directory Ledger Grid */}
        <div className="overflow-x-auto min-h-[250px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wide border-y border-slate-100">
                <th className="px-5 py-3">Member Details</th>
                <th className="px-5 py-3 hidden sm:table-cell">Staff ID</th>
                <th className="px-5 py-3">Role Scale</th>
                <th className="px-5 py-3">System Status</th>
                <th className="px-5 py-3">Assign Strategy</th>
                <th className="px-5 py-3 text-right">Teammate Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {loading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-400">
                    Loading directory ledger...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-400">
                    No matching crew members found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  return (
                  <tr 
                    key={u.id} 
                    className={`hover:bg-slate-50/40 transition group ${
                      !u.isActive ? "opacity-60 bg-slate-50/30" : ""
                    }`}
                  >
                    {/* Member */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                            {u.name}
                          </p>
                          <p className="text-slate-400 text-[11px] truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Staff ID */}
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200/50 px-2 py-1 rounded-md font-bold">
                        {u.staffId || "—"}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`text-[10px] tracking-wide font-black px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
                          {u.role}
                        </span>
                        {u.roleDefinition && (
                          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 max-w-[120px] truncate" title={u.roleDefinition.name}>
                            {u.roleDefinition.name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      {!u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200/50 px-2.5 py-0.5 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          Deactivated
                        </span>
                      ) : u.isOnline ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-150 px-2.5 py-0.5 rounded-full shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                          Online
                        </span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 bg-slate-50/50 border border-slate-200/50 px-2.5 py-0.5 rounded-full max-w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                            Offline
                          </span>
                          {u.lastSeenAt && (
                            <span className="text-[9px] text-slate-400 mt-1 pl-1 capitalize font-medium">
                              {formatLastSeen(u.lastSeenAt, false)}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Routing Availability */}
                    <td className="px-5 py-3.5">
                      {u.isActive ? (
                        <div className="flex items-center gap-2">
                          <button
                            disabled={!canManage}
                            onClick={async () => {
                              const newAvailableState = !(u.isAvailable !== false);
                              try {
                                await api.patch(`/users/${u.id}/availability`, {
                                  isAvailable: newAvailableState,
                                });
                                setUsers((prev) =>
                                  prev.map((item) =>
                                    item.id === u.id ? { ...item, isAvailable: newAvailableState } : item
                                  )
                                );
                                toast.success(`${u.name}'s routing queue updated`);
                              } catch {
                                toast.error("Failed to update availability");
                              }
                            }}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              u.isAvailable !== false ? "bg-emerald-500" : "bg-slate-300"
                            } ${!canManage ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                u.isAvailable !== false ? "translate-x-3" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className={`text-[10px] font-extrabold ${u.isAvailable !== false ? "text-emerald-700" : "text-amber-600"}`}>
                            {u.isAvailable !== false ? "CLAIMABLE" : "PAUSED"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs font-mono">—</span>
                      )}
                    </td>

                    {/* Actions Panel */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        
                        {/* Live insights drawer trigger */}
                        {u.isActive && (
                          <button
                            onClick={() => {
                              setActiveAgentDrawer(u);
                            }}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200/50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                            title="Live Insights Panel"
                          >
                            <BarChart3 size={13} />
                          </button>
                        )}

                        {/* Inline profile editor */}
                        {canManage && (u.id === user?.id || !u.isActive) && (
                          <button
                            onClick={() => handleEditClick(u)}
                            className="bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200/50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                            title="Edit Profile details"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}

                        {/* Reset password quick key */}
                        {canManage && (u.role !== "OWNER" || user?.role === "OWNER") && (
                          <button
                            onClick={() => {
                              setResetPasswordUser(u);
                              setNewPassword("");
                            }}
                            className="bg-slate-50 hover:bg-amber-50 text-slate-500 hover:text-amber-600 border border-slate-200/50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                            title="Reset Password"
                          >
                            <KeyRound size={13} />
                          </button>
                        )}

                        {/* Deactivate account */}
                        {user?.role === "OWNER" && u.isActive && u.role !== "OWNER" && (
                          <button
                            onClick={() => setConfirmDisable(u)}
                            className="bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 border border-red-100/50 p-1.5 rounded-lg transition-colors flex items-center justify-center"
                            title="Deactivate account"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Empty Search results display */}
        {filteredUsers.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs font-semibold">No teammates match the filter strategy.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Refine your search criteria above.</p>
          </div>
        )}
      </div>

      {/* Multi-Purpose Create/Edit Profile Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] px-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative z-10 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                  {modalMode === "create" ? "Onboard Teammate" : "Edit Profile details"}
                </h2>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 shadow-2xs">
                {/* Full name (Only show on Edit, since it is set on Signup otherwise) */}
                {modalMode === "edit" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Rachel Green"
                      value={form.name} 
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full text-xs text-slate-800 bg-slate-50/50 border border-app rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                    />
                  </div>
                )}

                {/* Email address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email Address</label>
                  <input 
                    type="email" 
                    placeholder="e.g. rachel@company.com"
                    value={form.email} 
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full text-xs text-slate-800 bg-slate-50/50 border border-app rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Staff ID */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Staff Identifier Token / Code</label>
                  <input 
                    type="text" 
                    placeholder="e.g. AGENT098"
                    value={form.staffId} 
                    onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                    className="w-full text-xs text-slate-800 bg-slate-50/50 font-mono border border-app rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>

                {/* Authorization Scale Clearance drop-down */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Authorization Scale / Clearance Level</label>
                  <select 
                    className="w-full text-xs text-slate-800 bg-slate-50/50 border border-app rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
                    value={form.workspaceAuthScale} 
                    onChange={(e) => setForm({ ...form, workspaceAuthScale: e.target.value })}
                  >
                    <option value="Level 1 (Basic Support Queue Operations)">Level 1 (Basic Support Queue Operations)</option>
                    <option value="Level 2 (Standard Agent Operations with Broadcast Access)">Level 2 (Standard Agent Operations with Broadcast Access)</option>
                    <option value="Level 3 (Senior Coordinator & Assignment Admin)">Level 3 (Senior Coordinator & Assignment Admin)</option>
                    <option value="Level 4 (Executive Clearances & Settings Access)">Level 4 (Executive Clearances & Settings Access)</option>
                  </select>
                </div>

                {/* Role selectivity */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Workspace Authorization Scale</label>
                  <select 
                    className="w-full text-xs text-slate-800 bg-slate-50/50 border border-app rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
                    value={form.roleDefinitionId ? `CUSTOM_${form.roleDefinitionId}` : form.role} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith("CUSTOM_")) {
                        setForm({ ...form, role: "AGENT", roleDefinitionId: val.replace("CUSTOM_", "") });
                      } else {
                        setForm({ ...form, role: val as any, roleDefinitionId: "" });
                      }
                    }}
                  >
                    <optgroup label="Standard Roles">
                      <option value="AGENT">Agent — Claims and processes leads & tickets</option>
                      <option value="ADMIN">Admin — Full configurations, excluding payments</option>
                    </optgroup>
                    
                    {customRoles.length > 0 && (
                      <optgroup label="Custom Permission Sets">
                        {customRoles.map(r => (
                          <option key={r.id} value={`CUSTOM_${r.id}`}>{r.name} (Custom)</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Toggle Active status inside modal in Edit Mode */}
                {modalMode === "edit" && editingUser?.role !== "OWNER" && (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl mt-1">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Account Active State</p>
                      <p className="text-[10px] text-slate-400">Determines if user can authenticate to LeadSync CRM</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, isActive: !form.isActive })}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        form.isActive ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          form.isActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-app text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={modalMode === "create" ? handleCreateUser : handleUpdateUser}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs"
                >
                  {modalMode === "create" ? "Fulfill Onboarding" : "Commit Profile Updates"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* specialized Password Reset Modal */}
      <AnimatePresence>
        {resetPasswordUser && (
          <div className="fixed inset-0 z-[100] px-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setResetPasswordUser(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl relative z-10 border border-slate-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Reset Passcode: {resetPasswordUser.name}
                </h2>
                <button onClick={() => setResetPasswordUser(null)} className="text-slate-400 hover:text-slate-500">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
                  Resetting credentials overrides current agent logins securely. Provide a fresh password of min 6 characters.
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Fresh Credentials secret</label>
                  <input
                    type="password"
                    placeholder="Input fresh password passcode"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs text-slate-800 bg-slate-50/50 border border-app rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setResetPasswordUser(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-app text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
                >
                  Override Key
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm disabling user Modal */}
      <AnimatePresence>
        {confirmDisable && (
          <div className="fixed inset-0 z-[100] px-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setConfirmDisable(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl relative z-10 border border-slate-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4 mx-auto border border-red-100">
                <UserX className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-base font-bold text-slate-800 text-center">Deactivate teammate?</h2>
              <p className="text-xs text-slate-500 text-center mt-1 mb-5">
                <strong>{confirmDisable.name}</strong> will lose authentication permissions immediately inside CRM dashboards.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDisable(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-app text-xs font-medium hover:bg-slate-55 transition text-slate-500"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDisable(confirmDisable)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition"
                >
                  Yes, Deactivate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sliding Crew Member performance Drawer panel */}
      <AnimatePresence>
        {activeAgentDrawer && (
          <div className="fixed inset-0 z-[110] flex justify-end overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setActiveAgentDrawer(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="bg-white w-full max-w-md h-full relative z-10 border-l border-app shadow-2xl flex flex-col justify-between"
            >
              {/* Header inside side drawer */}
              <div className="p-6 border-b border-app flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-sm uppercase text-slate-500 tracking-wider">Teammate Performance Overview</h3>
                </div>
                <button 
                  onClick={() => setActiveAgentDrawer(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
                
                {/* Agent Card Header */}
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <Avatar name={activeAgentDrawer.name} size="lg" />
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-slate-800 text-base truncate">{activeAgentDrawer.name}</h4>
                    <p className="text-slate-400 text-xs truncate mb-2">{activeAgentDrawer.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 border px-2 py-0.5 rounded font-black">
                        {activeAgentDrawer.staffId || "NO-ID"}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wide px-2.5 py-0.5 rounded-full ${ROLE_BADGE[activeAgentDrawer.role]}`}>
                        {activeAgentDrawer.role}
                      </span>
                      {activeAgentDrawer.roleDefinition && (
                        <span className="text-[9px] font-black uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                          {activeAgentDrawer.roleDefinition.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Systems Identity, Residences and Authorization scale details */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <h5 className="font-extrabold text-xs text-slate-700 tracking-wide pb-1 border-b border-slate-200/50">
                    Onboarding & Identity Parameters
                  </h5>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Authorization Scale</p>
                      <p className="font-semibold text-slate-700 mt-0.5">{activeAgentDrawer.workspaceAuthScale || "Standard Default"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Current Status</p>
                      <span className={`inline-flex items-center gap-1 font-bold text-[9px] px-2 py-0.5 rounded-full mt-1 ${activeAgentDrawer.isOnline ? "text-emerald-700 bg-emerald-50 border border-emerald-100/50" : "text-slate-500 bg-slate-100 border border-slate-200/50"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${activeAgentDrawer.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                        {activeAgentDrawer.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    {activeAgentDrawer.phoneNumber && (
                      <div className="col-span-2">
                        <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Contact Number</p>
                        <p className="font-semibold text-slate-700 mt-0.5 font-mono">{activeAgentDrawer.phoneNumber}</p>
                      </div>
                    )}
                    {activeAgentDrawer.residingAddress && (
                      <div className="col-span-2">
                        <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Residential Address</p>
                        <p className="font-semibold text-slate-700 mt-0.5">{activeAgentDrawer.residingAddress}</p>
                      </div>
                    )}
                    {activeAgentDrawer.lastSeenAt && !activeAgentDrawer.isOnline && (
                      <div className="col-span-2">
                        <p className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Last Seen State</p>
                        <p className="font-semibold text-slate-700 mt-0.5 font-mono">
                          {formatLastSeen(activeAgentDrawer.lastSeenAt, false)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dynamic Operational KPI blocks */}
                <div className="space-y-4">
                  <h5 className="font-bold text-xs text-slate-700 tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Live Backlog Statistics
                  </h5>
                  
                  {getAgentPerformance(activeAgentDrawer.id) ? (() => {
                    const stats = getAgentPerformance(activeAgentDrawer.id);
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-indigo-50/50 border border-indigo-100/60 rounded-xl p-3 text-center">
                          <p className="text-lg font-extrabold text-indigo-700">{stats.totalAssignedCount}</p>
                          <p className="text-[10px] font-medium text-slate-500">Cumulative</p>
                        </div>
                        <div className="bg-amber-50/50 border border-amber-100/60 rounded-xl p-3 text-center">
                          <p className="text-lg font-extrabold text-amber-700">{stats.currentConvsCount}</p>
                          <p className="text-[10px] font-medium text-slate-500">On-Desk</p>
                        </div>
                        <div className="bg-emerald-50/50 border border-emerald-100/60 rounded-xl p-3 text-center">
                          <p className="text-lg font-extrabold text-emerald-700">{stats.resolvedConvsCount}</p>
                          <p className="text-[10px] font-medium text-slate-500">Resolved</p>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="bg-slate-50 p-4 rounded-xl text-center text-slate-400 text-xs">
                      No operational data logged. Onboard active channels to feed real-time agent metrics.
                    </div>
                  )}
                </div>

                {/* List of Active Conversations/Opportunities */}
                <div className="space-y-3">
                  <h5 className="font-bold text-xs text-slate-700 tracking-wide flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    Pending Customer Sessions
                  </h5>

                  {getAgentPerformance(activeAgentDrawer.id) && getAgentPerformance(activeAgentDrawer.id).currentConversations?.length > 0 ? (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {getAgentPerformance(activeAgentDrawer.id).currentConversations.map((c: any) => (
                        <div 
                          key={c.id} 
                          className="flex items-center justify-between border border-slate-100 bg-white p-2.5 rounded-xl hover:border-slate-300 transition shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base" title={`${c.lead?.channel} session`}>
                              {CHANNEL_ICONS[c.lead?.channel] || "💬"}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-slate-800 truncate">
                                {c.lead?.name || "Anonymous Contact"}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{c.lead?.contact || "—"}</p>
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-50 border px-2 py-0.5 rounded">
                            {new Date(c.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-150 p-6 rounded-2xl text-center text-slate-400">
                      <Clock className="w-6 h-6 mx-auto opacity-20 mb-2" />
                      <p className="text-[11px] font-semibold">Zero Active Pending Tickets</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Teammate is clear of any active backlogs.</p>
                    </div>
                  )}
                </div>

                {/* List of Recently Resolved Opportunities */}
                <div className="space-y-3">
                  <h5 className="font-bold text-xs text-slate-700 tracking-wide">
                    Recently Finalized Opportunities
                  </h5>

                  {getAgentPerformance(activeAgentDrawer.id) && getAgentPerformance(activeAgentDrawer.id).resolvedConversations?.length > 0 ? (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {getAgentPerformance(activeAgentDrawer.id).resolvedConversations.slice(0, 5).map((c: any) => (
                        <div 
                          key={c.id} 
                          className="flex items-center justify-between border border-slate-100 bg-slate-50/50 p-2 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {CHANNEL_ICONS[c.lead?.channel] || "💬"}
                            </span>
                            <p className="font-medium text-xs text-slate-700 truncate max-w-[120px]">
                              {c.lead?.name || "Finalized client"}
                            </p>
                          </div>
                          <span className="text-[9px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-black max-w-max uppercase">
                            RESOLVED
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic pl-1">No recently resolved logs available on record.</p>
                  )}
                </div>

              </div>

              {/* Footer action inside Drawer */}
              <div className="p-4 bg-slate-50 border-t border-app flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeAgentDrawer.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {activeAgentDrawer.name}'s Profile
                </div>
                {canManage && (activeAgentDrawer.id === user?.id || !activeAgentDrawer.isActive) && (
                  <button
                    onClick={() => {
                      handleEditClick(activeAgentDrawer);
                    }}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition shadow-sm"
                  >
                    <Edit2 size={11} />
                    Edit Profile
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
