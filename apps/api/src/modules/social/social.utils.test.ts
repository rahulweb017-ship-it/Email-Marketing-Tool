import { describe, it, expect } from 'vitest';
import {
  nextQueueSlot, zonedWallTimeToUtc, timeZoneOffsetMs, validatePostForPlatforms, defaultQueueSlots, isValidTimeZone,
} from './social.utils.js';

describe('zonedWallTimeToUtc', () => {
  it('converts Asia/Kolkata wall time (UTC+5:30)', () => {
    const t = zonedWallTimeToUtc(2026, 0, 5, 9, 0, 'Asia/Kolkata');
    expect(new Date(t).toISOString()).toBe('2026-01-05T03:30:00.000Z');
  });
  it('handles DST in America/New_York', () => {
    expect(new Date(zonedWallTimeToUtc(2026, 0, 15, 9, 0, 'America/New_York')).toISOString()).toBe('2026-01-15T14:00:00.000Z');
    expect(new Date(zonedWallTimeToUtc(2026, 6, 15, 9, 0, 'America/New_York')).toISOString()).toBe('2026-07-15T13:00:00.000Z');
  });
  it('reports offsets', () => {
    expect(timeZoneOffsetMs(Date.UTC(2026, 0, 1), 'UTC')).toBe(0);
    expect(timeZoneOffsetMs(Date.UTC(2026, 0, 1), 'Asia/Kolkata')).toBe(330 * 60000);
  });
});

describe('nextQueueSlot', () => {
  // 2026-01-05 is a Monday
  const monday = 1;
  it('returns the next slot later the same day', () => {
    const r = nextQueueSlot({
      slots: [{ day_of_week: monday, time_of_day: '09:00' }, { day_of_week: monday, time_of_day: '17:00' }],
      timezone: 'Asia/Kolkata',
      after: new Date('2026-01-05T05:00:00Z'), // 10:30 IST
    });
    expect(r?.toISOString()).toBe('2026-01-05T11:30:00.000Z'); // 17:00 IST
  });
  it('skips taken slots', () => {
    const r = nextQueueSlot({
      slots: [{ day_of_week: monday, time_of_day: '09:00' }, { day_of_week: monday, time_of_day: '17:00' }],
      timezone: 'Asia/Kolkata',
      after: new Date('2026-01-05T00:00:00Z'),
      taken: ['2026-01-05T03:30:00Z'],
    });
    expect(r?.toISOString()).toBe('2026-01-05T11:30:00.000Z');
  });
  it('rolls over to the following week', () => {
    const r = nextQueueSlot({
      slots: [{ day_of_week: monday, time_of_day: '09:00' }],
      timezone: 'Asia/Kolkata',
      after: new Date('2026-01-05T04:00:00Z'),
    });
    expect(r?.toISOString()).toBe('2026-01-12T03:30:00.000Z');
  });
  it('uses the local date in the timezone, not UTC', () => {
    // 2026-01-05T20:00Z is already Tuesday 01:30 in Kolkata
    const r = nextQueueSlot({
      slots: [{ day_of_week: 2, time_of_day: '09:00' }],
      timezone: 'Asia/Kolkata',
      after: new Date('2026-01-05T20:00:00Z'),
    });
    expect(r?.toISOString()).toBe('2026-01-06T03:30:00.000Z');
  });
  it('returns null when there are no valid slots', () => {
    expect(nextQueueSlot({ slots: [{ day_of_week: 1, time_of_day: '25:00' }], timezone: 'UTC', after: new Date() })).toBeNull();
  });
  it('returns null when every slot within the horizon is taken', () => {
    const r = nextQueueSlot({
      slots: [{ day_of_week: monday, time_of_day: '09:00' }],
      timezone: 'UTC',
      after: new Date('2026-01-04T00:00:00Z'),
      taken: ['2026-01-05T09:00:00Z', '2026-01-12T09:00:00Z'],
      horizonDays: 10,
    });
    expect(r).toBeNull();
  });
  it('falls back to the default timezone for an invalid one', () => {
    const r = nextQueueSlot({ slots: [{ day_of_week: monday, time_of_day: '09:00' }], timezone: 'Not/AZone', after: new Date('2026-01-05T00:00:00Z') });
    expect(r?.toISOString()).toBe('2026-01-05T03:30:00.000Z');
  });
  it('default slots cover every day', () => {
    expect(defaultQueueSlots()).toHaveLength(21);
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Nope/Nope')).toBe(false);
  });
});

describe('validatePostForPlatforms', () => {
  it('requires media for Instagram, video for YouTube, image for Pinterest', () => {
    const errs = validatePostForPlatforms(
      [{ platform: 'instagram', content: 'hi' }, { platform: 'youtube', content: 'hi' }, { platform: 'pinterest', content: 'hi' }],
      [],
    );
    expect(errs).toHaveLength(3);
  });
  it('accepts valid combinations', () => {
    expect(validatePostForPlatforms([{ platform: 'youtube', content: 'Title' }], [{ type: 'video' }])).toEqual([]);
    expect(validatePostForPlatforms([{ platform: 'pinterest', content: 'x' }, { platform: 'instagram', content: 'x' }], [{ type: 'image' }])).toEqual([]);
  });
  it('enforces character limits per platform', () => {
    const errs = validatePostForPlatforms([{ platform: 'twitter', content: 'a'.repeat(281) }, { platform: 'linkedin', content: 'a'.repeat(281) }], []);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('280');
  });
  it('rejects empty posts', () => {
    expect(validatePostForPlatforms([{ platform: 'facebook', content: '  ' }], [])).toHaveLength(1);
  });
});
