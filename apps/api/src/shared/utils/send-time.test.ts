import { describe, it, expect } from 'vitest';
import { bestSendHour, delayUntilHour, groupBySendHour } from './send-time.js';

describe('bestSendHour', () => {
  it('needs at least two opens', () => {
    expect(bestSendHour([])).toBeNull();
    expect(bestSendHour(['2026-01-01T09:00:00Z', null])).toBeNull();
  });

  it('picks the most common hour, helped by neighbours', () => {
    expect(bestSendHour(['2026-01-01T09:10:00Z', '2026-01-02T09:40:00Z', '2026-01-03T18:00:00Z'])).toBe(9);
    // 10 alone once, but 9 and 11 around it make 10 the centre
    expect(bestSendHour(['2026-01-01T09:00:00Z', '2026-01-02T10:00:00Z', '2026-01-03T11:00:00Z', '2026-01-04T20:00:00Z'])).toBe(10);
  });

  it('wraps around midnight', () => {
    expect(bestSendHour(['2026-01-01T23:30:00Z', '2026-01-02T00:10:00Z', '2026-01-03T00:20:00Z'])).toBe(0);
  });
});

describe('delayUntilHour', () => {
  const now = new Date('2026-03-10T08:30:00Z');
  it('is zero inside the hour', () => expect(delayUntilHour(now, 8)).toBe(0));
  it('waits for later today', () => expect(delayUntilHour(now, 10)).toBe(90 * 60 * 1000));
  it('rolls to tomorrow', () => expect(delayUntilHour(now, 7)).toBe(22.5 * 60 * 60 * 1000));
});

describe('groupBySendHour', () => {
  it('uses the fallback for contacts without history', () => {
    const g = groupBySendHour([{ id: 1, best_send_hour: 9 }, { id: 2, best_send_hour: null }, { id: 3 }], 14);
    expect(g.get(9)?.length).toBe(1);
    expect(g.get(14)?.length).toBe(2);
  });
  it('sends now when there is no fallback', () => {
    const g = groupBySendHour([{ id: 1, best_send_hour: null }], null);
    expect(g.get(null)?.length).toBe(1);
  });
});
