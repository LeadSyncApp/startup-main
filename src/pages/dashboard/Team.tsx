import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT";
  isActive: boolean;
  createdAt: string;
}

export default function Team() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
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
      await api.post("/users", form);
      toast.success("User created");
      setShowModal(false);
      setForm({ name: "", email: "", password: "", role: "AGENT" });
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Team Management</h1>

        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:opacity-90"
          >
            <Plus size={18} />
            Add Staff
          </button>
        )}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white shadow rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-100 text-sm text-gray-600">
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
                  <td className="p-4">{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    {u.isActive ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-red-500">Disabled</span>
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

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-96 space-y-4">
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

            <input
              type="password"
              placeholder="Password"
              className="w-full border p-2 rounded"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
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
                className="bg-black text-white px-4 py-2 rounded"
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
