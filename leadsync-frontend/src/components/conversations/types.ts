export interface Conversation {
  id: string;
  mode: 'BOT' | 'HUMAN';
  lead: {
    id: string;
    name: string | null;
    contact: string;
    channel: string;
  };
  lastMessage: string;
  intent?: string;
  updatedAt: string;
  assignedTo?: { id: string; name: string } | null;
  unreadCount?: number;
}

export interface Message {
  id: string;
  content: string;
  sender: 'CLIENT' | 'AGENT' | 'SYSTEM';
  createdAt: string;
}
