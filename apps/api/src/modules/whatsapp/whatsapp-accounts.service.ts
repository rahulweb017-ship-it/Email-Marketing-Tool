import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { whatsappSessionQueue } from '../../config/queue.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { safeQueueAdd } from '../../shared/utils/queue-helper.js';
import { toE164 } from '../../shared/utils/phone.js';
import { getOrgLimits } from '../usage/usage.service.js';
import { MetaCloudProvider } from './providers/meta-cloud.provider.js';
import { WhatsAppApiError } from './providers/types.js';
import {
  ACCOUNT_PUBLIC_COLUMNS, encryptCredentials, getAccountRow, getSentToday, metaProviderFor,
} from './whatsapp.shared.js';
import { dailyCap, warmupDay } from './whatsapp.utils.js';
import type { CreateAccountInput, CreateTemplateInput, UpdateAccountInput } from './whatsapp.schema.js';

function withHealth<T extends Record<string, any>>(account: T, sentToday: number) {
  const cfg = {
    provider: account.provider,
    daily_limit: account.daily_limit,
    min_interval_sec: account.min_interval_sec,
    max_interval_sec: account.max_interval_sec,
    warmup_started_at: account.warmup_started_at,
  };
  return {
    ...account,
    sent_today: sentToday,
    daily_cap: dailyCap(cfg),
    warmup_day: account.provider === 'web_qr' ? warmupDay(cfg) : null,
  };
}

export async function listAccounts(orgId: string) {
  const accounts = await db('whatsapp_accounts').where('org_id', orgId).orderBy('created_at', 'asc').select(ACCOUNT_PUBLIC_COLUMNS);
  return Promise.all(accounts.map(async (a) => withHealth(a, await getSentToday(a.id))));
}

export async function getAccount(orgId: string, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  const pub = Object.fromEntries(ACCOUNT_PUBLIC_COLUMNS.map((c) => [c, account[c]]));
  return withHealth(pub, await getSentToday(accountId));
}

async function assertAccountLimit(orgId: string) {
  const limits = await getOrgLimits(orgId);
  const [{ count }] = await db('whatsapp_accounts').where('org_id', orgId).count('id as count');
  if (Number(count) >= limits.max_whatsapp_accounts) {
    throw new AppError(402, `WhatsApp number limit reached (${limits.max_whatsapp_accounts}). Upgrade your plan to connect more numbers.`);
  }
}

export async function createAccount(orgId: string, userId: string, input: CreateAccountInput) {
  await assertAccountLimit(orgId);

  if (input.provider === 'meta_cloud') {
    const creds = { access_token: input.access_token, phone_number_id: input.phone_number_id, waba_id: input.waba_id };
    let details;
    try {
      details = await new MetaCloudProvider(creds).verify();
    } catch (err) {
      const msg = err instanceof WhatsAppApiError ? err.message : 'Could not reach Meta';
      throw new AppError(400, `Meta rejected these credentials: ${msg}`);
    }
    const dupe = await db('whatsapp_accounts').where({ meta_phone_number_id: input.phone_number_id }).first();
    if (dupe) throw new AppError(409, 'This WhatsApp number is already connected');

    const [row] = await db('whatsapp_accounts').insert({
      org_id: orgId,
      provider: 'meta_cloud',
      name: input.name,
      phone_e164: toE164(details.display_phone_number, 'IN'),
      display_name: details.verified_name,
      status: 'connected',
      credentials_encrypted: encryptCredentials(creds),
      meta_phone_number_id: input.phone_number_id,
      last_seen_at: new Date(),
      created_by: userId,
    }).returning('id');
    await syncTemplates(orgId, row.id).catch((err) => console.warn('WhatsApp template sync failed:', err.message));
    return getAccount(orgId, row.id);
  }

  const [row] = await db('whatsapp_accounts').insert({
    org_id: orgId,
    provider: 'web_qr',
    name: input.name,
    status: 'pending_qr',
    created_by: userId,
  }).returning('id');
  await safeQueueAdd(whatsappSessionQueue, 'connect', { account_id: row.id });
  return getAccount(orgId, row.id);
}

export async function updateAccount(orgId: string, accountId: string, input: UpdateAccountInput) {
  const account = await getAccountRow(orgId, accountId);
  const updates: Record<string, unknown> = { updated_at: new Date() };
  for (const key of ['name', 'daily_limit', 'min_interval_sec', 'max_interval_sec', 'ai_enabled'] as const) {
    if (input[key] !== undefined) updates[key] = input[key];
  }
  if (input.quiet_hours !== undefined) updates.quiet_hours = input.quiet_hours ? JSON.stringify(input.quiet_hours) : null;
  if (input.ai_settings) {
    const current = typeof account.ai_settings === 'string' ? JSON.parse(account.ai_settings) : (account.ai_settings || {});
    updates.ai_settings = JSON.stringify({ ...current, ...input.ai_settings });
  }
  const min = (input.min_interval_sec ?? account.min_interval_sec) as number | null;
  const max = (input.max_interval_sec ?? account.max_interval_sec) as number | null;
  if (min != null && max != null && max < min) throw new AppError(400, 'Maximum interval must be at least the minimum interval');
  if (account.provider === 'web_qr' && min != null && min < 3) {
    throw new AppError(400, 'QR-linked numbers need at least 3 seconds between messages');
  }
  await db('whatsapp_accounts').where('id', accountId).update(updates);
  return getAccount(orgId, accountId);
}

export async function getQr(orgId: string, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  const qr = await redis.get(`wa:qr:${accountId}`);
  return { status: account.status, qr, phone_e164: account.phone_e164, last_error: account.last_error };
}

/** Reconnect: re-open a QR session (new QR if logged out) or re-verify a Meta token. Also resumes a paused number. */
export async function connectAccount(orgId: string, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  if (account.provider === 'web_qr') {
    await db('whatsapp_accounts').where('id', accountId).update({ status: 'pending_qr', last_error: null, updated_at: new Date() });
    await safeQueueAdd(whatsappSessionQueue, 'connect', { account_id: accountId });
  } else {
    try {
      await metaProviderFor(account).verify();
      await db('whatsapp_accounts').where('id', accountId).update({ status: 'connected', last_error: null, last_seen_at: new Date(), updated_at: new Date() });
    } catch (err: any) {
      await db('whatsapp_accounts').where('id', accountId).update({ status: 'error', last_error: err.message, updated_at: new Date() });
      throw new AppError(400, `Meta rejected the token: ${err.message}`);
    }
  }
  return getAccount(orgId, accountId);
}

export async function logoutAccount(orgId: string, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  if (account.provider === 'web_qr') {
    await safeQueueAdd(whatsappSessionQueue, 'logout', { account_id: accountId });
  }
  await db('whatsapp_accounts').where('id', accountId).update({ status: 'disconnected', updated_at: new Date() });
  await db('whatsapp_campaigns').where({ account_id: accountId, state: 'sending' }).update({ state: 'paused', updated_at: new Date() });
  return getAccount(orgId, accountId);
}

export async function deleteAccount(orgId: string, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  if (account.provider === 'web_qr') {
    await safeQueueAdd(whatsappSessionQueue, 'logout', { account_id: accountId, deleting: true });
  }
  await db('whatsapp_accounts').where('id', accountId).delete();
}

// ─── Templates ───

async function insertTemplate(row: Record<string, unknown>) {
  try {
    const [created] = await db('whatsapp_templates').insert(row).returning('*');
    return created;
  } catch (err: any) {
    if (err?.code === '23505') throw new AppError(409, 'A template with this name and language already exists for this number');
    throw err;
  }
}

function extractBody(components: Array<{ type: string; text?: string }> | null | undefined): string {
  return components?.find((c) => c.type === 'BODY')?.text || '';
}

function extractVariables(body: string): string[] {
  return [...new Set([...body.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))];
}

export async function listTemplates(orgId: string, accountId?: string) {
  const q = db('whatsapp_templates').where('org_id', orgId).orderBy('name');
  if (accountId) q.where((b) => b.where('account_id', accountId).orWhereNull('account_id'));
  return q;
}

export async function syncTemplates(orgId: string, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  const templates = await metaProviderFor(account).listTemplates();
  for (const t of templates) {
    const body = extractBody(t.components);
    await db('whatsapp_templates')
      .insert({
        org_id: orgId,
        account_id: accountId,
        source: 'meta',
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        body,
        components: JSON.stringify(t.components),
        variables: JSON.stringify(extractVariables(body)),
        meta_template_id: t.id,
        rejection_reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null,
      })
      .onConflict(['account_id', 'name', 'language'])
      .merge(['category', 'status', 'body', 'components', 'variables', 'meta_template_id', 'rejection_reason', 'updated_at']);
  }
  return { synced: templates.length };
}

export async function createTemplate(orgId: string, input: CreateTemplateInput) {
  const account = await getAccountRow(orgId, input.account_id);
  if (input.submit_to_meta) {
    if (!/^[a-z0-9_]+$/.test(input.name)) {
      throw new AppError(400, 'Meta template names use lowercase letters, numbers and underscores only');
    }
    const result = await metaProviderFor(account).createTemplate({
      name: input.name,
      language: input.language,
      category: input.category || 'MARKETING',
      body: input.body,
      examples: input.examples || [],
    }).catch((err) => { throw new AppError(400, `Meta rejected the template: ${err.message}`); });
    return insertTemplate({
      org_id: orgId,
      account_id: account.id,
      source: 'meta',
      name: input.name,
      language: input.language,
      category: input.category || 'MARKETING',
      status: result.status || 'PENDING',
      body: input.body,
      variables: JSON.stringify(extractVariables(input.body)),
      meta_template_id: result.id,
    });
  }
  return insertTemplate({
    org_id: orgId,
    account_id: account.id,
    source: 'local',
    name: input.name,
    language: input.language,
    status: 'APPROVED',
    body: input.body,
    variables: JSON.stringify(extractVariables(input.body)),
  });
}

export async function deleteTemplate(orgId: string, templateId: string) {
  const template = await db('whatsapp_templates').where({ id: templateId, org_id: orgId }).first();
  if (!template) throw new AppError(404, 'Template not found');
  if (template.source === 'meta' && template.account_id) {
    const account = await getAccountRow(orgId, template.account_id);
    await metaProviderFor(account).deleteTemplate(template.name).catch((err) => {
      throw new AppError(400, `Meta could not delete the template: ${err.message}`);
    });
  }
  await db('whatsapp_templates').where('id', templateId).delete();
}
