// Send-time optimisation maths. Pure so it can be unit tested.

/** Fewer opens than this and the contact's history is treated as noise. */
export const MIN_OPENS_FOR_BEST_HOUR = 2;

/**
 * The UTC hour a contact most often opens email, smoothed so neighbouring hours count
 * half (an open at 9:58 and one at 10:03 should reinforce each other). Null when there
 * is too little history.
 */
export function bestSendHour(openTimes: Array<Date | string | null | undefined>): number | null {
  const hours = openTimes
    .filter((t): t is Date | string => !!t)
    .map((t) => new Date(t).getUTCHours())
    .filter((h) => Number.isInteger(h));
  if (hours.length < MIN_OPENS_FOR_BEST_HOUR) return null;

  const counts = new Array<number>(24).fill(0);
  for (const h of hours) counts[h]++;
  let best = 0;
  let bestScore = -1;
  for (let h = 0; h < 24; h++) {
    const score = counts[h] + 0.5 * (counts[(h + 23) % 24] + counts[(h + 1) % 24]);
    if (score > bestScore) { best = h; bestScore = score; }
  }
  return best;
}

/** Milliseconds from `now` until the next time the clock reads `hour`:00 UTC (0 if we are inside that hour). */
export function delayUntilHour(now: Date, hour: number): number {
  if (now.getUTCHours() === hour) return 0;
  const target = new Date(now);
  target.setUTCHours(hour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - now.getTime();
}

/** Groups recipients by the hour they should get the email; contacts without history use the fallback hour, or go now. */
export function groupBySendHour<T extends { best_send_hour?: number | null }>(recipients: T[], fallbackHour: number | null): Map<number | null, T[]> {
  const groups = new Map<number | null, T[]>();
  for (const r of recipients) {
    const h = r.best_send_hour ?? fallbackHour;
    const key = h === null || h === undefined ? null : h;
    const list = groups.get(key) || [];
    list.push(r);
    groups.set(key, list);
  }
  return groups;
}
