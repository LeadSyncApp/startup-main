import type { PageGuide } from './types';
import {
  PenSquare,
  History,
  MessageSquare,
  Send,
  AlertTriangle,
  Users,
  Filter,
  Tag,
} from 'lucide-react';

export const broadcastGuide: PageGuide = {
  pageId: 'broadcast',
  pageTitle: 'Broadcast',
  sections: [
    {
      id: 'compose-history-toggle',
      title: 'Compose / History Toggle',
      description: 'Switch between two views. Compose is where you write and send a new broadcast. History shows all the broadcasts you have sent in the past, including who received them and when.',
      whyItMatters: 'Check History before sending a new broadcast to avoid sending the same offer twice to the same people.',
      icon: PenSquare,
    },
    {
      id: 'campaign-title',
      title: 'Campaign Title',
      description: 'An optional name for your broadcast, like "Fresh Brownies Batch" or "Diwali Sale 2025". This is for your own reference — customers do not see this title.',
      whyItMatters: 'Naming your campaigns makes it easier to find them in History later and track which promotions worked.',
      icon: Tag,
    },
    {
      id: 'message-textarea',
      title: 'Message Textarea',
      description: 'Write your broadcast message here. You can use up to 4,096 characters. The tip at the bottom reminds you that personalised messages get 3x more replies — mention the customer\'s name or a product they liked.',
      whyItMatters: 'A good message gets responses. Keep it short, friendly, and relevant to the customers you are targeting.',
      icon: MessageSquare,
    },
    {
      id: 'send-broadcast-button',
      title: 'Send Broadcast Now',
      description: 'Tap this button to send your message to all selected customers immediately. The button is disabled until you have written a message. Once sent, the broadcast cannot be undone.',
      whyItMatters: 'Double-check your message and target audience before tapping — there is no undo after sending.',
      icon: Send,
    },
    {
      id: 'guidelines-banner',
      title: 'Broadcast Guidelines',
      description: 'The yellow warning box reminds you that sending too many broadcasts or irrelevant messages can get your account flagged as spam. On Telegram, excessive broadcasting can lead to your bot being blocked.',
      whyItMatters: 'Respect these guidelines to keep your messaging channels active and avoid losing access.',
      icon: AlertTriangle,
    },
    {
      id: 'target-audience',
      title: 'Target Audience Panel',
      description: 'Choose who receives your broadcast using segment buttons (New Leads, Regular Customers, VIPs) and tag filters (Frequent Saree Buyers, Tier-1 City, etc.). The recipient estimate updates as you add filters. Leave all filters off to message every customer.',
      whyItMatters: 'Targeting the right audience means your message reaches people who actually care, getting better results with fewer sends.',
      icon: Users,
    },
    {
      id: 'filter-segments',
      title: 'Segment & Tag Filters',
      description: 'Segment buttons filter by customer type: New Leads are first-time enquiries, Regular Customers have ordered before, VIPs are your top spenders. Tag buttons filter by custom labels you have assigned. You can combine multiple filters.',
      whyItMatters: 'Combining segments and tags lets you send highly targeted messages — like VIPs in Tier-1 cities who buy sarees.',
      icon: Filter,
    },
    {
      id: 'recipient-estimate',
      title: 'Recipient Estimate',
      description: 'Shows how many customers will receive your broadcast based on your current filters. If no filters are selected, it shows "All Customers". This number updates live as you change filters.',
      whyItMatters: 'Check this number before sending — if it seems too high or too low, adjust your filters.',
      icon: Users,
    },
    {
      id: 'history-table',
      title: 'Broadcast History',
      description: 'A table listing all past broadcasts with the message preview, audience tags, number of recipients, date sent, and a green checkmark if it was successful. Empty if you have not sent any broadcasts yet.',
      whyItMatters: 'Review past broadcasts to see what worked and avoid sending the same message repeatedly.',
      icon: History,
    },
  ],
};
