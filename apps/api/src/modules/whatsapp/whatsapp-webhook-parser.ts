// Pure Meta webhook parsing + signature verification (no DB/Redis imports — unit tested).
import crypto from 'crypto';
import { waIdToE164 } from '../../shared/utils/phone.js';

/** Constant-time check of Meta's X-Hub-Signature-256 header against the raw request body. */
export function verifyMetaSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header || !appSecret || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const given = header.slice(7);
  if (given.length !== expected.length || !/^[0-9a-f]+$/i.test(given)) return false;
  return crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
}

export type InboundEvent =
  | {
    kind: 'message';
    account_id: string;
    from: string; // E.164
    profile_name?: string | null;
    provider_message_id: string;
    type: string;
    body?: string | null;
    media?: Record<string, unknown> | null;
    timestamp: number; // ms
  }
  | {
    kind: 'status';
    account_id: string;
    provider_message_id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    error?: string | null;
    error_code?: number | null;
    timestamp: number;
  }
  | {
    kind: 'template_status';
    waba_id: string;
    name: string;
    language?: string;
    status: string;
    reason?: string | null;
  };

/** Turn a Meta webhook payload into normalized events. `accountFor` maps phone_number_id -> account id. */
export function parseMetaWebhook(
  payload: any,
  accountFor: (phoneNumberId: string) => string | undefined,
): InboundEvent[] {
  const events: InboundEvent[] = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      if (change.field === 'message_template_status_update') {
        events.push({
          kind: 'template_status',
          waba_id: String(entry.id),
          name: value.message_template_name,
          language: value.message_template_language,
          status: value.event,
          reason: value.reason && value.reason !== 'NONE' ? value.reason : null,
        });
        continue;
      }
      if (change.field !== 'messages') continue;
      const accountId = accountFor(String(value.metadata?.phone_number_id || ''));
      if (!accountId) continue;

      const names = new Map<string, string>();
      for (const c of value.contacts || []) names.set(c.wa_id, c.profile?.name);

      for (const m of value.messages || []) {
        const type: string = m.type;
        let body: string | null = null;
        let media: Record<string, unknown> | null = null;
        if (type === 'text') body = m.text?.body ?? null;
        else if (type === 'button') body = m.button?.text ?? null;
        else if (type === 'interactive') body = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
        else if (['image', 'video', 'document', 'audio', 'sticker'].includes(type)) {
          const obj = m[type] || {};
          media = { type, id: obj.id, mime: obj.mime_type, filename: obj.filename };
          body = obj.caption ?? null;
        } else if (type === 'location') {
          body = `Location: ${m.location?.latitude}, ${m.location?.longitude}`;
        }
        events.push({
          kind: 'message',
          account_id: accountId,
          from: waIdToE164(m.from),
          profile_name: names.get(m.from) ?? null,
          provider_message_id: m.id,
          type: ['text', 'image', 'video', 'document', 'audio'].includes(type) ? type : (body ? 'text' : 'other'),
          body,
          media,
          timestamp: Number(m.timestamp) * 1000,
        });
      }

      for (const s of value.statuses || []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(s.status)) continue;
        const err = s.errors?.[0];
        events.push({
          kind: 'status',
          account_id: accountId,
          provider_message_id: s.id,
          status: s.status,
          error: err ? (err.error_data?.details || err.title || err.message) : null,
          error_code: err?.code ?? null,
          timestamp: Number(s.timestamp) * 1000,
        });
      }
    }
  }
  return events;
}

