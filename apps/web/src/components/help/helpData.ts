import { create } from 'zustand';

export interface PageHelp {
  title: string;
  summary: string;
  steps?: string[];
}

/** Short plain-language explanation for each app page, keyed by route pattern. */
export const PAGE_HELP: Record<string, PageHelp> = {
  '/': {
    title: 'Dashboard',
    summary: 'A quick overview of how your marketing is doing: emails sent, opens, clicks and recent activity.',
    steps: ['Check today\u2019s numbers', 'Open a campaign to see details', 'Use Ctrl+K to jump anywhere'],
  },
  '/copilot': {
    title: 'Rabbit AI Copilot',
    summary: 'Ask the AI in plain words and it helps you write campaigns, find audiences and understand your results.',
    steps: ['Type a question or goal', 'Review the suggestion', 'Apply it with one click'],
  },
  '/leads': {
    title: 'Leads',
    summary: 'New enquiries from your website forms and ads land here. AI scores each lead so you know who to call first.',
    steps: ['Connect a form with the webhook link', 'Review hot leads first', 'Convert a lead into a contact'],
  },
  '/contacts': {
    title: 'Contacts',
    summary: 'Everyone you can message: customers, subscribers and leads, with their details and history.',
    steps: ['Import a CSV or add contacts', 'Click a contact to see their activity', 'Add tags to organise them'],
  },
  '/contacts/:id': {
    title: 'Contact profile',
    summary: 'Everything about one person: details, tags, the emails they opened and the messages they received.',
  },
  '/lists': {
    title: 'Lists',
    summary: 'Fixed groups of contacts (for example "Newsletter" or "VIP customers") that you send campaigns to.',
    steps: ['Create a list', 'Add or import contacts into it', 'Pick it when sending a campaign'],
  },
  '/campaigns': {
    title: 'Email campaigns',
    summary: 'Create, schedule and send emails to a list or segment, then track opens and clicks.',
    steps: ['Click "New campaign"', 'Choose audience and template', 'Send now or schedule'],
  },
  '/campaigns/compare': {
    title: 'Compare campaigns',
    summary: 'Put campaigns side by side to see which subject lines and content work best.',
  },
  '/campaigns/:id/analytics': {
    title: 'Campaign report',
    summary: 'Detailed results for one campaign: who opened, who clicked, bounces and unsubscribes.',
  },
  '/templates': {
    title: 'Templates',
    summary: 'Reusable email designs. Build once with the drag-and-drop editor, use them in any campaign.',
    steps: ['Start from the gallery or blank', 'Edit with drag and drop', 'Save and use in a campaign'],
  },
  '/automations': {
    title: 'Automations',
    summary: 'Messages that send themselves when something happens, like a welcome email after someone signs up.',
    steps: ['Pick a trigger', 'Add emails, waits and conditions', 'Turn it on'],
  },
  '/segments': {
    title: 'Segments',
    summary: 'Smart groups that update automatically based on rules, such as "opened an email in the last 30 days".',
    steps: ['Add rules (or ask AI)', 'Preview who matches', 'Use the segment in a campaign'],
  },
  '/transactional': {
    title: 'Transactional email',
    summary: 'One-to-one system emails such as order confirmations and password resets, sent from your app via API.',
  },
  '/social': {
    title: 'Social media',
    summary: 'Write and schedule posts for your social accounts from one place, and see how they perform.',
    steps: ['Connect accounts', 'Compose a post (AI can help)', 'Schedule it on the calendar'],
  },
  '/social/accounts': {
    title: 'Social accounts',
    summary: 'Connect your X, Facebook, Instagram and LinkedIn accounts so you can post to them.',
  },
  '/social/compose': {
    title: 'New post',
    summary: 'Write one post, pick the accounts to publish to, and post now or schedule it.',
  },
  '/social/compose/:id': {
    title: 'Edit post',
    summary: 'Change the text, media, accounts or schedule of this post.',
  },
  '/social/calendar': {
    title: 'Content calendar',
    summary: 'See all your scheduled and published posts by date.',
  },
  '/whatsapp': {
    title: 'WhatsApp',
    summary: 'Send WhatsApp campaigns and chat with customers. Start by connecting a WhatsApp number.',
    steps: ['Connect a number', 'Create message templates', 'Send a campaign or reply in Inbox'],
  },
  '/whatsapp/inbox': {
    title: 'WhatsApp inbox',
    summary: 'All customer chats in one place. Reply yourself or let the AI assistant answer.',
  },
  '/whatsapp/campaigns': {
    title: 'WhatsApp campaigns',
    summary: 'Send a WhatsApp message to many contacts who agreed to receive them, safely paced.',
  },
  '/whatsapp/campaigns/:id': {
    title: 'WhatsApp campaign',
    summary: 'Delivery and reply results for this WhatsApp campaign.',
  },
  '/whatsapp/templates': {
    title: 'WhatsApp templates',
    summary: 'Pre-approved message formats. WhatsApp requires them to start conversations with customers.',
  },
  '/whatsapp/accounts': {
    title: 'WhatsApp numbers',
    summary: 'Connect a number with the official Meta API or by scanning a QR code.',
  },
  '/whatsapp/ai': {
    title: 'WhatsApp AI assistant',
    summary: 'Teach the AI about your business so it can answer customer questions 24/7.',
  },
  '/settings': {
    title: 'Settings',
    summary: 'Your company profile, team, sending domains, email provider, API keys and billing.',
  },
};

export function matchHelp(pathname: string): { key: string; help: PageHelp } | null {
  if (PAGE_HELP[pathname]) return { key: pathname, help: PAGE_HELP[pathname] };
  for (const [key, help] of Object.entries(PAGE_HELP)) {
    if (!key.includes(':')) continue;
    const re = new RegExp('^' + key.replace(/:[^/]+/g, '[^/]+') + '$');
    if (re.test(pathname)) return { key, help };
  }
  return null;
}

const read = <T,>(k: string, fallback: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};

interface HelpState {
  tipsOn: boolean;
  dismissed: string[];
  setTipsOn: (on: boolean) => void;
  dismiss: (key: string) => void;
}

export const useHelpStore = create<HelpState>((set, get) => ({
  tipsOn: read('rg_tips_on', true),
  dismissed: read<string[]>('rg_tips_dismissed', []),
  setTipsOn: (on) => {
    localStorage.setItem('rg_tips_on', JSON.stringify(on));
    if (on) localStorage.setItem('rg_tips_dismissed', '[]');
    set({ tipsOn: on, dismissed: on ? [] : get().dismissed });
  },
  dismiss: (key) => {
    const dismissed = [...new Set([...get().dismissed, key])];
    localStorage.setItem('rg_tips_dismissed', JSON.stringify(dismissed));
    set({ dismissed });
  },
}));
