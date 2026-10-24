import { describe, expect, it } from 'vitest';
import {
  buildTemplateParams, dailyCap, fillTemplateBody, isQuietTime, isStopMessage, nextDelayMs, renderMessage,
  shouldAdvanceStatus, wantsHuman, withinServiceWindow, type PacingConfig,
} from './whatsapp.utils.js';

const contact = { first_name: 'Priya', last_name: 'Sharma', company_name: '', custom_fields: { city: 'Pune' } };

describe('renderMessage', () => {
  it('fills contact and custom fields', () => {
    expect(renderMessage('Hi {{first_name}} from {{ custom.city }}!', contact)).toBe('Hi Priya from Pune!');
  });
  it('uses the fallback when a value is empty or missing', () => {
    expect(renderMessage('Hello {{company_name|there}}', contact)).toBe('Hello there');
    expect(renderMessage('Hello {{nickname|friend}}', contact)).toBe('Hello friend');
  });
  it('accepts custom_fields as a JSON string', () => {
    expect(renderMessage('{{custom.city}}', { custom_fields: '{"city":"Delhi"}' })).toBe('Delhi');
  });
});

describe('Meta template params', () => {
  it('orders params numerically and supports literals', () => {
    const params = buildTemplateParams({ '2': '=DIWALI20', '1': 'first_name', '10': 'custom.city' }, contact);
    expect(params).toEqual(['Priya', 'DIWALI20', 'Pune']);
  });
  it('never sends an empty parameter (Meta rejects them)', () => {
    expect(buildTemplateParams({ '1': 'company_name' }, contact)).toEqual(['-']);
  });
  it('fills a template body for previews', () => {
    expect(fillTemplateBody('Hi {{1}}, use {{2}}', ['Priya', 'CODE'])).toBe('Hi Priya, use CODE');
    expect(fillTemplateBody('Hi {{1}} {{3}}', ['Priya'])).toBe('Hi Priya {{3}}');
  });
});

describe('STOP and handoff detection', () => {
  it('matches whole-message opt-outs in English and Hindi', () => {
    for (const t of ['STOP', 'stop.', ' Unsubscribe ', 'band karo', 'बंद करो']) expect(isStopMessage(t)).toBe(true);
  });
  it('does not treat normal sentences as opt-outs', () => {
    for (const t of ["don't stop the offers", 'when does the bus stop', '', null]) expect(isStopMessage(t)).toBe(false);
  });
  it('honours custom keywords', () => {
    expect(isStopMessage('nahi chahiye', ['nahi chahiye'])).toBe(true);
  });
  it('detects requests for a person', () => {
    expect(wantsHuman('Can I talk to an agent?')).toBe(true);
    expect(wantsHuman('What is the price?')).toBe(false);
  });
});

describe('pacing', () => {
  const now = new Date('2026-10-10T06:00:00Z');
  const qr = (over: Partial<PacingConfig> = {}): PacingConfig => ({
    provider: 'web_qr', daily_limit: null, min_interval_sec: null, max_interval_sec: null, warmup_started_at: now, ...over,
  });
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it('ramps QR numbers up from 30/day by 20/day to a 250 ceiling', () => {
    expect(dailyCap(qr(), now)).toBe(30);
    expect(dailyCap(qr({ warmup_started_at: daysAgo(1) }), now)).toBe(50);
    expect(dailyCap(qr({ warmup_started_at: daysAgo(5) }), now)).toBe(130);
    expect(dailyCap(qr({ warmup_started_at: daysAgo(60) }), now)).toBe(250);
  });

  it('never lets a tenant limit exceed the warm-up ramp on QR numbers', () => {
    expect(dailyCap(qr({ daily_limit: 1000 }), now)).toBe(30);
    expect(dailyCap(qr({ daily_limit: 10, warmup_started_at: daysAgo(60) }), now)).toBe(10);
  });

  it('uses the Meta tier limit for Cloud API numbers', () => {
    expect(dailyCap({ ...qr(), provider: 'meta_cloud' }, now)).toBe(1000);
    expect(dailyCap({ ...qr(), provider: 'meta_cloud', daily_limit: 10000 }, now)).toBe(10000);
  });

  it('waits 8-20s between QR messages by default', () => {
    expect(nextDelayMs(qr(), () => 0)).toBe(8000);
    expect(nextDelayMs(qr(), () => 1)).toBe(20000);
    expect(nextDelayMs(qr({ min_interval_sec: 30, max_interval_sec: 10 }), () => 1)).toBe(30000);
  });
});

describe('quiet hours', () => {
  const q = { start: '21:00', end: '09:00', tz: 'Asia/Kolkata' };
  it('handles windows that cross midnight (IST)', () => {
    expect(isQuietTime(q, new Date('2026-10-10T17:00:00Z'))).toBe(true); // 22:30 IST
    expect(isQuietTime(q, new Date('2026-10-10T02:00:00Z'))).toBe(true); // 07:30 IST
    expect(isQuietTime(q, new Date('2026-10-10T06:00:00Z'))).toBe(false); // 11:30 IST
  });
  it('handles same-day windows and disabled windows', () => {
    expect(isQuietTime({ start: '13:00', end: '14:00', tz: 'Asia/Kolkata' }, new Date('2026-10-10T08:00:00Z'))).toBe(true); // 13:30 IST
    expect(isQuietTime(null)).toBe(false);
    expect(isQuietTime({ start: '09:00', end: '09:00' })).toBe(false);
  });
});

describe('status ladder', () => {
  it('only moves forward', () => {
    expect(shouldAdvanceStatus('sent', 'delivered')).toBe(true);
    expect(shouldAdvanceStatus('sent', 'read')).toBe(true);
    expect(shouldAdvanceStatus('read', 'delivered')).toBe(false);
    expect(shouldAdvanceStatus('delivered', 'sent')).toBe(false);
  });
  it('does not mark delivered or read messages as failed', () => {
    expect(shouldAdvanceStatus('sent', 'failed')).toBe(true);
    expect(shouldAdvanceStatus('delivered', 'failed')).toBe(false);
    expect(shouldAdvanceStatus('failed', 'delivered')).toBe(false);
  });
});

describe('24h service window', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  it('is open for 24h after the last customer message', () => {
    expect(withinServiceWindow(new Date('2026-10-09T13:00:00Z'), now)).toBe(true);
    expect(withinServiceWindow(new Date('2026-10-09T11:00:00Z'), now)).toBe(false);
    expect(withinServiceWindow(null, now)).toBe(false);
  });
});
