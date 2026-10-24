import { describe, expect, it } from 'vitest';
import { e164ToWaId, toE164, waIdToE164 } from './phone.js';

describe('toE164', () => {
  it('normalizes common Indian formats', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('098765-43210')).toBe('+919876543210');
    expect(toE164('+91 98765 43210')).toBe('+919876543210');
    expect(toE164('0091 9876543210')).toBe('+919876543210');
    expect(toE164('919876543210')).toBe('+919876543210');
  });

  it('uses the contact country when given', () => {
    expect(toE164('(415) 555-2671', 'US')).toBe('+14155552671');
  });

  it('rejects junk', () => {
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164('12345')).toBeNull();
    expect(toE164('not a phone')).toBeNull();
  });
});

describe('WhatsApp id conversion', () => {
  it('round-trips', () => {
    expect(e164ToWaId('+919876543210')).toBe('919876543210');
    expect(waIdToE164('919876543210@s.whatsapp.net')).toBe('+919876543210');
    expect(waIdToE164('919876543210:12@s.whatsapp.net')).toBe('+919876543210');
  });
});
