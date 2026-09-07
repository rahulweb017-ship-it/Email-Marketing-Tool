import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/** Generate HMAC token for tracking URLs (mirrors Odoo's _generate_mailing_recipient_token) */
export function generateTraceToken(traceId: string): string {
  return crypto
    .createHmac('sha256', env.HMAC_SECRET)
    .update(traceId)
    .digest('hex')
    .substring(0, 32);
}

/** Generate HMAC token for unsubscribe links */
export function generateUnsubscribeToken(campaignId: string, contactId: string, email: string): string {
  const data = `${campaignId}:${contactId}:${email}`;
  return crypto
    .createHmac('sha256', env.HMAC_SECRET)
    .update(data)
    .digest('hex');
}

/** Timing-safe string comparison (mirrors werkzeug's consteq) */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
