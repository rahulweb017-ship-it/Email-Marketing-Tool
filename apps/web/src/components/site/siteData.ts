import type { LucideIcon } from 'lucide-react';
import { Mail, MessageCircle, Sparkles, Workflow, Users, BarChart3, Share2, Code2, Inbox } from 'lucide-react';

/** Company details shown across the website. Replace the placeholders with your real details. */
export const SITE = {
  name: 'Rabbit Growth',
  tagline: 'The AI-powered all-in-one marketing platform',
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
  /** Planned capabilities, shown with a "Coming soon" badge */
  roadmap?: { title: string; text: string }[];
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
    highlights: ['Drag-and-drop editor', 'AI email writer', 'AI subject lines', 'Send-time optimisation', 'A/B testing with auto-winner'],
    details: [
      { title: 'AI email writer', text: 'Describe your offer in a sentence and Rabbit AI drafts the whole email in your brand voice, ready to edit in the editor.' },
      { title: 'AI subject lines', text: 'Get five subject lines with a score and a reason for each, then send the best two into an A/B test.' },
      { title: 'Drag-and-drop editor', text: 'Headers, hero banners, images, buttons, columns, video thumbnails and footers. Double-click any text to edit it.' },
      { title: 'Media library', text: 'Upload images, videos and PDFs once and reuse them in every email. Paste or drag files straight in.' },
      { title: 'A/B testing', text: 'Test two subject lines or designs on a sample. The better version goes to everyone else automatically.' },
      { title: 'Personalisation', text: 'Insert names, custom fields and unsubscribe links so every email feels written for one person.' },
      { title: 'Scheduling', text: 'Pick a date and time and the campaign goes out on its own, with live progress while it sends.' },
      { title: 'Send-time optimisation', text: 'Each contact receives your email at the hour they usually open it, based on their own open history.' },
      { title: 'AI campaign insights', text: 'A plain-language summary after every campaign: what worked, what did not and what to try next.' },
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
    highlights: ['Official Meta Cloud API', 'QR-linked numbers', 'Smart shared inbox', 'Automatic STOP handling'],
    details: [
      { title: 'Two ways to connect', text: 'Use the official Meta Cloud API with approved templates, or link an existing number by scanning a QR code.' },
      { title: 'Human-like pacing', text: 'Messages go out with natural gaps, daily warm-up limits and quiet hours to protect your number.' },
      { title: 'Auto-pause protection', text: 'Sending pauses by itself if a number is logged out or starts failing, so a problem never snowballs.' },
      { title: 'Shared inbox', text: 'Every reply lands in one inbox your whole team can see, with full message history per contact.' },
      { title: 'Consent first', text: 'Campaigns only reach contacts who opted in. Anyone who replies STOP is excluded straight away.' },
      { title: 'Delivery receipts', text: 'See sent, delivered, read and failed counts for each campaign as they happen.' },
      { title: 'Smart inbox', text: 'Rabbit AI labels every conversation by topic and mood and flags hot leads, so your team answers the right chats first.' },
    ],
  },
  {
    slug: 'ai-assistant',
    name: 'Rabbit AI',
    icon: Sparkles,
    gradient: 'from-fuchsia-500 to-violet-500',
    short: 'AI built into every channel. It writes emails, subject lines and posts, and answers customers 24/7.',
    headline: 'AI in every part of your marketing',
    description:
      'Rabbit AI, powered by Claude, learns your brand voice once and uses it everywhere. It writes emails, subject lines, social posts and WhatsApp messages, suggests replies in the inbox and answers customers around the clock. When it is unsure, it hands the chat to a person.',
    highlights: ['AI marketing copilot', 'AI email writer', 'AI image generation', 'AI segment and automation builders', 'Lead qualification', '24/7 WhatsApp replies'],
    details: [
      { title: 'AI marketing copilot', text: 'Ask "how did last month go?" or "help me win back quiet customers" and get answers from your real numbers, plus campaign, segment and automation drafts you create with one click.' },
      { title: 'Brand voice', text: 'Describe your business, products, audience and tone once. Every AI feature writes like your brand.' },
      { title: 'AI email writer', text: 'Turn a one-line brief into a complete email inside the drag-and-drop editor, then rewrite or shorten any text.' },
      { title: 'Subject line generator', text: 'Five subject lines with a score and a reason for each, ready to use or A/B test.' },
      { title: 'Social post writer', text: 'Write once and get versions sized for X, Facebook and LinkedIn, with hashtags.' },
      { title: 'AI image generation', text: 'Describe a banner or post image and Rabbit AI creates it in your chosen style, saved straight to your media library.' },
      { title: 'Lead qualification', text: 'Every new lead is scored, summarised and given a ready-to-send follow-up that asks for what is still missing.' },
      { title: 'Predictive scoring', text: 'Each contact gets a churn risk and a likelihood to engage, so you can target win-back campaigns before customers drift away.' },
      { title: 'Segment builder', text: 'Describe an audience in plain words and get segment rules you can check and save, with a live contact count.' },
      { title: 'Automation builder', text: 'Describe a customer journey and get a draft workflow on the canvas, with every email already written.' },
      { title: 'Campaign insights', text: 'Every sent campaign explained in plain language, compared with your previous results.' },
      { title: 'Smart inbox', text: 'WhatsApp conversations labelled by topic and mood, with hot leads flagged for your team.' },
      { title: 'WhatsApp replies', text: 'Draft WhatsApp messages, get reply suggestions in the inbox and let the bot answer common questions 24/7.' },
      { title: 'Teach the AI', text: 'Add your products, prices, policies and FAQs. The AI answers from your information, not guesses.' },
      { title: 'Knows when to stop', text: 'Sensitive or unclear chats are flagged for a person, and reply limits keep the bot from over-messaging.' },
      { title: 'Monthly AI credits', text: 'Every plan includes AI credits, and you can see exactly how many you have used this month.' },
    ],
  },
  {
    slug: 'leads',
    name: 'Leads Inbox',
    icon: Inbox,
    gradient: 'from-rose-500 to-red-500',
    short: 'Every enquiry from WhatsApp, email, your website, social and ads in one inbox, scored by AI.',
    headline: 'Never lose a lead again',
    description:
      'Leads from every channel land in one place. Rabbit AI scores each one, explains what they want and drafts your follow-up, so your team calls the hottest leads first and turns them into customers.',
    highlights: ['One inbox for every channel', 'AI lead scoring', 'Ready-made follow-ups', 'Lead webhook'],
    details: [
      { title: 'WhatsApp leads', text: 'Buying conversations, price questions and bookings in your WhatsApp inbox become leads automatically.' },
      { title: 'Email and forms', text: 'Signup form submissions are added as leads, linked to the contact.' },
      { title: 'Ads, social and website', text: 'Send leads from ad platforms, social tools, Zapier, Make or your own forms to a private webhook.' },
      { title: 'AI qualification', text: 'Rabbit AI scores each lead hot, warm or cold, notes their need, budget and timeline and suggests the next step.' },
      { title: 'Follow up fast', text: 'Send the AI-drafted reply on WhatsApp in one click, or open it in your email.' },
      { title: 'Pipeline', text: 'Move leads from new to contacted, qualified and converted, with notes and a full timeline.' },
      { title: 'Convert to contact', text: 'Turn a lead into a contact and add them to your lists, without creating duplicates.' },
    ],
    roadmap: [
      { title: 'Direct lead ads', text: 'Connect Facebook, Instagram and Google lead ads directly, without Zapier or Make.' },
      { title: 'Social messages', text: 'Instagram and Facebook messages arriving in the leads inbox.' },
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
    highlights: ['Visual journey builder', 'AI automation builder', 'Waits and conditions', 'Double opt-in'],
    details: [
      { title: 'Visual builder', text: 'Drag steps onto a canvas and connect them. See the whole journey at a glance.' },
      { title: 'AI automation builder', text: 'Describe a journey in plain words and Rabbit AI drafts it on the canvas, emails included, ready for you to review.' },
      { title: 'Smart triggers', text: 'Start people from a list or segment, then move them forward after each step or when they open or click an email.' },
      { title: 'Waits and conditions', text: 'Wait hours or days, then take a different path for people who did or did not open or click, or by contact details.' },
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
    highlights: ['Smart CSV import', 'Email or phone contacts', 'Predictive scoring', 'Dynamic segments'],
    details: [
      { title: 'Smart CSV import', text: 'Columns are matched automatically and common mistakes in emails and phone numbers are fixed for you.' },
      { title: 'Email or phone', text: 'Keep contacts with an email, a phone number or both, ready for email and WhatsApp.' },
      { title: 'Custom fields', text: 'Store anything you need, such as city, plan or birthday, and use it in messages and segments.' },
      { title: 'Engagement scoring', text: 'Every contact gets a score based on opens and clicks, refreshed every hour.' },
      { title: 'Predictive scoring', text: 'See each contact\'s churn risk and how likely they are to engage next, and segment on them to win people back before they drift away.' },
      { title: 'Dynamic segments', text: 'Filter by details, tags, engagement and recent activity. The segment updates itself as contacts change.' },
      { title: 'AI segment builder', text: 'Type "engaged contacts who haven\'t opened in 60 days" and Rabbit AI builds the rules for you.' },
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
    highlights: ['Live campaign stats', 'AI campaign insights', 'Click tracking', 'Campaign comparison'],
    details: [
      { title: 'Live stats', text: 'Numbers refresh every 30 seconds while a campaign is sending.' },
      { title: 'Click tracking', text: 'See which links were clicked and by whom. Tracking links are signed so they cannot be faked.' },
      { title: 'Compare campaigns', text: 'Put campaigns side by side to see what changed and what worked.' },
      { title: 'Contact timeline', text: 'Open any contact to see every email, click and message in one history.' },
      { title: 'WhatsApp reports', text: 'Sent, delivered, read and replied for every WhatsApp campaign.' },
      { title: 'Social metrics', text: 'Likes, shares and reach for scheduled social posts, updated every 30 minutes.' },
      { title: 'AI campaign insights', text: 'Results explained in plain language, with clear suggestions for your next campaign.' },
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
    highlights: ['X, Facebook, LinkedIn', 'AI post writer', 'Post scheduling', 'Content calendar'],
    details: [
      { title: 'AI post writer', text: 'Describe the post and Rabbit AI writes a version for each channel, sized to its character limit.' },
      { title: 'AI images', text: 'Create post images from a short description in the media library, in square, banner or portrait shapes.' },
      { title: 'Connect your accounts', text: 'Link X (Twitter), Facebook and LinkedIn securely with their official sign-in.' },
      { title: 'Compose once', text: 'Write one post and publish it to several channels at the same time.' },
      { title: 'Schedule ahead', text: 'Queue posts for the best time and let them publish automatically.' },
      { title: 'Content calendar', text: 'See every planned post in a calendar and move things around easily.' },
      { title: 'Engagement metrics', text: 'Likes, shares and reach come back into the same dashboard.' },
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
  { value: 'ai_assistant', label: 'Rabbit AI features' },
  { value: 'automation', label: 'Automation' },
  { value: 'social_media', label: 'Social publishing' },
  { value: 'transactional', label: 'Transactional email / API' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'templates', label: 'Email templates' },
];

/** AI features on the roadmap, shown on the home page with a "Coming soon" badge. */
export const AI_ROADMAP: { title: string; text: string }[] = [
  { title: 'AI lead follow-up on autopilot', text: 'Rabbit AI greets every new lead on WhatsApp within seconds and asks the qualifying questions for you.' },
  { title: 'Direct lead ads', text: 'Facebook, Instagram and Google lead ads flowing straight into your leads inbox.' },
  { title: 'Social messages inbox', text: 'Instagram and Facebook messages answered from the same place as WhatsApp.' },
];
