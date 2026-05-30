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
  Activity,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";

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
      label: "Conversations",
      icon: MessageSquare,
      path: "/dashboard/conversations",
      show: true,
    },
    {
      label: "Agent Inbox",
      icon: MessageSquare,
      path: "/dashboard/inbox",
      show: true,
    },
    {
      label: "Owner Assignment",
      icon: Activity,
      path: "/dashboard/owner-dashboard",
      show: isOwner || isAdmin,
    },
    {
      label: "Leads",
      icon: Users,
      path: "/dashboard/leads",
      show: isOwner || isAdmin || isAgent,
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
    <aside className="h-full w-full bg-[var(--app-surface)] border-r border-[var(--app-border)] shadow-sm flex flex-col text-[var(--app-text)] overflow-y-auto scrollbar-thin">

      {/* Logo Section */}
      <div className="px-6 py-5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--app-text)] leading-tight">
              LeadSync
            </h1>
            <p className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-widest font-medium">
              CRM Platform
            </p>
          </div>
        </div>
        {/* Toggle / Close button for both mobile and desktop */}
        {closeSidebar && (
          <button
            onClick={closeSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--app-bg-soft)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors cursor-pointer"
            title="Close Sidebar"
          >
            <X className="w-5 h-4.5" />
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-between py-4">
        {/* Navigation */}
        <nav className="px-3 space-y-1">
          {navItems
            .filter(item => item.show)
            .map(({ label, icon: Icon, path }) => (
              <NavLink
                key={label}
                to={path}
                end={path === "/dashboard"}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${isActive
                    ? "bg-cyan-50/70 text-cyan-700 border border-cyan-100/70"
                    : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-soft)]"
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </NavLink>
            ))}
        </nav>

        {/* User Section - Tucked closely underneath the navigation */}
        <div className="mt-6 px-3 pt-4 border-t border-[var(--app-border)]">
          <div className="flex items-center gap-3 px-3 py-1.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-xs shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--app-text)] truncate">{user?.name}</p>
              <p className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium">{user?.role}</p>
            </div>
          </div>
          <div className="mb-3 px-3">
            <ThemeToggle className="w-full justify-center" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[var(--app-text-muted)] hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
