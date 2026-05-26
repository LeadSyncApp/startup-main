import { useState, useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "../ui/GlobalSearch";
import { Menu, LayoutDashboard, Users, MessageSquare, ShoppingCart } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  // 🔔 Global Notification Listener
  useEffect(() => {
    if (!socket) return;

    const onNotification = (data: { title: string, body: string, type: string }) => {
      // Play sound?
      const audio = new Audio('/notification.mp3'); // Assuming file exists or fails silently
      audio.play().catch(() => { });

      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <span className="text-2xl">{data.type === 'ORDER' ? '🍔' : '💬'}</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">{data.title}</p>
                <p className="mt-1 text-sm text-gray-500">{data.body}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      ), { duration: 5000 });
    };

    const onAutomationAlert = (data: { type: string; orderId: string; message: string }) => {
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">Automation Alert</p>
                <p className="mt-1 text-sm text-gray-500">{data.message}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
            >
              Close
            </button>
          </div>
        </div>
      ), { duration: 8000 });
    };

    socket.on("notification_new", onNotification);
    socket.on("automation_alert", onAutomationAlert);
    return () => {
      socket.off("notification_new", onNotification);
      socket.off("automation_alert", onAutomationAlert);
    };
  }, [socket]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex relative overflow-hidden">

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 transform
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static
        `}
      >
        <Sidebar closeSidebar={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 min-h-screen">

        {/* Desktop Top Bar */}
        <div className="hidden lg:flex sticky top-0 z-30 items-center justify-between px-10 py-3 border-b border-slate-100 bg-white/80 backdrop-blur shadow-sm">
          <p className="text-sm text-slate-500">
            Welcome back, <span className="font-semibold text-slate-800">{user?.name}</span>
          </p>
          <div className="flex items-center gap-4">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        {/* Mobile Top Bar */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/80 backdrop-blur shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-700 hover:bg-slate-50 p-1 rounded-lg"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        <main className="flex-1 pb-20 lg:pb-0">
          <div className="px-6 lg:px-10 py-8 lg:py-10">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-100 bg-white/80 backdrop-blur py-6 pb-28 lg:pb-6">
          <div className="px-6 lg:px-10 text-center text-sm text-slate-500">
            LeadSync CRM © 2025 •{" "}
            <a href="#" className="text-indigo-600 hover:text-indigo-500">
              Privacy
            </a>{" "}
            •{" "}
            <a href="#" className="text-indigo-600 hover:text-indigo-500">
              Terms
            </a>
          </div>
        </footer>

        {/* Global Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 py-3 pb-4 px-6 flex justify-around items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] select-none">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Home</span>
          </NavLink>
          <NavLink
            to="/dashboard/leads"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            <Users className="w-5 h-5" />
            <span>Leads</span>
          </NavLink>
          <NavLink
            to="/dashboard/conversations"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chat</span>
          </NavLink>
          <NavLink
            to="/dashboard/orders"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition ${
                isActive ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            <ShoppingCart className="w-5 h-5" />
            <span>Orders</span>
          </NavLink>
        </nav>

      </div>
    </div>
  );
}
