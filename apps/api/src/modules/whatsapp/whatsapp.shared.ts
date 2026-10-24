// Data-access helpers shared by the API, the worker and the whatsapp-gateway process.
import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { decryptString, encryptString } from '../../shared/utils/crypto.js';
import { createNotification } from '../notifications/notification.service.js';
import { MetaCloudProvider } from './providers/meta-cloud.provider.js';
import type { MetaCredentials } from './providers/types.js';

export const CREDENTIALS_SALT = 'whatsapp-credentials';
export const SESSION_SALT = 'whatsapp-session';

/** Columns safe to return to the browser (never credentials). */
export const ACCOUNT_PUBLIC_COLUMNS = [
  'id', 'org_id', 'provider', 'name', 'phone_e164', 'display_name', 'status', 'meta_phone_number_id',
  'daily_limit', 'min_interval_sec', 'max_interval_sec', 'quiet_hours', 'warmup_started_at',
  'last_seen_at', 'last_error', 'ai_enabled', 'ai_settings', 'created_at', 'updated_at',
];

export async function getAccountRow(orgId: string, accountId: string) {
  const account = await db('whatsapp_accounts').where({ id: accountId, org_id: orgId }).first();
  if (!account) throw new AppError(404, 'WhatsApp account not found');
  return account;
}

export function encryptCredentials(creds: MetaCredentials): string {
  return encryptString(JSON.stringify(creds), CREDENTIALS_SALT);
}

export function decryptCredentials(encrypted: string): MetaCredentials {
  return JSON.parse(decryptString(encrypted, CREDENTIALS_SALT));
}

export function metaProviderFor(account: { provider: string; credentials_encrypted: string | null }): MetaCloudProvider {
  if (account.provider !== 'meta_cloud' || !account.credentials_encrypted) {
    throw new AppError(400, 'This action needs a Meta Cloud API account');
  }
  return new MetaCloudProvider(decryptCredentials(account.credentials_encrypted));
}

/** India "today" key, so daily caps reset at local midnight. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now); // YYYY-MM-DD
}

export async function getSentToday(accountId: string): Promise<number> {
  return parseInt(await redis.get(`wa:sent:${accountId}:${todayKey()}`) || '0');
}

export async function incrementSentToday(accountId: string): Promise<void> {
  const key = `wa:sent:${accountId}:${todayKey()}`;
  await redis.incr(key);
  await redis.expire(key, 2 * 24 * 60 * 60);
}

export async function findContactIdByPhone(orgId: string, phoneE164: string): Promise<string | null> {
  const contact = await db('contacts').where({ org_id: orgId, phone_e164: phoneE164 }).select('id').first();
  return contact?.id ?? null;
}

/** Get or create the conversation thread for (account, phone). */
export async function upsertConversation(
  orgId: string,
  accountId: string,
  phoneE164: string,
  extra: { contact_id?: string | null; profile_name?: string | null } = {},
) {
  const existing = await db('whatsapp_conversations').where({ account_id: accountId, phone_e164: phoneE164 }).first();
  if (existing) {
    const updates: Record<string, unknown> = {};
    if (extra.profile_name && !existing.profile_name) updates.profile_name = extra.profile_name;
    if (extra.contact_id && !existing.contact_id) updates.contact_id = extra.contact_id;
    if (Object.keys(updates).length) {
      await db('whatsapp_conversations').where('id', existing.id).update({ ...updates, updated_at: new Date() });
      return { ...existing, ...updates };
    }
    return existing;
  }
  const contactId = extra.contact_id ?? await findContactIdByPhone(orgId, phoneE164);
  const [row] = await db('whatsapp_conversations')
    .insert({
      org_id: orgId,
      account_id: accountId,
      phone_e164: phoneE164,
      contact_id: contactId,
      profile_name: extra.profile_name ?? null,
    })
    .onConflict(['account_id', 'phone_e164'])
    .merge({ updated_at: new Date() })
    .returning('*');
  return row;
}

/** Stop an account from sending: pause it, pause its running campaigns, tell the tenant. */
export async function pauseAccount(accountId: string, reason: string, status: 'paused' | 'logged_out' | 'banned' | 'error' = 'paused') {
  const account = await db('whatsapp_accounts').where('id', accountId).first();
  if (!account) return;
  await db('whatsapp_accounts').where('id', accountId).update({ status, last_error: reason, updated_at: new Date() });
  const paused = await db('whatsapp_campaigns')
    .where({ account_id: accountId, state: 'sending' })
    .update({ state: 'paused', failure_reason: reason, updated_at: new Date() });
  await createNotification(account.org_id, {
    title: `WhatsApp number "${account.name}" was paused`,
    body: `${reason}${paused ? ` ${paused} running campaign(s) were paused.` : ''} Check the number's health before resuming.`,
    type: 'warning',
    link: '/whatsapp/accounts',
  }).catch(() => {});
}

/** Mark a sending campaign done once nothing is left queued or in flight. */
export async function maybeCompleteCampaign(campaignId: string) {
  const [{ count }] = await db('whatsapp_messages')
    .where('campaign_id', campaignId)
    .whereIn('status', ['queued', 'sending'])
    .count('id as count');
  if (Number(count) > 0) return;
  const campaign = await db('whatsapp_campaigns').where('id', campaignId).first();
  if (!campaign || campaign.state !== 'sending') return;
  const allFailed = campaign.stat_sent === 0 && campaign.stat_failed > 0;
  await db('whatsapp_campaigns').where('id', campaignId).update({
    state: allFailed ? 'failed' : 'done',
    completed_at: new Date(),
    failure_reason: allFailed ? 'Every message failed to send' : campaign.failure_reason,
    updated_at: new Date(),
  });
  await createNotification(campaign.org_id, {
    title: allFailed ? `WhatsApp campaign "${campaign.name}" failed` : `WhatsApp campaign "${campaign.name}" finished`,
    body: `${campaign.stat_sent} sent, ${campaign.stat_failed} failed.`,
    type: allFailed ? 'error' : 'success',
    link: `/whatsapp/campaigns/${campaign.id}`,
  }).catch(() => {});
}
