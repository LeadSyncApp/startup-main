import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import NotificationBell from "./NotificationBell";
import { Menu, Search } from "lucide-react";
import { useSocket } from "../../context/SocketContext"; // Import Socket
import toast from "react-hot-toast"; // Import Toast

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { socket } = useSocket();

  // Handle search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // You can implement search logic here
    console.log("🔍 Searching for:", query);
    // TODO: Implement actual search functionality
  };

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

    socket.on("notification_new", onNotification);
    return () => {
      socket.off("notification_new", onNotification);
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] flex relative">

      {/* Background Glow */}
      <div className="absolute top-[-200px] right-[-200px] w-[500px] h-[500px] bg-cyan-500/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-200px] left-[-200px] w-[500px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full" />

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

        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md relative">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white"
          >
            <Menu size={26} />
          </button>
          <h1 className="text-white font-semibold">LeadSync</h1>
          <NotificationBell />
        </div>

        {/* Desktop Header */}
        <div className="hidden lg:flex items-center justify-between px-10 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md relative">
          <h1 className="text-white font-semibold text-lg">LeadSync</h1>
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors h-4 w-4" />
              <input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Q Search..."
                className="w-64 bg-white/10 border border-white/20 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all"
              />
            </div>
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
