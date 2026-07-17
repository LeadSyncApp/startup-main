import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, X } from "lucide-react";
import { useNotificationStore, NotificationItem } from "./useNotificationStore";
import { timeAgo } from "../../lib/timeAgo";

/**
 * A bell icon with a red unread badge. Clicking it toggles a dropdown
 * panel showing the notification list.
 */
export const NotificationBell: React.FC = () => {
  const { unreadCount, isOpen, togglePanel, closePanel } = useNotificationStore();
  const bellRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);

  const computePosition = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const PANEL_WIDTH = 384; // w-96 = 24rem = 384px
    const PANEL_HEIGHT = 420; // approximate max height
    const MARGIN = 8;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Open upward if not enough space below and more space above
    const openUpward = spaceBelow < PANEL_HEIGHT && spaceAbove > spaceBelow;

    // Horizontal: anchor left edge to right of bell, clamp so right edge stays in viewport
    const desiredLeft = rect.right + MARGIN;
    const maxLeft = window.innerWidth - PANEL_WIDTH - MARGIN;
    const left = Math.max(MARGIN, Math.min(desiredLeft, maxLeft));

    // Vertical: clamp so panel stays within viewport
    let top: number;
    if (openUpward) {
      top = Math.max(MARGIN, rect.top - PANEL_HEIGHT);
    } else {
      top = Math.min(window.innerHeight - PANEL_HEIGHT - MARGIN, rect.bottom);
    }

    setPosition({ top, left, openUpward });
  };

  useEffect(() => {
    if (isOpen) {
      computePosition();
      const handleReposition = () => computePosition();
      window.addEventListener("resize", handleReposition);
      window.addEventListener("scroll", handleReposition, true);
      return () => {
        window.removeEventListener("resize", handleReposition);
        window.removeEventListener("scroll", handleReposition, true);
      };
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={togglePanel}
        className="relative p-2 rounded-lg hover:bg-app-bg-soft text-app-text-muted transition-all cursor-pointer"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-brand-saffron text-white text-2xs font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && position && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={closePanel}
          />
          {/* Dropdown panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: position.openUpward ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
            }}
            className="w-80 sm:w-96 bg-app-surface border border-app-border rounded-xl shadow-2xl z-50 max-h-[70vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-app-border shrink-0">
              <h3 className="text-sm font-bold text-app-text">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => useNotificationStore.getState().markAllAsRead()}
                    className="flex items-center gap-1 text-xs text-app-text-muted hover:text-brand-saffron transition-all cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={closePanel}
                  className="p-1 hover:bg-app-bg-soft rounded-lg text-app-text-muted cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              <NotificationList />
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};

/** The scrollable list of notification items */
const NotificationList: React.FC = () => {
  const { items, isLoading, markAsRead } = useNotificationStore();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-app-text-muted">
        Loading notifications...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <Bell className="h-8 w-8 mx-auto mb-2 text-app-text-muted opacity-40" />
        <p className="text-sm text-app-text-muted">No notifications yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-app-border">
      {items.map((notification) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          onClick={() => {
            if (!notification.isRead) {
              markAsRead(notification.id);
            }
          }}
        />
      ))}
    </div>
  );
};

/** A single notification row */
const NotificationRow: React.FC<{
  notification: NotificationItem;
  onClick: () => void;
}> = ({ notification, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-app-bg-soft transition-all cursor-pointer ${
        !notification.isRead ? "bg-brand-saffron-soft/30" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Unread dot */}
        {!notification.isRead && (
          <span className="mt-1.5 h-2 w-2 rounded-full bg-brand-saffron shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${!notification.isRead ? "font-semibold text-app-text" : "font-medium text-app-text"}`}>
            {notification.title}
          </p>
          <p className="text-xs text-app-text-muted mt-0.5 line-clamp-2">
            {notification.body}
          </p>
          <p className="text-2xs text-app-text-muted/60 mt-1">
            {timeAgo(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
};