import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { parseMetaWebhook, verifyMetaSignature } from './whatsapp-webhook-parser.js';

describe('verifyMetaSignature', () => {
  const secret = 'app-secret';
  const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');

  it('accepts a valid signature', () => {
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });
  it('rejects a tampered body, wrong secret, or malformed header', () => {
    expect(verifyMetaSignature(Buffer.from('{"object":"x"}'), sig, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, 'other')).toBe(false);
    expect(verifyMetaSignature(body, 'sha256=zz', secret)).toBe(false);
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, '')).toBe(false);
  });
});

describe('parseMetaWebhook', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WABA1',
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '111' },
          contacts: [{ wa_id: '919876543210', profile: { name: 'Priya' } }],
          messages: [
            { from: '919876543210', id: 'wamid.in1', timestamp: '1760000000', type: 'text', text: { body: 'Price?' } },
            { from: '919876543210', id: 'wamid.in2', timestamp: '1760000001', type: 'image', image: { id: 'm1', mime_type: 'image/jpeg', caption: 'this one' } },
            { from: '919876543210', id: 'wamid.in3', timestamp: '1760000002', type: 'button', button: { text: 'Yes please' } },
          ],
          statuses: [
            { id: 'wamid.out1', status: 'delivered', timestamp: '1760000003' },
            { id: 'wamid.out2', status: 'failed', timestamp: '1760000004', errors: [{ code: 131026, title: 'Message undeliverable' }] },
          ],
        },
      }, {
        field: 'message_template_status_update',
        value: { event: 'APPROVED', message_template_name: 'diwali_offer', message_template_language: 'en', reason: 'NONE' },
      }],
    }],
  };

  it('normalizes messages, statuses and template updates', () => {
    const events = parseMetaWebhook(payload, (id) => (id === '111' ? 'acct-1' : undefined));
    expect(events).toHaveLength(6);
    expect(events[0]).toMatchObject({ kind: 'message', account_id: 'acct-1', from: '+919876543210', profile_name: 'Priya', body: 'Price?', type: 'text', timestamp: 1760000000000 });
    expect(events[1]).toMatchObject({ kind: 'message', type: 'image', body: 'this one', media: { type: 'image', id: 'm1' } });
    expect(events[2]).toMatchObject({ kind: 'message', type: 'text', body: 'Yes please' });
    expect(events[3]).toMatchObject({ kind: 'status', provider_message_id: 'wamid.out1', status: 'delivered' });
    expect(events[4]).toMatchObject({ kind: 'status', status: 'failed', error_code: 131026, error: 'Message undeliverable' });
    expect(events[5]).toMatchObject({ kind: 'template_status', waba_id: 'WABA1', name: 'diwali_offer', status: 'APPROVED', reason: null });
  });

  it('ignores numbers that are not connected', () => {
    expect(parseMetaWebhook(payload, () => undefined).filter((e) => e.kind !== 'template_status')).toHaveLength(0);
  });
});
