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
  createdAt: string;
}

export default function UserManagement() {
  const { user } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "AGENT",
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
    try {
      const res = await api.post("/users", form);

      setGeneratedPassword(res.tempPassword);
      setShowPasswordModal(true);

      setShowModal(false);
      setForm({ name: "", email: "", role: "AGENT" });

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
    } catch {
      toast.error("Failed to disable user");
    }
  }

  function copyPassword() {
    navigator.clipboard.writeText(generatedPassword);
    toast.success("Password copied");
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Team Management</h1>

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
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    {u.isActive ? (
                      <span className="text-green-600 text-sm">Active</span>
                    ) : (
                      <span className="text-red-500 text-sm">Disabled</span>
                    )}
                  </td>
                  <td>
                    {user?.role === "OWNER" && u.isActive && (
                      <button
                        onClick={() => handleDisable(u.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={18} />
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
              placeholder="Name"
              className="w-full border p-2 rounded"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <input
              type="email"
              placeholder="Email"
              className="w-full border p-2 rounded"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <select
              className="w-full border p-2 rounded"
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value })
              }
            >
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Admin</option>
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

      {/* Temporary Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl w-96 space-y-4 text-center">
            <Check className="mx-auto text-green-500" size={40} />
            <h2 className="text-lg font-semibold">Account Created</h2>
            <p className="text-sm text-slate-500">
              Share this temporary password with the staff member:
            </p>

            <div className="bg-slate-100 p-3 rounded-lg font-mono text-sm flex justify-between items-center">
              {generatedPassword}
              <button onClick={copyPassword}>
                <Copy size={16} />
              </button>
            </div>

            <button
              onClick={() => setShowPasswordModal(false)}
              className="w-full bg-slate-900 text-white py-2 rounded-xl"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
