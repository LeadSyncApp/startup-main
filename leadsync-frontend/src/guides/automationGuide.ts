import type { PageGuide } from './types';
import {
  List,
  ToggleLeft,
  Hash,
  Sparkles,
  FileText,
  MessageSquare,
  FlaskConical,
  PenTool,
} from 'lucide-react';

export const automationGuide: PageGuide = {
  pageId: 'automation',
  pageTitle: 'Automation',
  sections: [
    {
      id: 'flow-list',
      title: 'Automation Flows',
      description: 'The left sidebar lists all your automation flows. Each flow is a collection of rules the bot follows in conversations. Give each flow a descriptive name like "Order Status" or "Product Catalogue".',
      whyItMatters: 'Organising rules into flows keeps your bot behaviour structured and easy to manage as it grows.',
      icon: List,
    },
    {
      id: 'flow-toggle',
      title: 'Flow Toggle Switch',
      description: 'Each flow has a green on/off toggle. When turned off, all instructions inside that flow stop working immediately. The bot will not respond to any triggers in that flow.',
      whyItMatters: 'Turn off a flow during seasonal promotions or when a rule is outdated, without deleting it.',
      icon: ToggleLeft,
    },
    {
      id: 'slot-counter',
      title: 'Telegram Button/Command Counter',
      description: 'Shows how many of your 6 available Telegram button slots are used (e.g. "3/6 slots used"). Each inline button or typed command on Telegram counts as one slot. When the counter turns amber, you are close to the limit.',
      whyItMatters: 'Telegram has a hard limit of 6 menu buttons — plan your commands carefully so the most important ones are always available.',
      icon: Hash,
    },
    {
      id: 'describe-flow',
      title: 'Describe Your Flow',
      description: 'A purple-bordered panel where you describe what you want the bot to do in plain English. For example: "When a customer asks about prices, send them the price list." The AI generates a complete flow from your description. You can also use the voice dictation button to speak your instructions.',
      whyItMatters: 'You do not need to write code — describe the behaviour you want and the AI builds the rules for you.',
      icon: Sparkles,
    },
    {
      id: 'instruction-cards',
      title: 'Instruction Cards',
      description: 'Each card represents one rule the bot follows. The card shows the instruction text, the trigger keywords (purple chips), and a surfacing badge indicating where the rule appears — as an inline button, a typed command like "/menu", or both.',
      whyItMatters: 'Review the trigger keywords to make sure the bot responds to the right customer messages.',
      icon: FileText,
    },
    {
      id: 'instruction-editor',
      title: 'Instruction Editor',
      description: 'Expand any instruction card to configure it in detail. The Fixed Reply section lets you write the bot\'s response, with variables like {customerName} and {shopName} that fill in automatically. You can also set whether the reply shows as an inline button, a typed command, or both, and choose which menu level it sits in.',
      whyItMatters: 'Variables save you from writing the same message for every customer — the bot personalises it automatically.',
      icon: PenTool,
    },
    {
      id: 'example-conversation',
      title: 'Example Conversation',
      description: 'Inside the expanded instruction, a preview panel shows a sample chat between a customer and your bot. It shows what the customer might type and exactly how the bot will respond, including any submenu buttons.',
      whyItMatters: 'Check the example before saving — it shows you exactly what the customer will experience.',
      icon: MessageSquare,
    },
    {
      id: 'test-panel',
      title: 'Test Panel',
      description: 'Type a test message and tap "Run Test" to see how the bot responds. If the instruction matches, you will see the bot\'s reply. If it does not match, you will see an amber warning. Use this to verify your trigger keywords work correctly.',
      whyItMatters: 'Always test before going live — a misconfigured rule can confuse customers or respond to the wrong messages.',
      icon: FlaskConical,
    },
  ],
};
