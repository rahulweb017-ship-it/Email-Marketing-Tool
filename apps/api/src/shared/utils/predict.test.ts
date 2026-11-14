import { describe, expect, it } from 'vitest';
import { predictContact } from './predict.js';

const now = new Date('2026-11-14T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('predictContact', () => {
  it('returns nulls without any sends', () => {
    expect(predictContact([], now)).toEqual({ predicted_engagement: null, churn_risk: null });
  });

  it('scores an engaged clicker high and low risk', () => {
    const traces = [1, 8, 15, 22, 29].map((d) => ({ sent_at: ago(d), first_open_at: ago(d - 0.5), first_click_at: ago(d - 0.5) }));
    const p = predictContact(traces, now);
    expect(p.predicted_engagement).toBeGreaterThanOrEqual(65);
    expect(p.churn_risk).toBeLessThanOrEqual(10);
  });

  it('flags someone who stopped opening months ago', () => {
    const traces = [
      ...[5, 12, 19, 26, 33, 40].map((d) => ({ sent_at: ago(d) })),
      { sent_at: ago(150), first_open_at: ago(149) },
    ];
    const p = predictContact(traces, now);
    expect(p.churn_risk).toBeGreaterThanOrEqual(80);
    expect(p.predicted_engagement).toBeLessThanOrEqual(15);
  });

  it('treats never-engaged contacts as high risk', () => {
    const p = predictContact([2, 9, 16].map((d) => ({ sent_at: ago(d) })), now);
    expect(p.churn_risk).toBeGreaterThanOrEqual(70);
  });

  it('marks a recent bounce as lost', () => {
    expect(predictContact([{ sent_at: ago(1), trace_status: 'bounced' }], now)).toEqual({ predicted_engagement: 0, churn_risk: 100 });
  });

  it('keeps a single unopened send moderate', () => {
    const p = predictContact([{ sent_at: ago(1) }, { sent_at: ago(10), first_open_at: ago(9) }], now);
    expect(p.churn_risk).toBeLessThan(50);
  });
});
