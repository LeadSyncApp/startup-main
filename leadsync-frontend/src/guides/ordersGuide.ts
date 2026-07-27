import type { PageGuide } from './types';
import {
  LayoutGrid,
  Search,
  ShoppingBag,
  CheckCircle,
  Truck,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const ordersGuide: PageGuide = {
  pageId: 'orders',
  pageTitle: 'Orders',
  sections: [
    {
      id: 'tab-bar',
      title: 'Order Tabs',
      description: 'Three tabs organise orders by their stage. "Ready for Packing" shows paid orders waiting to be packed and shipped. "Shipped/Out" shows orders already on their way to the customer. "Wait for Payment" shows orders where the customer has not paid yet.',
      whyItMatters: 'Work through each tab in order — pack first, ship next, and follow up on unpaid orders last.',
      icon: LayoutGrid,
    },
    {
      id: 'order-search',
      title: 'Search Orders',
      description: 'Type a customer name or Order ID to find a specific order. The grid filters as you type.',
      whyItMatters: 'Quickly locate an order when a customer calls to ask about their delivery status.',
      icon: Search,
    },
    {
      id: 'order-card',
      title: 'Order Card',
      description: 'Each card shows the order ID, customer name, phone number, total amount, and a short summary of what was ordered. The status badge in the top-right shows the current state: green for paid/confirmed, amber for pending, blue for shipped.',
      whyItMatters: 'Scan the card to see at a glance what the customer ordered, how much they paid, and where it is in the process.',
      icon: ShoppingBag,
    },
    {
      id: 'priority-badge',
      title: 'Priority Badge',
      description: 'Orders are marked as either URGENT (red) or STANDARD (slate). Urgent orders are flagged based on order value, customer history, or time sensitivity.',
      whyItMatters: 'Handle urgent orders first — these are your highest-priority customers.',
      icon: CheckCircle,
    },
    {
      id: 'status-action-button',
      title: 'Status Action Button',
      description: 'This button moves the order to the next stage. For unpaid orders it shows "Waiting for Payment" (grey, not clickable). For paid/ready orders it shows "Mark as Shipped". For shipped orders it shows "Mark as Delivered". Each tap sends an automatic notification to the customer.',
      whyItMatters: 'Tap the button when you have physically packed or shipped the order — the customer gets notified instantly without you sending a manual message.',
      icon: ArrowRight,
    },
    {
      id: 'view-chat-link',
      title: 'View Chat Link',
      description: 'Tapping this link opens the conversation with this customer in your inbox. Useful if you need to ask them a question about their order or send them an update.',
      whyItMatters: 'Jump straight to the customer chat without leaving the Orders page to search for them manually.',
      icon: ExternalLink,
    },
    {
      id: 'order-refresh',
      title: 'Refresh Orders',
      description: 'Tap the spinning arrow icon to reload the order list from the server. Use this after marking an order as shipped to see the updated status.',
      whyItMatters: 'The order list does not auto-refresh — tap this after every status change to stay up to date.',
      icon: Truck,
    },
    {
      id: 'order-empty-state',
      title: 'Empty State',
      description: 'When a tab has no orders, you will see a message like "No orders found here". This means there are no orders at that stage right now.',
      whyItMatters: 'If you just marked all orders as shipped, check the Shipped tab — they moved there.',
      icon: Clock,
    },
  ],
};
