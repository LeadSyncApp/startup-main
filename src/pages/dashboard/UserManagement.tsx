import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function UserManagement() {
  useAuth();


  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "AGENT">("AGENT");

  const handleCreate = () => {
    alert(
      `User Created:\nName: ${name}\nEmail: ${email}\nRole: ${role}`
    );

    setName("");
    setEmail("");
    setRole("AGENT");
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">
        User Management (Owner Only)
      </h1>

      <div className="bg-white shadow rounded-xl p-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm mb-1">
            Name
          </label>
          <input
            className="w-full border px-3 py-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">
            Email
          </label>
          <input
            className="w-full border px-3 py-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1">
            Role
          </label>
          <select
            className="w-full border px-3 py-2 rounded"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "ADMIN" | "AGENT")
            }
          >
            <option value="ADMIN">Admin</option>
            <option value="AGENT">Agent</option>
          </select>
        </div>

        <button
          onClick={handleCreate}
          className="bg-slate-900 text-white px-4 py-2 rounded"
        >
          Create User
        </button>
      </div>
    </div>
  );
}
