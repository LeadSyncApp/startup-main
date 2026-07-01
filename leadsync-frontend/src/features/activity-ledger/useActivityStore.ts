import { create } from 'zustand';
import { toast as realToast } from 'react-hot-toast';

export type BusinessEventType = 'NEW_LEAD' | 'PAYMENT_SUCCESS' | 'ORDER_PLACED' | 'ABANDONED_CART' | 'ACTION_REQUIRED' | 'CLAIMED' | 'APPROVED';
export type SystemEventType = 'SYNC_ACTIVE' | 'CONNECTION_ERROR' | 'MAINTENANCE_MODE';

export interface SystemEvent {
  id: string;
  timestamp: string; // ISO string
  type: BusinessEventType;
  priority: 'low' | 'medium' | 'high';
  content: string;
  actionLink?: string;
  read?: boolean;
}

export type GatewayStatusType = 'STABLE' | 'SYNCED' | 'DISCONNECTED' | 'ERROR' | 'CONNECTING';

interface ActivityStoreState {
  events: SystemEvent[];
  gatewayStatus: GatewayStatusType;
  addEvent: (event: Partial<Omit<SystemEvent, 'type'>> & { id?: string; timestamp?: string; type: BusinessEventType | SystemEventType }) => void;
  clearEvents: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setGatewayStatus: (status: GatewayStatusType) => void;
  
  // Helpers for direct action feedback - these NO LONGER log to the feed directly to avoid clutter
  success: (content: string) => void;
  error: (content: string) => void;
  warning: (content: string) => void;
  info: (content: string) => void;
}

const generateId = () => `ev_${Math.random().toString(36).substring(2, 9)}`;

export const useActivityStore = create<ActivityStoreState>((set) => ({
  events: [
    {
      id: 'ev_init_3',
      timestamp: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
      type: 'NEW_LEAD',
      priority: 'high',
      content: 'Anita Sharma (+91 91234 56789) opted-in via Telegram Broadcast.',
      read: false,
    },
    {
      id: 'ev_init_4',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
      type: 'PAYMENT_SUCCESS',
      priority: 'high',
      content: 'You just earned ₹4,200 from Order #1092!',
      read: false,
    },
  ],
  
  gatewayStatus: 'STABLE',
  
  addEvent: (eventData) => set((state) => {
    // If it's a system event, we update gatewayStatus but do NOT add to events feed
    if (eventData.type === 'SYNC_ACTIVE') {
      return { gatewayStatus: 'SYNCED' };
    }
    if (eventData.type === 'CONNECTION_ERROR') {
      return { gatewayStatus: 'ERROR' };
    }
    if (eventData.type === 'MAINTENANCE_MODE') {
      return { gatewayStatus: 'CONNECTING' };
    }

    // It's a business event, add it to the feed
    const newEvent: SystemEvent = {
      id: eventData.id || generateId(),
      timestamp: eventData.timestamp || new Date().toISOString(),
      type: eventData.type as BusinessEventType,
      priority: eventData.priority || 'medium',
      content: eventData.content || '',
      actionLink: eventData.actionLink,
      read: false,
    };
    return {
      events: [newEvent, ...state.events],
    };
  }),
  
  clearEvents: () => set({ events: [] }),
  
  markAsRead: (id) => set((state) => ({
    events: state.events.map((e) => e.id === id ? { ...e, read: true } : e)
  })),
  
  markAllAsRead: () => set((state) => ({
    events: state.events.map((e) => ({ ...e, read: true }))
  })),
  
  setGatewayStatus: (status) => set({ gatewayStatus: status }),
  
  // Custom helper implementations that act as silent dispatchers - NO-OP for feeds
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {}
}));

// Export a custom toast-compatible object to replace react-hot-toast imports neatly!
// All programmatic toasts for direct actions are suppressed. Feed is for async business events ONLY.
export const activityToast = realToast;

export const toast = realToast;
export { realToast };
export default realToast;
