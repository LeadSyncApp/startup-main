import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import toast from "react-hot-toast";

interface RoleDefinition {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  _count?: { users: number };
}

const AVAILABLE_PERMISSIONS = [
  { id: "chats.view", label: "View Chats", desc: "Can read customer conversations" },
  { id: "chats.reply", label: "Reply to Chats", desc: "Can send messages to customers" },
  { id: "orders.manage", label: "Manage Orders", desc: "Can approve or reject pending orders" },
  { id: "integrations.edit", label: "Edit Integrations", desc: "Configure Telegram/Instagram connections" },
  { id: "team.manage", label: "Manage Team", desc: "Add or remove staff members" },
  { id: "analytics.view", label: "View Analytics", desc: "Access the reporting dashboard" },
  { id: "rbac.manage", label: "Manage Permissions", desc: "Create and assign roles (CAUTION)" },
];

export function RBACSection() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const data = await api.get("/rbac");
      setRoles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePerm = (permId: string) => {
    setSelectedPerms(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return toast.error("Role name is required");
    setIsCreating(true);
    try {
      await api.post("/rbac", {
        name: newRoleName,
        description: newRoleDesc,
        permissions: selectedPerms
      });
      toast.success("Custom role created!");
      setShowCreateModal(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setSelectedPerms([]);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create role");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return <div className="text-sm p-4 text-slate-500">Loading roles...</div>;

  return (
    <div className="bg-app-surface p-6 rounded-2xl shadow border border-[var(--app-border)] space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>🛡️</span> Permission Sets (RBAC)
          </h2>
          <p className="text-sm text-slate-500">
            Define custom roles with granular permissions, rather than relying on legacy static roles (Admin/Agent).
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl hover:bg-slate-800 transition text-sm"
        >
          + New Custom Role
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
        {roles.map(role => (
          <div key={role.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <div className="flex justify-between items-start border-b border-slate-200 pb-2">
              <div>
                <h3 className="font-bold text-slate-800">{role.name}</h3>
                <p className="text-[11px] text-slate-500">{role.description || "No description provided."}</p>
              </div>
              <span className="bg-white border text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {role._count?.users || 0} users
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Permissions ({(role.permissions || []).length})</p>
              <div className="flex flex-wrap gap-1">
                {(role.permissions || []).map(p => (
                  <span key={p} className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter">
                    {p.replace(".", " ")}
                  </span>
                ))}
                {(role.permissions || []).length === 0 && <span className="text-[10px] text-slate-400 italic">No permissions explicitly defined</span>}
              </div>
            </div>
          </div>
        ))}
        {roles.length === 0 && (
          <div className="col-span-full border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 text-sm">
            No custom permission sets created yet.
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-6 shadow-xl">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Create Permission Set</h3>
              <p className="text-sm text-slate-500">Configure exact access rights for a specific group of staff.</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role Name</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Chat Support Agent"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    placeholder="Brief description of this role"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Granular Permissions</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                  {AVAILABLE_PERMISSIONS.map(p => (
                    <label key={p.id} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition ${selectedPerms.includes(p.id) ? "bg-blue-50/50 border-blue-200" : "border-slate-200"}`}>
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(p.id)}
                        onChange={() => handleTogglePerm(p.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-700">{p.label}</div>
                        <div className="text-[11px] text-slate-500">{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                disabled={isCreating}
                className="bg-slate-900 text-white font-bold px-6 py-2 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {isCreating ? "Saving..." : "Create Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
