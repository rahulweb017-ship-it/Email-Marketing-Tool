import type { LucideIcon } from 'lucide-react';
import { Mail, MessageCircle, Sparkles, Workflow, Users, BarChart3, Share2, Code2 } from 'lucide-react';

/** Company details shown across the website. Replace the placeholders with your real details. */
export const SITE = {
  name: 'Rabbit Growth',
  tagline: 'AI-powered email and WhatsApp marketing',
  email: 'hello@yourcompany.com',
  salesEmail: 'sales@yourcompany.com',
  phone: '+91 00000 00000',
  whatsapp: '+91 00000 00000',
  address: 'Your office address, City, State 000000, India',
  hours: 'Monday to Saturday, 10:00 to 19:00 IST',
};

export interface Feature {
  slug: string;
  name: string;
  icon: LucideIcon;
  /** Tailwind gradient stops used for the icon tile and accents */
  gradient: string;
  short: string;
  headline: string;
  description: string;
  highlights: string[];
  details: { title: string; text: string }[];
}

export const FEATURES: Feature[] = [
  {
    slug: 'email-campaigns',
    name: 'Email Campaigns',
    icon: Mail,
    gradient: 'from-indigo-500 to-blue-500',
    short: 'Design beautiful emails with drag and drop, then send to the right people at the right time.',
    headline: 'Emails people actually open',
    description:
      'Build professional emails in minutes with a drag-and-drop editor, ready-made templates and your own media library. Schedule campaigns, test subject lines and let the winner send itself.',
    highlights: ['Drag-and-drop editor', 'Template gallery', 'A/B testing with auto-winner', 'Scheduling'],
    details: [
      { title: 'Drag-and-drop editor', text: 'Headers, hero banners, images, buttons, columns, video thumbnails and footers. Double-click any text to edit it.' },
      { title: 'Media library', text: 'Upload images, videos and PDFs once and reuse them in every email. Paste or drag files straight in.' },
      { title: 'A/B testing', text: 'Test two subject lines or designs on a sample. The better version goes to everyone else automatically.' },
      { title: 'Personalisation', text: 'Insert names, custom fields and unsubscribe links so every email feels written for one person.' },
      { title: 'Lists and segments', text: 'Send to a list, a saved segment or both. Unsubscribed and blocked contacts are always skipped.' },
      { title: 'Scheduling', text: 'Pick a date and time and the campaign goes out on its own, with live progress while it sends.' },
    ],
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp Marketing',
    icon: MessageCircle,
    gradient: 'from-emerald-500 to-teal-500',
    short: 'Reach customers where they reply fastest, with safe sending built in.',
    headline: 'WhatsApp campaigns, done safely',
    description:
      'Connect the official WhatsApp Business (Meta Cloud) API or link a number with a QR code. Send bulk campaigns with human-like pacing, manage every chat in one shared inbox and respect opt-outs automatically.',
    highlights: ['Official Meta Cloud API', 'QR-linked numbers', 'Shared team inbox', 'Automatic STOP handling'],
    details: [
      { title: 'Two ways to connect', text: 'Use the official Meta Cloud API with approved templates, or link an existing number by scanning a QR code.' },
      { title: 'Human-like pacing', text: 'Messages go out with natural gaps, daily warm-up limits and quiet hours to protect your number.' },
      { title: 'Auto-pause protection', text: 'Sending pauses by itself if a number is logged out or starts failing, so a problem never snowballs.' },
      { title: 'Shared inbox', text: 'Every reply lands in one inbox your whole team can see, with full message history per contact.' },
      { title: 'Consent first', text: 'Campaigns only reach contacts who opted in. Anyone who replies STOP is excluded straight away.' },
      { title: 'Delivery receipts', text: 'See sent, delivered, read and failed counts for each campaign as they happen.' },
    ],
  },
  {
    slug: 'ai-assistant',
    name: 'AI Assistant',
    icon: Sparkles,
    gradient: 'from-fuchsia-500 to-violet-500',
    short: 'An AI teammate that writes messages, suggests replies and answers customers 24/7.',
    headline: 'Your AI marketing teammate',
    description:
      'Powered by Claude, the AI assistant drafts messages in your brand voice, suggests replies in the inbox and can answer customers on its own around the clock. When it is unsure, it hands the chat to a person.',
    highlights: ['AI message writer', 'Reply suggestions', '24/7 auto-replies', 'Human handoff'],
    details: [
      { title: 'Write with AI', text: 'Describe what you want to say and get a ready-to-send message you can edit in one click.' },
      { title: 'Reply suggestions', text: 'Open a chat and get suggested replies based on the conversation and your business details.' },
      { title: 'Auto-reply bot', text: 'Answer common questions instantly, day or night, so no customer waits for an answer.' },
      { title: 'Teach the AI', text: 'Add your products, prices, policies and FAQs. The AI answers from your information, not guesses.' },
      { title: 'Knows when to stop', text: 'Sensitive or unclear chats are flagged for a person, and reply limits keep the bot from over-messaging.' },
      { title: 'You stay in control', text: 'Turn AI on or off per number, review what it sent and take over any conversation at any time.' },
    ],
  },
  {
    slug: 'automation',
    name: 'Automation',
    icon: Workflow,
    gradient: 'from-amber-500 to-orange-500',
    short: 'Build welcome series, follow-ups and reminders once, then let them run on their own.',
    headline: 'Marketing that runs while you sleep',
    description:
      'Draw your customer journeys on a visual canvas. Choose a trigger, add waits, conditions and messages, and every new contact follows the path automatically.',
    highlights: ['Visual journey builder', 'Triggers and delays', 'If/else conditions', 'Double opt-in'],
    details: [
      { title: 'Visual builder', text: 'Drag steps onto a canvas and connect them. See the whole journey at a glance.' },
      { title: 'Smart triggers', text: 'Move people forward when they open, click, reply, get a tag, update a field or enter a segment.' },
      { title: 'Waits and conditions', text: 'Wait hours or days, then take a different path for people who did or did not open, click or reply.' },
      { title: 'Welcome series', text: 'Greet new subscribers with a sequence that introduces your brand step by step.' },
      { title: 'Double opt-in', text: 'Confirm new subscribers by email to keep your list clean and compliant.' },
      { title: 'Always on', text: 'Automations are checked every 30 seconds, so the next step is never late.' },
    ],
  },
  {
    slug: 'contacts-segments',
    name: 'Contacts & Segments',
    icon: Users,
    gradient: 'from-sky-500 to-cyan-500',
    short: 'Import any spreadsheet, keep contacts tidy and target exactly the right audience.',
    headline: 'Know every customer',
    description:
      'Import contacts from any CSV, even messy ones. Keep email-only, phone-only or both, add your own fields and group people into segments that update themselves.',
    highlights: ['Smart CSV import', 'Email or phone contacts', 'Engagement scoring', 'Dynamic segments'],
    details: [
      { title: 'Smart CSV import', text: 'Columns are matched automatically and common mistakes in emails and phone numbers are fixed for you.' },
      { title: 'Email or phone', text: 'Keep contacts with an email, a phone number or both, ready for email and WhatsApp.' },
      { title: 'Custom fields', text: 'Store anything you need, such as city, plan or birthday, and use it in messages and segments.' },
      { title: 'Engagement scoring', text: 'Every contact gets a score based on opens and clicks, refreshed every hour.' },
      { title: 'Dynamic segments', text: 'Save a filter once and the segment updates itself as contacts change.' },
      { title: 'Consent records', text: 'Track who agreed to what and when, including blocked and unsubscribed contacts.' },
    ],
  },
  {
    slug: 'analytics',
    name: 'Analytics',
    icon: BarChart3,
    gradient: 'from-rose-500 to-pink-500',
    short: 'See opens, clicks and replies in real time and compare campaigns side by side.',
    headline: 'Every result, clearly explained',
    description:
      'Track opens, clicks, bounces and unsubscribes for every campaign. Compare campaigns side by side and find out which links and messages work best.',
    highlights: ['Live campaign stats', 'Click tracking', 'Campaign comparison', 'Social metrics'],
    details: [
      { title: 'Live stats', text: 'Numbers refresh every 30 seconds while a campaign is sending.' },
      { title: 'Click tracking', text: 'See which links were clicked and by whom. Tracking links are signed so they cannot be faked.' },
      { title: 'Compare campaigns', text: 'Put campaigns side by side to see what changed and what worked.' },
      { title: 'Contact timeline', text: 'Open any contact to see every email, click and message in one history.' },
      { title: 'WhatsApp reports', text: 'Sent, delivered, read and replied for every WhatsApp campaign.' },
      { title: 'Social metrics', text: 'Likes, shares and reach for scheduled social posts, updated every 30 minutes.' },
    ],
  },
  {
    slug: 'social-media',
    name: 'Social Publishing',
    icon: Share2,
    gradient: 'from-blue-500 to-indigo-500',
    short: 'Plan and schedule posts for X, Facebook and LinkedIn from the same place.',
    headline: 'All your social posts, one calendar',
    description:
      'Write a post once, pick your channels and schedule it. A content calendar shows everything planned, and results come back into the same dashboard.',
    highlights: ['X, Facebook, LinkedIn', 'Post scheduling', 'Content calendar', 'Engagement metrics'],
    details: [
      { title: 'Connect your accounts', text: 'Link X (Twitter), Facebook and LinkedIn securely with their official sign-in.' },
      { title: 'Compose once', text: 'Write one post and publish it to several channels at the same time.' },
      { title: 'Schedule ahead', text: 'Queue posts for the best time and let them publish automatically.' },
      { title: 'Content calendar', text: 'See every planned post in a calendar and move things around easily.' },
    ],
  },
  {
    slug: 'developers',
    name: 'API & Transactional',
    icon: Code2,
    gradient: 'from-slate-500 to-zinc-500',
    short: 'Send order and account emails through an API, with webhooks and your own domain.',
    headline: 'Built for developers too',
    description:
      'Send receipts, password resets and alerts through a simple API. Connect your own SMTP, SendGrid or Amazon SES, sign mail with DKIM and get webhook events back.',
    highlights: ['Transactional email API', 'API keys', 'Outgoing webhooks', 'SMTP, SendGrid, SES'],
    details: [
      { title: 'Transactional API', text: 'Trigger order confirmations and other one-to-one emails from your own app.' },
      { title: 'API keys', text: 'Create keys per integration and revoke them whenever you need to.' },
      { title: 'Webhooks', text: 'Get notified about sends, opens, clicks, bounces, new contacts and unsubscribes in your own systems.' },
      { title: 'Your sending setup', text: 'Use SMTP, SendGrid or Amazon SES, with DKIM signing for better inbox placement.' },
      { title: 'Signup forms', text: 'Embed forms on your website that add new subscribers straight to a list.' },
      { title: 'Multi-team ready', text: 'Every organisation’s data is kept separate, with plans and limits per team.' },
    ],
  },
];

export const ENQUIRY_INTERESTS: { value: string; label: string }[] = [
  { value: 'email_campaigns', label: 'Email campaigns' },
  { value: 'whatsapp', label: 'WhatsApp marketing' },
  { value: 'ai_assistant', label: 'AI assistant' },
  { value: 'automation', label: 'Automation' },
  { value: 'social_media', label: 'Social publishing' },
  { value: 'transactional', label: 'Transactional email / API' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'templates', label: 'Email templates' },
];
