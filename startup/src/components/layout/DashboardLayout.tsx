import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "../ui/GlobalSearch";
import { Menu } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex relative overflow-hidden">

      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-100px] right-[-100px] w-[300px] h-[300px] bg-cyan-500/10 blur-[60px] rounded-full" />
        <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-indigo-500/10 blur-[60px] rounded-full" />
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
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
      <div className="flex-1 flex flex-col relative z-10">

        {/* Desktop Top Bar */}
        <div className="hidden lg:flex items-center justify-between px-10 py-3 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <p className="text-sm text-slate-400">
            Welcome back, <span className="font-semibold text-white">{user?.name}</span>
          </p>
          <div className="flex items-center gap-4">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white p-1"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        <main className="flex-1">
          <div className="px-6 lg:px-10 py-8 lg:py-10">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 lg:p-8">
              <Outlet />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-white/5 backdrop-blur-md py-6">
          <div className="px-6 lg:px-10 text-center text-sm text-slate-400">
            LeadSync CRM © 2025 •{" "}
            <a href="#" className="text-cyan-400 hover:text-cyan-300">
              Privacy
            </a>{" "}
            •{" "}
            <a href="#" className="text-cyan-400 hover:text-cyan-300">
              Terms
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}
