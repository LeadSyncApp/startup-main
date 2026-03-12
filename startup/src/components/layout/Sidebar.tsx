import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  ShoppingCart,
  Settings,
  LogOut,
  Shield,
  Megaphone,
  BarChart3,
  FileText,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface SidebarProps {
  closeSidebar?: () => void;
}

export default function Sidebar({ closeSidebar }: SidebarProps) {
  const { logout, user, isOwner, isAdmin, isAgent } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/dashboard",
      show: true,
    },
    {
      label: "Leads",
      icon: Users,
      path: "/dashboard/leads",
      show: isOwner || isAdmin || isAgent,
    },
    {
      label: "Conversations",
      icon: MessageSquare,
      path: "/dashboard/conversations",
      show: true,
    },
    {
      label: "Orders",
      icon: ShoppingCart,
      path: "/dashboard/orders",
      show: isOwner || isAdmin || isAgent,
    },
    {
      label: "Revenue",
      icon: BarChart3,
      path: "/dashboard/revenue",
      show: isOwner || isAdmin,
    },
    {
      label: "Reports",
      icon: FileText,
      path: "/dashboard/reports",
      show: isOwner || isAdmin,
    },
    {
      label: "Broadcasts",
      icon: Megaphone,
      path: "/dashboard/broadcasts",
      show: isOwner || isAdmin,
    },
    {
      label: "Team",
      icon: Shield,
      path: "/dashboard/users",
      show: isOwner || isAdmin,
    },
    {
      label: "Settings",
      icon: Settings,
      path: "/dashboard/settings",
      show: isOwner || isAdmin,
    },
  ];

  return (
    <aside className="h-full w-64 bg-white border-r border-slate-200 shadow-lg flex flex-col">

      {/* Logo Section */}
      <div className="px-6 py-6 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              LeadSync
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
              CRM Platform
            </p>
          </div>
        </div>
        {/* Mobile close button */}
        {closeSidebar && (
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems
          .filter(item => item.show)
          .map(({ label, icon: Icon, path }) => (
            <NavLink
              key={label}
              to={path}
              end={path === "/dashboard"}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </NavLink>
          ))}
      </nav>

      {/* User Section */}
      <div className="px-3 py-4 border-t border-slate-200">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
