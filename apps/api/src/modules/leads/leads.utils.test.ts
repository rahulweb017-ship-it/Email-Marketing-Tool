import { describe, expect, it } from 'vitest';
import { mapWebhookPayload, splitName, temperatureFor, isValidEmail } from './leads.utils.js';

describe('mapWebhookPayload', () => {
  it('maps common ad-platform field names', () => {
    const lead = mapWebhookPayload({
      full_name: 'Asha Rao', email_address: 'ASHA@Example.com', phone_number: '+91 98765 43210',
      campaign_name: 'Diwali leads', leadgen_id: 12345, source: 'Ads', comments: 'Need a quote',
    });
    expect(lead).toMatchObject({
      name: 'Asha Rao', email: 'asha@example.com', phone: '+91 98765 43210', source: 'ads',
      source_detail: 'Diwali leads', external_ref: '12345', message: 'Need a quote',
    });
  });

  it('joins first and last name and defaults the source to api', () => {
    expect(mapWebhookPayload({ first_name: 'Ravi', last_name: 'K' })).toMatchObject({ name: 'Ravi K', source: 'api' });
  });

  it('rejects unknown or manual sources', () => {
    expect(mapWebhookPayload({ source: 'manual' }).source).toBe('api');
    expect(mapWebhookPayload({ source: 'fax' }).source).toBe('api');
    expect(mapWebhookPayload({ source: 'social' }).source).toBe('social');
  });

  it('ignores non-object bodies and blank values', () => {
    expect(mapWebhookPayload(null)).toMatchObject({ source: 'api', name: undefined });
    expect(mapWebhookPayload({ email: '   ' }).email).toBeUndefined();
  });
});

describe('helpers', () => {
  it('splits names', () => {
    expect(splitName('Asha Rao Kumar')).toEqual({ first_name: 'Asha', last_name: 'Rao Kumar' });
    expect(splitName('Asha')).toEqual({ first_name: 'Asha', last_name: undefined });
    expect(splitName('')).toEqual({});
  });

  it('buckets scores', () => {
    expect(temperatureFor(85)).toBe('hot');
    expect(temperatureFor(40)).toBe('warm');
    expect(temperatureFor(10)).toBe('cold');
  });

  it('checks emails', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
  });
});
