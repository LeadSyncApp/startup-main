import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ShoppingCart,
  Settings,
  LogOut,
} from "lucide-react";
import { Role, useAuth } from "../../context/AuthContext";

interface SidebarProps {
  userRole: Role;
  closeSidebar?: () => void;
}

export default function Sidebar({ userRole, closeSidebar }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { label: "Leads", icon: Users, path: "/dashboard/leads" },
    { label: "Conversations", icon: MessageSquare, path: "/dashboard/conversations" },
    { label: "Orders", icon: ShoppingCart, path: "/dashboard/orders" },
    { label: "Settings", icon: Settings, path: "/dashboard/settings" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside className="h-full w-64 bg-white border-r border-slate-200 shadow-lg flex flex-col">

      {/* Logo */}
      <div className="px-8 py-8 border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-900">
          LeadSync
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          CRM Platform
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={path}
            end={path === "/dashboard"}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-6 border-t border-slate-200 space-y-4">
        <div>
          <div className="text-xs text-slate-500">
            Logged in as
          </div>
          <div className="text-sm font-medium text-slate-900 mt-1">
            {userRole}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
