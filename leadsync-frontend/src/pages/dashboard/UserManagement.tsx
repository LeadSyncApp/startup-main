import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { Trash2, Plus, Shield, Users, UserCheck, UserX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  isActive: boolean;
  staffId?: string;
  createdAt: string;
}

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-800 border border-amber-200",
  ADMIN: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  AGENT: "bg-slate-100 text-slate-600 border border-slate-200",
};

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<User | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    staffId: "",
    password: "",
    role: "AGENT" as "ADMIN" | "AGENT",
  });

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsers(res);
    } catch {
      toast.error("Failed to fetch team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleCreateUser() {
    if (!form.staffId || !form.password || !form.name || !form.email) {
      toast.error("All fields are required");
      return;
    }
    try {
      await api.post("/users", form);
      toast.success("Account created!");
      setShowModal(false);
      setForm({ name: "", email: "", staffId: "", password: "", role: "AGENT" });
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user");
    }
  }

  async function handleDisable(u: User) {
    try {
      await api.delete(`/users/${u.id}`);
      toast.success(`${u.name} disabled`);
      setConfirmDisable(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to disable user");
    }
  }

  const total = users.length;
  const active = users.filter((u) => u.isActive).length;
  const inactive = total - active;
  const admins = users.filter((u) => u.role === "ADMIN").length;

  const canManage = user?.role === "OWNER" || user?.role === "ADMIN";

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your team and their access levels</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 transition text-sm font-semibold shadow-sm"
          >
            <Plus size={16} />
            Add Member
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: total, icon: Users, color: "text-indigo-600 bg-indigo-50" },
          { label: "Active", value: active, icon: UserCheck, color: "text-green-600 bg-green-50" },
          { label: "Inactive", value: inactive, icon: UserX, color: "text-red-500 bg-red-50" },
          { label: "Admins", value: admins, icon: Shield, color: "text-amber-600 bg-amber-50" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border p-10 text-center text-slate-400 animate-pulse">Loading team...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3.5">Member</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Staff ID</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Email</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Status</th>
                  {canManage && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50/60 transition-colors ${!u.isActive ? "opacity-50" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} />
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                          <p className="text-xs text-slate-500 md:hidden">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {u.staffId || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-sm text-slate-600">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_BADGE[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {u.isActive ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          Disabled
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-5 py-4 text-right">
                        {user?.role === "OWNER" && u.isActive && u.role !== "OWNER" && (
                          <button
                            onClick={() => setConfirmDisable(u)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50"
                            title="Disable member"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No team members yet. Add your first one!</p>
            </div>
          )}
        </div>
      )}

      {/* Add Member Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl"
            >
              <h2 className="text-lg font-bold text-slate-900 mb-5">Add Team Member</h2>
              <div className="space-y-3">
                <input type="text" placeholder="Full Name"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input type="text" placeholder="Staff ID (e.g. AGENT001)"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })} />
                <input type="email" placeholder="Email Address"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input type="password" placeholder="Assign Password"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <select className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as any })}>
                  <option value="AGENT">Agent — manage leads & orders</option>
                  <option value="ADMIN">Admin — full access except billing</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={handleCreateUser}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition shadow-sm">
                  Create Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Disable Modal */}
      <AnimatePresence>
        {confirmDisable && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4 mx-auto">
                <UserX className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-base font-bold text-slate-900 text-center">Disable Member?</h2>
              <p className="text-sm text-slate-500 text-center mt-1 mb-5">
                <strong>{confirmDisable.name}</strong> will lose access immediately.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDisable(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button onClick={() => handleDisable(confirmDisable)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition">
                  Disable
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
