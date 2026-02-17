import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { Plus, Trash2, Copy, Check } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  isActive: boolean;
  staffId?: string;
  createdAt: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreateUser() {
    if (!form.staffId || !form.password || !form.name || !form.email) {
      toast.error("All fields are required");
      return;
    }

    try {
      await api.post("/users", form);
      toast.success("Account created! 🎉");
      setShowModal(false);
      setForm({ name: "", email: "", staffId: "", password: "", role: "AGENT" });
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create user");
    }
  }

  async function handleDisable(id: string) {
    try {
      await api.delete(`/users/${id}`);
      toast.success("User disabled");
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.message || "Failed to disable user");
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Team Management</h1>
          {user?.staffId && (
            <p className="text-xs text-slate-500">Your ID: <span className="font-mono">{user.staffId}</span></p>
          )}
        </div>

        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl hover:opacity-90"
          >
            <Plus size={18} />
            Add Staff
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="p-4">Name</th>
                <th>Staff ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-4 font-medium">{u.name}</td>
                  <td className="text-sm font-mono text-slate-500">{u.staffId || "N/A"}</td>
                  <td>{u.email}</td>
                  <td className="text-sm">{u.role}</td>
                  <td>
                    {u.isActive ? (
                      <span className="text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-red-500 text-xs bg-red-50 px-2 py-0.5 rounded-full">Disabled</span>
                    )}
                  </td>
                  <td>
                    {user?.role === "OWNER" && u.isActive && u.role !== "OWNER" && (
                      <button
                        onClick={() => handleDisable(u.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                        title="Disable User"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-96 space-y-4">
            <h2 className="text-lg font-semibold">Add Staff</h2>

            <input
              type="text"
              placeholder="Full Name"
              className="w-full border p-2 rounded-lg text-sm"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <input
              type="text"
              placeholder="Staff ID (e.g. AGENT001)"
              className="w-full border p-2 rounded-lg text-sm font-mono"
              value={form.staffId}
              onChange={(e) =>
                setForm({ ...form, staffId: e.target.value })
              }
            />

            <input
              type="email"
              placeholder="Email Address"
              className="w-full border p-2 rounded-lg text-sm"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <input
              type="password"
              placeholder="Assign Password"
              className="w-full border p-2 rounded-lg text-sm"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
            />

            <select
              className="w-full border p-2 rounded-lg text-sm"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as any })
              }
            >
              <option value="AGENT">Role: Agent</option>
              <option value="ADMIN">Role: Admin</option>
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>

              <button
                onClick={handleCreateUser}
                className="bg-slate-900 text-white px-4 py-2 rounded"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
