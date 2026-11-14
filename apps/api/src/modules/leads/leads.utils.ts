// Pure helpers for the leads inbox. No I/O so they can be unit tested.

export const LEAD_SOURCES = ['whatsapp', 'email', 'website', 'social', 'ads', 'manual', 'api'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified', 'converted'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Leads in these states are finished, so a new message from the same person starts a fresh lead. */
export const CLOSED_STATUSES: LeadStatus[] = ['unqualified', 'converted'];

export interface LeadFields {
  source?: string;
  source_detail?: string;
  external_ref?: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  message?: string;
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v === 'number') v = String(v);
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
};

const pick = (body: Record<string, unknown>, keys: string[], max: number) => {
  for (const k of keys) {
    const v = str(body[k], max);
    if (v) return v;
  }
  return undefined;
};

/**
 * Maps a webhook payload from an ad platform, social tool, Zapier/Make or a website form
 * onto lead fields. Accepts the common field names those tools use.
 */
export function mapWebhookPayload(raw: unknown): LeadFields {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const first = pick(body, ['first_name', 'firstname', 'firstName'], 120);
  const last = pick(body, ['last_name', 'lastname', 'lastName'], 120);
  const source = pick(body, ['source', 'channel'], 30)?.toLowerCase();
  return {
    source: source && (LEAD_SOURCES as readonly string[]).includes(source) && source !== 'manual' ? source : 'api',
    source_detail: pick(body, ['source_detail', 'campaign', 'campaign_name', 'ad_name', 'form_name', 'platform'], 200),
    external_ref: pick(body, ['external_id', 'lead_id', 'leadgen_id', 'id'], 255),
    name: pick(body, ['name', 'full_name', 'fullName'], 255) || [first, last].filter(Boolean).join(' ') || undefined,
    email: pick(body, ['email', 'email_address', 'emailAddress'], 255)?.toLowerCase(),
    phone: pick(body, ['phone', 'phone_number', 'phoneNumber', 'mobile', 'whatsapp'], 40),
    company: pick(body, ['company', 'company_name', 'organization', 'business'], 255),
    message: pick(body, ['message', 'comments', 'comment', 'notes', 'enquiry', 'inquiry', 'question'], 5000),
  };
}

export function isValidEmail(email: string | undefined | null): boolean {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Splits "Asha Rao Kumar" into first "Asha" and last "Rao Kumar". */
export function splitName(name: string | null | undefined): { first_name?: string; last_name?: string } {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') || undefined };
}

export function temperatureFor(score: number): 'hot' | 'warm' | 'cold' {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}
