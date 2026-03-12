import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, ShoppingCart, MessageSquare, AlertTriangle, Info, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../lib/api";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "ORDER" | "MESSAGE" | "ALERT" | "SYSTEM";
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  ORDER: <ShoppingCart className="w-4 h-4 text-indigo-500" />,
  MESSAGE: <MessageSquare className="w-4 h-4 text-green-500" />,
  ALERT: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  SYSTEM: <Info className="w-4 h-4 text-slate-400" />,
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch on open or token change
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      console.log("🔔 Fetching notifications...");
      const data = await api.get("/notifications?page=1");
      console.log("🔔 Notifications received:", data);
      setNotifications(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (error) {
      console.error("🔔 Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch count on mount (just for badge)
  useEffect(() => {
    if (!token) return;
    api.get("/notifications?page=1").then((data) => {
      console.log("🔔 Initial notifications loaded:", data);
      setUnreadCount(data.unreadCount ?? 0);
      setNotifications(data.items ?? []);
    }).catch((error) => {
      console.error("🔔 Failed to load initial notifications:", error);
    });
  }, [token]);

  // Calculate dropdown position
  const getDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      return {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      };
    }
    return { top: 60, right: 20 };
  };

  // Re-fetch when panel opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  // Real-time: push new notifications to top
  useEffect(() => {
    if (!socket) return;
    const handler = (n: Notification) => {
      console.log("🔔 Real-time notification received:", n);
      setNotifications((prev) => [n, ...prev.slice(0, 19)]);
      setUnreadCount((c) => c + 1);
    };
    socket.on("notification_new", handler);
    return () => { socket.off("notification_new", handler); };
  }, [socket]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await api.patch("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
    finally { setMarkingAll(false); }
  };

  return (
    <div className="relative z-50" ref={panelRef}>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Portal */}
      {open && createPortal(
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="fixed w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          style={{
            top: `${getDropdownPosition().top}px`,
            right: `${getDropdownPosition().right}px`,
            zIndex: 2147483647
          }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={markingAll}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  {markingAll ? "Marking..." : "Mark all read"}
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {loading && (
                <div className="py-8 text-center text-slate-400 text-sm animate-pulse">Loading...</div>
              )}
              {!loading && notifications.length === 0 && (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">All caught up!</p>
                </div>
              )}
              {!loading && notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markAsRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    n.isRead ? "bg-white" : "bg-indigo-50/50 hover:bg-indigo-50"
                  }`}
                >
                  {/* Type icon */}
                  <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                    {TYPE_ICON[n.type] ?? TYPE_ICON.SYSTEM}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {/* Unread dot */}
                  {!n.isRead && (
                    <div className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-[10px] text-center text-slate-400">Showing last {notifications.length} notifications</p>
              </div>
            )}
        </motion.div>,
        document.body
      )}
    </div>
  );
}
