import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  platform: 'whatsapp' | 'instagram' | 'web';
}

export interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  timestamp: string;
  platform: 'whatsapp' | 'instagram' | 'web';
  status: 'unassigned' | 'assigned' | 'closed';
  staffId: string | null;
  staffName?: string;
  aiIntent?: 'Sales' | 'Support' | 'Spam';
  aiSummary?: string;
  messages: Message[];
  priorityScore: number;
}

export interface Order {
  id: string;
  customerName: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'APPROVED' | 'SHIPPED' | 'CANCELLED';
  priorityScore: number;
  items: string[];
  timestamp: string;
}

interface SimulationState {
  conversations: Conversation[];
  orders: Order[];
  activities: { id: string; user: string; action: string; target: string; time: string }[];
  
  // Actions
  addConversation: (conv: Conversation) => void;
  assignConversation: (convId: string, staffId: string, staffName: string) => void;
  addOrder: (order: Order) => void;
  approveOrder: (orderId: string, staffName: string) => void;
  logActivity: (user: string, action: string, target: string) => void;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set) => ({
      conversations: [
        {
          id: '1',
          customerName: 'Riya Sharma',
          customerPhone: '+91 98765 43210',
          lastMessage: 'I want to order 3 silk sarees.',
          timestamp: new Date().toISOString(),
          platform: 'whatsapp',
          status: 'unassigned',
          staffId: null,
          aiIntent: 'Sales',
          aiSummary: 'Customer wants to purchase 3 silk sarees.',
          messages: [{ id: 'm1', sender: 'Riya Sharma', content: 'I want to order 3 silk sarees.', timestamp: new Date().toISOString(), platform: 'whatsapp' }],
          priorityScore: 85
        },
        {
          id: '2',
          customerName: 'Vikram Singh',
          customerPhone: '+91 91234 56789',
          lastMessage: 'Is my order shipped?',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          platform: 'instagram',
          status: 'unassigned',
          staffId: null,
          aiIntent: 'Support',
          aiSummary: 'Customer inquiring about shipping status.',
          messages: [{ id: 'm2', sender: 'Vikram Singh', content: 'Is my order shipped?', timestamp: new Date(Date.now() - 3600000).toISOString(), platform: 'instagram' }],
          priorityScore: 45
        }
      ],
      orders: [
        {
          id: 'ord1',
          customerName: 'Riya Sharma',
          amount: 1000,
          status: 'PENDING',
          priorityScore: 88,
          items: ['Banarasi Silk', 'Kanchipuram Silk', 'Chanderi Silk'],
          timestamp: new Date().toISOString()
        }
      ],
      activities: [],

      addConversation: (conv) => set((state) => ({ 
        conversations: [conv, ...state.conversations] 
      })),

      assignConversation: (convId, staffId, staffName) => set((state) => ({
        conversations: state.conversations.map(c => 
          c.id === convId ? { ...c, status: 'assigned', staffId, staffName } : c
        )
      })),

      addOrder: (order) => set((state) => ({ 
        orders: [order, ...state.orders] 
      })),

      approveOrder: (orderId, _staffName) => set((state) => ({
        orders: state.orders.map(o => 
          o.id === orderId ? { ...o, status: 'APPROVED' } : o
        )
      })),

      logActivity: (user, action, target) => set((state) => ({
        activities: [{ 
          id: Math.random().toString(36).substr(2, 9), 
          user, 
          action, 
          target, 
          time: new Date().toISOString() 
        }, ...state.activities]
      }))
    }),
    {
      name: 'leadsync-simulation-storage',
    }
  )
);
