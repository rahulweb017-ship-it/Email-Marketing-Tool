// Pure helpers for social publishing (queue slot maths + per-platform validation).
// No DB / env imports so they stay unit-testable.

export interface QueueSlot {
  day_of_week: number;
  time_of_day: string;
}

export const DEFAULT_QUEUE_TIMES = ['09:00', '13:00', '17:00'];
export const DEFAULT_QUEUE_TIMEZONE = 'Asia/Kolkata';

export function defaultQueueSlots(): QueueSlot[] {
  const slots: QueueSlot[] = [];
  for (let d = 0; d < 7; d++) for (const t of DEFAULT_QUEUE_TIMES) slots.push({ day_of_week: d, time_of_day: t });
  return slots;
}

export const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function zonedParts(utcMs: number, tz: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  return {
    year: Number(p.year), month0: Number(p.month) - 1, day: Number(p.day),
    hour: Number(p.hour) % 24, minute: Number(p.minute), second: Number(p.second),
  };
}

/** Offset (ms) of `tz` from UTC at the given instant. */
export function timeZoneOffsetMs(utcMs: number, tz: string): number {
  const base = Math.floor(utcMs / 1000) * 1000;
  const p = zonedParts(base, tz);
  return Date.UTC(p.year, p.month0, p.day, p.hour, p.minute, p.second) - base;
}

/** Convert a wall-clock time in `tz` to a UTC timestamp (ms). */
export function zonedWallTimeToUtc(year: number, month0: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month0, day, hour, minute);
  const off1 = timeZoneOffsetMs(guess, tz);
  let result = guess - off1;
  const off2 = timeZoneOffsetMs(result, tz);
  if (off2 !== off1) result = guess - off2;
  return result;
}

/**
 * Next queue slot strictly after `after` that is not already taken.
 * Slots are wall-clock times in `timezone`; `taken` holds instants already used
 * by other scheduled posts (compared at minute precision).
 */
export function nextQueueSlot(opts: {
  slots: QueueSlot[];
  timezone: string;
  after: Date;
  taken?: Array<Date | number | string>;
  horizonDays?: number;
}): Date | null {
  const tz = isValidTimeZone(opts.timezone) ? opts.timezone : DEFAULT_QUEUE_TIMEZONE;
  const horizon = opts.horizonDays ?? 56;
  const afterMs = opts.after.getTime();
  const taken = new Set((opts.taken || []).map((t) => Math.floor(new Date(t).getTime() / 60000)));

  const byDay = new Map<number, number[]>();
  for (const s of opts.slots || []) {
    if (!TIME_OF_DAY_RE.test(s.time_of_day) || s.day_of_week < 0 || s.day_of_week > 6) continue;
    const [h, m] = s.time_of_day.split(':').map(Number);
    const list = byDay.get(s.day_of_week) || [];
    const mins = h * 60 + m;
    if (!list.includes(mins)) list.push(mins);
    byDay.set(s.day_of_week, list);
  }
  if (byDay.size === 0) return null;
  for (const list of byDay.values()) list.sort((a, b) => a - b);

  const start = zonedParts(afterMs, tz);
  for (let i = 0; i <= horizon; i++) {
    const day = new Date(Date.UTC(start.year, start.month0, start.day + i));
    const mins = byDay.get(day.getUTCDay());
    if (!mins) continue;
    for (const mm of mins) {
      const t = zonedWallTimeToUtc(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Math.floor(mm / 60), mm % 60, tz);
      if (t <= afterMs) continue;
      if (taken.has(Math.floor(t / 60000))) continue;
      return new Date(t);
    }
  }
  return null;
}

// ─── Platform rules ───

export const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'X (Twitter)', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
  youtube: 'YouTube', threads: 'Threads', pinterest: 'Pinterest',
};

export const PLATFORM_CHARACTER_LIMITS: Record<string, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  youtube: 5000,
  threads: 500,
  pinterest: 500,
};

export const FIRST_COMMENT_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'youtube'];

export type MediaKind = 'image' | 'video' | 'gif';

export function validatePostForPlatforms(
  targets: Array<{ platform: string; content: string }>,
  media: Array<{ type: string }>,
): string[] {
  const errors: string[] = [];
  const images = media.filter((m) => m.type === 'image' || m.type === 'gif').length;
  const videos = media.filter((m) => m.type === 'video').length;
  const seen = new Set<string>();
  for (const t of targets) {
    const label = PLATFORM_LABELS[t.platform] || t.platform;
    const text = t.content || '';
    const limit = PLATFORM_CHARACTER_LIMITS[t.platform];
    const key = `${t.platform}:${text.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!text.trim() && media.length === 0) errors.push(`${label}: write something or add media`);
    if (limit && text.length > limit) errors.push(`${label} allows up to ${limit} characters (this post has ${text.length})`);
    if (t.platform === 'instagram' && images + videos === 0) errors.push('Instagram needs an image or a video');
    if (t.platform === 'instagram' && videos > 0 && media.length > 1) errors.push('Instagram: a video must be posted on its own');
    if (t.platform === 'youtube' && videos !== 1) errors.push('YouTube needs exactly one video');
    if (t.platform === 'pinterest' && images === 0) errors.push('Pinterest needs an image');
    if (t.platform === 'twitter' && media.length > 4) errors.push('X allows up to 4 media items');
  }
  return errors;
}
