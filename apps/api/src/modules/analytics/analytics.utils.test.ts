import { describe, expect, it } from 'vitest';
import { clampDays, dayKeys, mergeRecent, rate, zeroFillDaily } from './analytics.utils.js';

describe('clampDays', () => {
  it('defaults and clamps', () => {
    expect(clampDays(undefined)).toBe(30);
    expect(clampDays('abc')).toBe(30);
    expect(clampDays('3')).toBe(7);
    expect(clampDays('9999')).toBe(365);
    expect(clampDays('90')).toBe(90);
  });
});

describe('dayKeys / zeroFillDaily', () => {
  const now = new Date('2026-03-10T06:00:00Z');
  it('returns one key per day ending today', () => {
    const keys = dayKeys(7, now, 'UTC');
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe('2026-03-04');
    expect(keys[6]).toBe('2026-03-10');
  });
  it('zero-fills missing days and series', () => {
    const keys = dayKeys(3, now, 'UTC');
    const rows = zeroFillDaily(keys, { emails: [{ day: '2026-03-09', count: '5' }], whatsapp: null }, ['emails', 'whatsapp'] as const);
    expect(rows).toEqual([
      { date: '2026-03-08', emails: 0, whatsapp: 0 },
      { date: '2026-03-09', emails: 5, whatsapp: 0 },
      { date: '2026-03-10', emails: 0, whatsapp: 0 },
    ]);
  });
});

describe('mergeRecent', () => {
  it('merges, drops invalid dates, sorts desc and limits', () => {
    const out = mergeRecent([
      [{ type: 'a', title: '1', subtitle: '', at: '2026-01-01T00:00:00Z' }],
      null,
      [{ type: 'b', title: '2', subtitle: '', at: '2026-02-01T00:00:00Z' }, { type: 'c', title: 'x', subtitle: '', at: '' }],
    ], 1);
    expect(out.map((i) => i.title)).toEqual(['2']);
  });
});

describe('rate', () => {
  it('is a percentage with 2 decimals and safe on zero', () => {
    expect(rate(1, 3)).toBe(33.33);
    expect(rate(5, 0)).toBe(0);
  });
});
