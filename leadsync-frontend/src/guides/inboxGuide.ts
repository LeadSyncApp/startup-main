import type { PageGuide } from './types';
import {
  Search,
  List,
  MessageSquare,
  UserPlus,
  PanelRightOpen,
} from 'lucide-react';

export const inboxGuide: PageGuide = {
  pageId: 'inbox',
  pageTitle: 'My Chats',
  sections: [
    {
      id: 'search-input',
      title: 'Search Conversations',
      description: 'Type a customer name or phone number to find a specific conversation quickly. The list updates as you type.',
      whyItMatters: 'Quickly find returning customers without scrolling through your entire chat history.',
      icon: Search,
    },
    {
      id: 'filter-tabs',
      title: 'Chats vs Completed Tabs',
      description: 'Switch between active open conversations (Chats) and conversations you have already resolved (Completed).',
      whyItMatters: 'Keep your workspace clean by moving resolved conversations to Completed while keeping active chats front and centre.',
      icon: List,
    },
    {
      id: 'conversation-row',
      title: 'Conversation Queue',
      description: 'Each row shows the customer name, last message preview, time elapsed, messaging channel badge (Telegram, WhatsApp, Web), and status badge.',
      whyItMatters: 'See unread counts and message previews at a glance so you know who needs a reply first.',
      icon: MessageSquare,
    },
    {
      id: 'claim-chat',
      title: 'Claim Conversation',
      description: 'Tap the Claim button on any unassigned conversation to take personal ownership of it. Once claimed, it is assigned to you.',
      whyItMatters: 'Prevents multiple staff members from replying to the same customer at once.',
      icon: UserPlus,
    },
    {
      id: 'chat-detail-panel',
      title: 'Chat Workspace & Controls',
      description: 'Selecting a conversation opens the full message history on the right, where you can send replies, attach products, share payment links, or switch between AI and manual mode.',
      whyItMatters: 'Everything you need to talk to the customer, process orders, and collect payments is right in one place.',
      icon: PanelRightOpen,
    },
  ],
};

