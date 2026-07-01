export interface DemoScene {
  id: string;
  title: string;
  description: string;
  duration: number; // ms to auto-advance (0 = manual)
  navigateTo?: 'shop' | 'messages' | 'orders';
}

export interface DemoMessage {
  sender: 'customer' | 'staff' | 'ai-bot';
  name: string;
  avatar: string;
  content: string;
  delay: number; // ms after scene start
  isAI?: boolean;
}

export interface DemoOrderCard {
  customerName: string;
  platform: 'whatsapp' | 'instagram' | 'web';
  items: string[];
  amount: number;
  priorityScore: number;
  assignedTo?: { name: string; role: string };
  delay: number;
}

export interface DemoConversation {
  customerName: string;
  platform: 'whatsapp' | 'instagram' | 'web';
  messages: DemoMessage[];
  handledBy: 'staff' | 'ai-bot';
}

export const DEMO_STAFF = [
  { id: 'staff-1', name: 'Rahul', role: 'Manager', avatar: 'R' },
  { id: 'staff-2', name: 'Priya', role: 'Staff', avatar: 'P' },
  { id: 'staff-3', name: 'Amit', role: 'Staff', avatar: 'A' },
];

export const DEMO_ORDERS: DemoOrderCard[] = [
  {
    customerName: 'Riya Sharma',
    platform: 'whatsapp',
    items: ['Banarasi Silk Saree (x2)', 'Kanchipuram Silk (x1)'],
    amount: 12400,
    priorityScore: 92,
    assignedTo: { name: 'Rahul', role: 'Manager' },
    delay: 500,
  },
  {
    customerName: 'Priya Mehta',
    platform: 'instagram',
    items: ['Designer Kurti Set (x2)', 'Cotton Dupatta (x3)'],
    amount: 6800,
    priorityScore: 76,
    assignedTo: { name: 'Priya', role: 'Staff' },
    delay: 2000,
  },
  {
    customerName: 'Ananya Gupta',
    platform: 'web',
    items: ['Chanderi Silk (x5)', 'Handloom Stole (x2)'],
    amount: 9200,
    priorityScore: 85,
    assignedTo: { name: 'Amit', role: 'Staff' },
    delay: 3500,
  },
];

export const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    customerName: 'Riya Sharma',
    platform: 'whatsapp',
    handledBy: 'staff',
    messages: [
      { sender: 'customer', name: 'Riya Sharma', avatar: 'RS', content: 'Hi! I need 3 silk sarees for a wedding next week. Can you help?', delay: 600 },
      { sender: 'staff', name: 'Rahul (Manager)', avatar: 'R', content: 'Absolutely! We have Banarasi, Kanchipuram & Chanderi silks in stock. What type are you looking for?', delay: 2200 },
      { sender: 'customer', name: 'Riya Sharma', avatar: 'RS', content: 'Can you show me the Banarasi ones? My budget is around ₹6,000 per piece.', delay: 4000 },
      { sender: 'staff', name: 'Rahul (Manager)', avatar: 'R', content: 'Great choice! Here are 3 Banarasi designs within your budget. All have real zari work. 👇\n1. Gold Floral - ₹5,800\n2. Red Traditional - ₹6,200\n3. Green Temple - ₹5,500', delay: 5800 },
      { sender: 'customer', name: 'Riya Sharma', avatar: 'RS', content: 'The Gold Floral one looks perfect! I\'ll take 2 of those and 1 Red Traditional.', delay: 7800 },
      { sender: 'staff', name: 'Rahul (Manager)', avatar: 'R', content: 'Excellent! Total: ₹17,800. I\'ll share the payment link. We offer free shipping for orders above ₹10k! ✅', delay: 9800 },
      { sender: 'customer', name: 'Riya Sharma', avatar: 'RS', content: 'Paid! ✅ Please deliver by Friday.', delay: 11800 },
      { sender: 'staff', name: 'Rahul (Manager)', avatar: 'R', content: 'Order confirmed! Will be dispatched today. You\'ll get tracking updates via WhatsApp. Thank you! 🎉', delay: 13800 },
    ],
  },
  {
    customerName: 'Ananya Gupta',
    platform: 'web',
    handledBy: 'ai-bot',
    messages: [
      { sender: 'customer', name: 'Ananya Gupta', avatar: 'AG', content: 'Do you have Chanderi silk stoles in stock?', delay: 600 },
      { sender: 'ai-bot', name: 'AI Assistant', avatar: '🤖', content: 'Yes! We have 5 designs in stock:\n1. Magenta with border - ₹1,200\n2. Teal with floral - ₹1,400\n3. Ivory with gold thread - ₹1,800\nWhich would you like?', delay: 1800, isAI: true },
      { sender: 'customer', name: 'Ananya Gupta', avatar: 'AG', content: 'I\'ll take the Teal floral and Ivory gold — 2 pieces.', delay: 3600 },
      { sender: 'ai-bot', name: 'AI Assistant', avatar: '🤖', content: 'Order summary:\n• Teal Floral Stole (x1) - ₹1,400\n• Ivory Gold Thread (x1) - ₹1,800\nTotal: ₹3,200\nPayment link sent! 💳', delay: 4800, isAI: true },
      { sender: 'customer', name: 'Ananya Gupta', avatar: 'AG', content: 'Done! Paid via UPI 👍', delay: 6800 },
      { sender: 'ai-bot', name: 'AI Assistant', avatar: '🤖', content: 'Payment confirmed! ✅ Order #ORD-002 is approved.\nEstimated delivery: 3-5 business days. Tracking will be shared soon. Thank you! 🎉', delay: 8000, isAI: true },
    ],
  },
];

export const DEMO_SCENES: DemoScene[] = [
  {
    id: 'incoming-orders',
    title: 'Orders Arriving from All Channels',
    description: 'Watch as orders flow in from WhatsApp, Instagram & your Web Store — unified and prioritized automatically.',
    duration: 6000,
    navigateTo: 'shop',
  },
  {
    id: 'auto-assignment',
    title: 'Smart Team Assignment',
    description: 'Each order is instantly assigned to the least-busy team member based on expertise and workload.',
    duration: 5000,
  },
  {
    id: 'navigate-messages',
    title: 'Conversations in Action',
    description: 'See how your team handles orders — manually for complex requests, and AI for routine ones.',
    duration: 2000,
    navigateTo: 'messages',
  },
  {
    id: 'conversation-demo',
    title: '',
    description: '',
    duration: 0, // plays through conversation animations, auto-advances when done
  },
  {
    id: 'order-confirmed',
    title: 'Order Confirmed & Synced',
    description: 'Both orders are confirmed. Let\'s see them on the Orders board.',
    duration: 2000,
    navigateTo: 'orders',
  },
  {
    id: 'orders-board',
    title: 'Order Fulfillment Board',
    description: 'All orders appear with priority scores, status, and assigned staff — ready for fulfillment.',
    duration: 4000,
  },
  {
    id: 'back-to-home',
    title: 'Real-Time Dashboard Update',
    description: 'Revenue, order counts, and metrics update instantly as orders flow through the system.',
    duration: 5000,
    navigateTo: 'shop',
  },
  {
    id: 'complete',
    title: 'Demo Complete! 🎉',
    description: 'You\'ve seen how LeadSync unifies orders, auto-assigns staff, handles conversations, and updates your dashboard in real time!',
    duration: 4000,
  },
];