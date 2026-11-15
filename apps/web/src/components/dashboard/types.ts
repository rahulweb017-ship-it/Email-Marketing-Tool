export interface HubDaily { date: string; emails: number; whatsapp: number; social: number; leads: number; contacts: number }
export interface HubRecent { type: string; title: string; subtitle: string; at: string }

export interface HubData {
  range?: { days: number; from: string; to: string };
  contacts?: { total?: number; new_in_period?: number; unsubscribed_in_period?: number | null; whatsapp_reachable?: number | null } | null;
  email?: {
    campaigns_sent?: number | null; sent?: number; delivered?: number; opened?: number; clicked?: number;
    bounced?: number; unsubscribed?: number; open_rate?: number; click_rate?: number;
  } | null;
  transactional?: { total?: number; sent?: number; failed?: number; queued?: number } | null;
  whatsapp?: {
    sent?: number; delivered?: number; read?: number; failed?: number; queued?: number; inbound?: number;
    active_chats?: number; needs_human?: number; unread_conversations?: number; campaigns?: number; accounts?: number; read_rate?: number;
  } | null;
  social?: {
    published?: number; scheduled?: number; failed?: number; accounts_connected?: number;
    engagement?: { likes?: number; comments?: number; shares?: number; reach?: number; impressions?: number; clicks?: number } | null;
  } | null;
  leads?: { new?: number; hot?: number; converted?: number; open?: number; by_source?: Array<{ source: string; count: number }> } | null;
  automations?: { active?: number; contacts_in_progress?: number; emails_sent?: number | null } | null;
  daily?: HubDaily[];
  channel_mix?: Array<{ channel: string; messages: number }>;
  recent?: HubRecent[];
}

export interface EngagementDist { cold?: number; warm?: number; hot?: number; very_hot?: number }

export const CHANNEL_COLORS = {
  emails: '#cc0000',
  whatsapp: '#16a34a',
  social: '#2563eb',
  leads: '#f59e0b',
  contacts: '#6b7280',
} as const;

export const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
export const pct = (part: unknown, whole: unknown) => (num(whole) > 0 ? Math.round((num(part) / num(whole)) * 1000) / 10 : 0);
