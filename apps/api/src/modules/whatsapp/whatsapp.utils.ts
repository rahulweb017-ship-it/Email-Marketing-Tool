// Pure helpers for the WhatsApp module (no DB / Redis) — unit tested in whatsapp.utils.test.ts

export interface ContactLike {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  phone?: string | null;
  custom_fields?: Record<string, unknown> | string | null;
}

/** Resolve a contact field path like "first_name" or "custom.city". */
export function resolveContactField(contact: ContactLike, path: string): string {
  const custom = typeof contact.custom_fields === 'string'
    ? safeJson(contact.custom_fields)
    : (contact.custom_fields || {});
  if (path.startsWith('custom.')) {
    const v = (custom as Record<string, unknown>)[path.slice(7)];
    return v == null ? '' : String(v);
  }
  if (path === 'full_name') {
    return [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }
  const v = (contact as Record<string, unknown>)[path];
  return v == null ? '' : String(v);
}

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s) || {}; } catch { return {}; }
}

/**
 * Render a free-text message with {{first_name}} / {{custom.city}} placeholders.
 * Unknown or empty values fall back to the `|fallback` part: {{first_name|there}}.
 */
export function renderMessage(template: string, contact: ContactLike): string {
  return template.replace(/\{\{\s*([\w.]+)(?:\s*\|\s*([^}]*))?\s*\}\}/g, (_m, key: string, fallback?: string) => {
    const value = resolveContactField(contact, key).trim();
    return value || (fallback ?? '').trim();
  });
}

/** Build the ordered Meta template body parameters from a {"1": "first_name"} mapping. */
export function buildTemplateParams(
  variableMapping: Record<string, string>,
  contact: ContactLike,
): string[] {
  const keys = Object.keys(variableMapping).sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => {
    const source = variableMapping[k];
    // A literal value can be given as "=Diwali Sale"
    if (source.startsWith('=')) return source.slice(1);
    return resolveContactField(contact, source) || '-';
  });
}

/** Fill {{1}}, {{2}} in a Meta template body for previews / inbox display. */
export function fillTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_m, n: string) => params[Number(n) - 1] ?? `{{${n}}}`);
}

export const DEFAULT_STOP_KEYWORDS = [
  'stop', 'unsubscribe', 'stop all', 'opt out', 'optout', 'cancel',
  'band karo', 'band kro', 'mat bhejo', 'बंद करो', 'बंद',
];

/** True when an inbound message is an opt-out request (whole-message match, case/punctuation-insensitive). */
export function isStopMessage(text: string | null | undefined, keywords: string[] = DEFAULT_STOP_KEYWORDS): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/[.!?,\s]+/g, ' ').trim();
  return keywords.some((k) => normalized === k.toLowerCase());
}

export const DEFAULT_HANDOFF_KEYWORDS = ['agent', 'human', 'person', 'call me', 'talk to someone', 'complaint'];

export function wantsHuman(text: string | null | undefined, keywords: string[] = DEFAULT_HANDOFF_KEYWORDS): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return keywords.some((k) => t.includes(k.toLowerCase()));
}

// ─── Pacing / ban-protection maths ───

export interface PacingConfig {
  provider: 'meta_cloud' | 'web_qr';
  daily_limit: number | null;
  min_interval_sec: number | null;
  max_interval_sec: number | null;
  warmup_started_at: Date | string | null;
}

export const QR_DEFAULTS = { minInterval: 8, maxInterval: 20, warmupStart: 30, warmupStep: 20, ceiling: 250 };
export const META_DEFAULTS = { minInterval: 0.1, maxInterval: 0.5, dailyLimit: 1000 };

/** Daily send cap. QR numbers ramp up: 30 on day 1, +20/day, capped at 250 (or the tenant's lower limit). */
export function dailyCap(cfg: PacingConfig, now: Date = new Date()): number {
  if (cfg.provider === 'meta_cloud') {
    return cfg.daily_limit ?? META_DEFAULTS.dailyLimit;
  }
  const started = cfg.warmup_started_at ? new Date(cfg.warmup_started_at) : now;
  const day = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 86_400_000));
  const ramp = Math.min(QR_DEFAULTS.ceiling, QR_DEFAULTS.warmupStart + day * QR_DEFAULTS.warmupStep);
  return cfg.daily_limit != null ? Math.min(cfg.daily_limit, ramp) : ramp;
}

/** Warm-up day number (1-based) for display. */
export function warmupDay(cfg: PacingConfig, now: Date = new Date()): number {
  if (!cfg.warmup_started_at) return 1;
  return Math.floor((now.getTime() - new Date(cfg.warmup_started_at).getTime()) / 86_400_000) + 1;
}

/** Milliseconds to wait before the next send; random within [min, max]. `rand` injectable for tests. */
export function nextDelayMs(cfg: PacingConfig, rand: () => number = Math.random): number {
  const d = cfg.provider === 'meta_cloud' ? META_DEFAULTS : QR_DEFAULTS;
  const min = cfg.min_interval_sec ?? d.minInterval;
  const max = Math.max(min, cfg.max_interval_sec ?? d.maxInterval);
  return Math.round((min + (max - min) * rand()) * 1000);
}

export interface QuietHours { start: string; end: string; tz?: string }
export const DEFAULT_QUIET_HOURS: QuietHours = { start: '21:00', end: '09:00', tz: 'Asia/Kolkata' };

function minutesInTz(now: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** True when `now` falls in the quiet window (handles windows that cross midnight). */
export function isQuietTime(q: QuietHours | null | undefined, now: Date = new Date()): boolean {
  if (!q || !q.start || !q.end || q.start === q.end) return false;
  const cur = minutesInTz(now, q.tz || 'Asia/Kolkata');
  const s = toMinutes(q.start);
  const e = toMinutes(q.end);
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

/** Map a Meta webhook / Baileys receipt status onto our status ladder. Never moves backwards. */
const STATUS_RANK: Record<string, number> = { queued: 0, sending: 1, sent: 2, delivered: 3, read: 4 };
export function shouldAdvanceStatus(current: string, next: string): boolean {
  if (next === 'failed') return current !== 'read' && current !== 'delivered';
  const c = STATUS_RANK[current];
  const n = STATUS_RANK[next];
  if (n === undefined) return false;
  if (c === undefined) return current !== 'failed';
  return n > c;
}

/** Meta customer-service window: free-form messages only within 24h of the customer's last message. */
export function withinServiceWindow(lastInboundAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
}
