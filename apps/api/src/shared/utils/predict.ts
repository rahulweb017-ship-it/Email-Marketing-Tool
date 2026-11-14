// Predictive contact scores from email history: how likely a contact is to engage with the
// next email, and how likely they are to go quiet (churn). Pure so it can be unit tested.

export interface TraceLike {
  sent_at?: string | Date | null;
  first_open_at?: string | Date | null;
  last_open_at?: string | Date | null;
  first_click_at?: string | Date | null;
  trace_status?: string | null;
}

export interface Prediction {
  /** 0-100 chance-like score that the contact opens or clicks the next email. */
  predicted_engagement: number | null;
  /** 0-100 risk that the contact has stopped engaging. */
  churn_risk: number | null;
}

const DAY = 24 * 60 * 60 * 1000;
const time = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : null);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function predictContact(traces: TraceLike[], now = new Date()): Prediction {
  const sends = traces
    .filter((t) => t.sent_at)
    .sort((a, b) => time(b.sent_at)! - time(a.sent_at)!);
  if (sends.length === 0) return { predicted_engagement: null, churn_risk: null };
  if (sends.slice(0, 3).some((t) => t.trace_status === 'bounced')) return { predicted_engagement: 0, churn_risk: 100 };

  const engaged = (t: TraceLike) => !!(t.first_open_at || t.first_click_at);
  const lastEngaged = Math.max(
    ...traces.flatMap((t) => [time(t.first_open_at), time(t.last_open_at), time(t.first_click_at)]).filter((v): v is number => v !== null),
    -Infinity,
  );
  const daysSince = Number.isFinite(lastEngaged) ? (now.getTime() - lastEngaged) / DAY : null;

  // Recent behaviour, smoothed towards a 20% prior so 1-2 sends don't give extreme scores.
  const recent = sends.slice(0, 10);
  const weights = recent.map((_, i) => 1 - i * 0.06);
  const hit = recent.reduce((s, t, i) => s + (engaged(t) ? weights[i] : 0), 0);
  const clicks = recent.reduce((s, t, i) => s + (t.first_click_at ? weights[i] : 0), 0);
  const total = weights.reduce((s, w) => s + w, 0);
  const rate = (hit + 0.2 * 2) / (total + 2);
  const recency = daysSince === null ? 0.5 : Math.max(0.25, 1 - daysSince / 240);
  const predicted = rate * recency * 100 + Math.min(10, (clicks / total) * 20);

  // Consecutive latest sends with no open/click.
  let streak = 0;
  for (const t of sends) {
    if (engaged(t)) break;
    streak += 1;
  }
  const streakRisk = 1 - Math.exp(-streak / 3);
  const silenceRisk = daysSince === null ? 1 : Math.min(1, daysSince / 120);
  const churn = (0.6 * streakRisk + 0.4 * silenceRisk) * 100;

  return { predicted_engagement: clamp(predicted), churn_risk: clamp(churn) };
}
