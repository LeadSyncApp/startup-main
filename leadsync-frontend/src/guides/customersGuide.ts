import type { PageGuide } from './types';
import {
  Search,
  MapPin,
  Users,
  IndianRupee,
  Tag,
  Download,
  UserPlus,
  Filter,
  CheckSquare,
} from 'lucide-react';

export const customersGuide: PageGuide = {
  pageId: 'customers',
  pageTitle: 'Customers',
  sections: [
    {
      id: 'search-customer',
      title: 'Search Customers',
      description: 'Type a customer name or mobile number to find someone quickly. The table filters as you type, so you do not need to press Enter.',
      whyItMatters: 'Find a specific customer in seconds instead of scrolling through hundreds of rows.',
      icon: Search,
    },
    {
      id: 'state-dropdown',
      title: 'State Filter',
      description: 'Filter your customer list by Indian state — Maharashtra, Karnataka, Tamil Nadu, Delhi, Gujarat, Uttar Pradesh, or West Bengal. Leave it blank to see all customers.',
      whyItMatters: 'Use this to target regional offers or see how your business performs in different states.',
      icon: MapPin,
    },
    {
      id: 'segment-dropdown',
      title: 'Customer Segment',
      description: 'Groups customers into categories: New Leads (first-time enquiries), Regulars (repeat buyers), VIP Customers (high spenders), and Churn Risk (haven\'t ordered in a while).',
      whyItMatters: 'Send different offers to different segments — a VIP deserves a different message than a new lead.',
      icon: Users,
    },
    {
      id: 'min-spend-filter',
      title: 'Minimum Spend Filter',
      description: 'Enter a number to show only customers who have spent more than that amount in total. For example, entering 5000 shows customers whose total business is above ₹5,000.',
      whyItMatters: 'Quickly find your highest-value customers for loyalty rewards or special promotions.',
      icon: IndianRupee,
    },
    {
      id: 'bulk-actions',
      title: 'Bulk Actions Bar',
      description: 'When you select customers using the checkboxes on the left, a bar appears with bulk tagging options. You can tag selected customers as "Frequent Saree Buyers" or "Tier-1 City" in one click.',
      whyItMatters: 'Tagging customers in bulk saves time — instead of editing each one individually, select and tag them all at once.',
      icon: Tag,
    },
    {
      id: 'data-table',
      title: 'Customer Table',
      description: 'The main table shows each customer\'s name, phone number, city/state, total amount spent, number of orders, and their segment badge (VIP is amber, Regular is blue, New is grey). A green dot next to the amount means they have spent over ₹5,000.',
      whyItMatters: 'The segment badge and spend amount help you decide how to prioritise each customer at a glance.',
      icon: CheckSquare,
    },
    {
      id: 'export-csv',
      title: 'Export CSV',
      description: 'Downloads your entire customer list as a spreadsheet file (.csv). You can open it in Excel, Google Sheets, or any other spreadsheet app.',
      whyItMatters: 'Use the export to share your customer list with partners, run your own analysis, or keep a backup.',
      icon: Download,
    },
    {
      id: 'add-manual-lead',
      title: 'Add Manual Lead',
      description: 'Opens a form to add a new customer by hand. Enter their name, phone number, and any other details. Use this for walk-in customers or phone orders that came in outside the app.',
      whyItMatters: 'Not every customer messages you online — this lets you capture walk-in and phone order customers too.',
      icon: UserPlus,
    },
    {
      id: 'apply-filter',
      title: 'Apply Filters',
      description: 'After selecting your state, segment, and minimum spend filters, tap this button to apply them all at once. The table updates to show only customers matching all your criteria.',
      whyItMatters: 'Combining filters lets you create very specific customer lists, like "VIP customers in Maharashtra who spent over ₹10,000".',
      icon: Filter,
    },
  ],
};
