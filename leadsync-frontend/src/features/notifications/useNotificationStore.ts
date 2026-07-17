import { create } from "zustand";
import { api } from "../../lib/api";

export interface NotificationItem {
  id: string;
  userId: string;
  companyId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isOpen: boolean;

  /** Fetch notifications from backend (initial load) */
  fetch: () => Promise<void>;
  /** Add a single notification from a socket event */
  addOne: (notification: NotificationItem) => void;
  /** Mark a single notification as read */
  markAsRead: (id: string) => Promise<void>;
  /** Mark all as read */
  markAllAsRead: () => Promise<void>;
  /** Toggle panel open/closed */
  togglePanel: () => void;
  /** Close panel */
  closePanel: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  isOpen: false,

  fetch: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get("/notifications");
      set({
        items: data.items || [],
        unreadCount: data.unreadCount || 0,
        isLoading: false,
      });
    } catch (err) {
      console.error("[NotificationStore] Failed to fetch:", err);
      set({ isLoading: false });
    }
  },

  addOne: (notification) => {
    set((state) => ({
      items: [notification, ...state.items],
      unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
    }));
  },

  markAsRead: async (id) => {
    // Optimistic update
    set((state) => ({
      items: state.items.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.error("[NotificationStore] Failed to mark as read:", err);
      // Revert on failure
      set((state) => ({
        items: state.items.map((n) =>
          n.id === id ? { ...n, isRead: false } : n
        ),
        unreadCount: state.unreadCount + 1,
      }));
    }
  },

  markAllAsRead: async () => {
    const prevUnread = get().unreadCount;

    // Optimistic update
    set((state) => ({
      items: state.items.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    try {
      await api.patch("/notifications/read-all");
    } catch (err) {
      console.error("[NotificationStore] Failed to mark all as read:", err);
      // Revert on failure
      get().fetch();
      set({ unreadCount: prevUnread });
    }
  },

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  closePanel: () => set({ isOpen: false }),
}));