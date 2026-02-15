import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Menu } from "lucide-react";

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-white"
          >
            <Menu size={26} />
          </button>
          <h1 className="text-white font-semibold">LeadSync</h1>
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
