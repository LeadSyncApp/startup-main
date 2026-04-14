import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import GlobalSearch from '../ui/GlobalSearch';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { socket } = useSocket();
  const { user } = useAuth();

  // Global Notification Listener
  useEffect(() => {
    if (!socket) return;

    const onNotification = (data: { title: string; body: string; type: string }) => {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});

      toast.custom(
        (t) => (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full bg-background-secondary border border-border rounded-xl shadow-card-elevated pointer-events-auto flex items-center p-4"
          >
            <div className="flex-shrink-0">
              <span className="text-2xl">{data.type === 'ORDER' ? '🍔' : '💬'}</span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-semibold text-text-primary">{data.title}</p>
              <p className="mt-1 text-xs text-text-secondary">{data.body}</p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="p-2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ),
        { duration: 5000 }
      );
    };

    const onAutomationAlert = (data: { type: string; orderId: string; message: string }) => {
      toast.custom(
        (t) => (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full bg-warning/10 border border-warning/30 rounded-xl shadow-card-elevated pointer-events-auto flex items-center p-4"
          >
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-semibold text-warning">Automation Alert</p>
              <p className="mt-1 text-xs text-text-secondary">{data.message}</p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="p-2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ),
        { duration: 8000 }
      );
    };

    socket.on('notification_new', onNotification);
    socket.on('automation_alert', onAutomationAlert);
    return () => {
      socket.off('notification_new', onNotification);
      socket.off('automation_alert', onAutomationAlert);
    };
  }, [socket]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-background-primary flex relative overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 transform
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          transition-transform duration-300 ease-smooth
          lg:translate-x-0 lg:static
        `}
      >
        <Sidebar closeSidebar={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        {/* Desktop Top Bar */}
        <div className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border bg-background-secondary/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <p className="text-sm text-text-secondary">
              Welcome back, <span className="font-semibold text-text-primary">{user?.name}</span>
            </p>
            <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
              {user?.role}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        {/* Mobile Top Bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background-secondary/80 backdrop-blur-md">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-text-primary p-2 hover:bg-background-tertiary rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <NotificationBell />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-background-secondary/50 backdrop-blur py-4 px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-text-muted">
            <p>LeadSync CRM © {new Date().getFullYear()}</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-accent hover:text-accent-hover transition-colors">
                Privacy
              </a>
              <a href="#" className="text-accent hover:text-accent-hover transition-colors">
                Terms
              </a>
              <a href="#" className="text-accent hover:text-accent-hover transition-colors">
                Support
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
