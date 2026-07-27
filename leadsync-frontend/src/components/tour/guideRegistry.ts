import type { PageGuide } from '../../guides/types';
import { messagesGuide } from '../../guides/messagesGuide';
import { inboxGuide } from '../../guides/inboxGuide';
import { customersGuide } from '../../guides/customersGuide';
import { broadcastGuide } from '../../guides/broadcastGuide';
import { ordersGuide } from '../../guides/ordersGuide';
import { automationGuide } from '../../guides/automationGuide';
import { inventoryGuide } from '../../guides/inventoryGuide';
import { settingsGuide } from '../../guides/settingsGuide';

const guides: Record<string, PageGuide> = {
  messages: messagesGuide,
  inbox: inboxGuide,
  customers: customersGuide,
  broadcast: broadcastGuide,
  orders: ordersGuide,
  automation: automationGuide,
  inventory: inventoryGuide,
  settings: settingsGuide,
};

export const getGuideForPage = (tabId: string): PageGuide | null => {
  return guides[tabId] ?? null;
};
