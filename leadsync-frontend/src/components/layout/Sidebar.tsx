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
      label: "Products",
      icon: ShoppingCart,
      path: "/dashboard/products",
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
    <aside className="h-full w-full bg-[var(--app-surface)] border-r border-[var(--app-border)] shadow-sm flex flex-col text-[var(--app-text)]">

      {/* Logo Section */}
      <div className="px-6 py-5 border-b border-[var(--app-border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/favicon.svg" alt="LeadSync Logo" className="w-8 h-8 rounded-lg shrink-0 object-contain" />
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 space-y-1">
          {navItems
            .filter(item => item.show)
            .map(({ label, icon: Icon, path }) => (
              <NavLink
                key={label}
                to={path}
                end={path === "/dashboard"}
                onClick={closeSidebar}
                className={({ isActive }) =>
                  `flex items-center gap-3 pl-5 pr-6 py-3 text-sm font-medium transition-all duration-150 ${isActive
                    ? "bg-app-primary-soft text-app-primary border-l-4 border-[var(--app-primary)]"
                    : "text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-bg-soft)] border-l-4 border-transparent"
                  }`
                }
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </NavLink>
            ))}
        </nav>

        {/* User Section - Tucked closely underneath the navigation */}
        <div className="pt-4 border-t border-[var(--app-border)] shrink-0 bg-[var(--app-surface)]">
          <div className="flex items-center gap-3 px-6 py-1.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-app-primary-soft flex items-center justify-center text-app-primary font-bold text-xs shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--app-text)] truncate">{user?.name}</p>
              <p className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-wider font-medium">{user?.role}</p>
            </div>
          </div>
          <div className="mb-3 px-6">
            <ThemeToggle className="w-full justify-center" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-[var(--app-text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
