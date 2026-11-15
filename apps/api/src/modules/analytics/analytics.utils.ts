export const HUB_TZ = 'Asia/Kolkata';

export function clampDays(raw: unknown, def = 30, min = 7, max = 365): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function localDay(date: Date, tz = HUB_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
}

/** Calendar days (oldest first) ending at `now`, in the hub timezone. */
export function dayKeys(days: number, now = new Date(), tz = HUB_TZ): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(localDay(new Date(now.getTime() - i * 86_400_000), tz));
  return keys;
}

export function zeroFillDaily<K extends string>(keys: string[], series: Partial<Record<K, Array<{ day: string; count: unknown }> | null>>, names: readonly K[]) {
  const maps = Object.fromEntries(names.map((name) => {
    const rows = series[name] ?? [];
    return [name, new Map(rows.map((r) => [String(r.day), Number(r.count) || 0]))];
  })) as Record<K, Map<string, number>>;
  return keys.map((date) => {
    const row = { date } as { date: string } & Record<K, number>;
    for (const name of names) (row as Record<string, unknown>)[name] = maps[name].get(date) ?? 0;
    return row;
  });
}

export interface RecentItem { type: string; title: string; subtitle: string; at: string }

export function mergeRecent(groups: Array<RecentItem[] | null | undefined>, limit = 15): RecentItem[] {
  return groups
    .flatMap((g) => g ?? [])
    .filter((i) => i.at && !Number.isNaN(new Date(i.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export function rate(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 10000) / 100 : 0;
}
