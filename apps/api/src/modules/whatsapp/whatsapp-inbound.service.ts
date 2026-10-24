// Processes inbound WhatsApp events from both providers (runs in the worker via the whatsapp-inbound queue).
import { db } from '../../config/database.js';
import { whatsappAiQueue } from '../../config/queue.js';
import { safeQueueAdd } from '../../shared/utils/queue-helper.js';
import { parseMetaWebhook, type InboundEvent } from './whatsapp-webhook-parser.js';
import { createNotification } from '../notifications/notification.service.js';
import { decryptCredentials, maybeCompleteCampaign, pauseAccount, upsertConversation } from './whatsapp.shared.js';
import { DEFAULT_STOP_KEYWORDS, isStopMessage, shouldAdvanceStatus, wantsHuman, DEFAULT_HANDOFF_KEYWORDS } from './whatsapp.utils.js';

export type { InboundEvent } from './whatsapp-webhook-parser.js';

export async function processMetaWebhook(payload: any) {
  const phoneIds = new Set<string>();
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const id = change.value?.metadata?.phone_number_id;
      if (id) phoneIds.add(String(id));
    }
  }
  const accounts = phoneIds.size
    ? await db('whatsapp_accounts').whereIn('meta_phone_number_id', [...phoneIds]).select('id', 'meta_phone_number_id')
    : [];
  const byPhoneId = new Map(accounts.map((a) => [a.meta_phone_number_id, a.id]));
  const events = parseMetaWebhook(payload, (id) => byPhoneId.get(id));
  for (const event of events) {
    await processInboundEvent(event);
  }
  return events.length;
}

export async function processInboundEvent(event: InboundEvent) {
  if (event.kind === 'message') return handleMessage(event);
  if (event.kind === 'status') return handleStatus(event);
  if (event.kind === 'template_status') return handleTemplateStatus(event);
}

async function handleMessage(event: Extract<InboundEvent, { kind: 'message' }>) {
  const account = await db('whatsapp_accounts').where('id', event.account_id).first();
  if (!account) return;

  const dupe = await db('whatsapp_messages').where({ account_id: account.id, provider_message_id: event.provider_message_id }).first();
  if (dupe) return;

  const conversation = await upsertConversation(account.org_id, account.id, event.from, { profile_name: event.profile_name });
  const receivedAt = new Date(event.timestamp || Date.now());

  // Did this reply come after a campaign message with no reply yet? Count it once.
  const lastOut = await db('whatsapp_messages')
    .where({ conversation_id: conversation.id, direction: 'out' })
    .whereNotIn('status', ['queued', 'sending', 'failed', 'cancelled', 'skipped'])
    .orderBy('created_at', 'desc').first();
  const lastIn = await db('whatsapp_messages')
    .where({ conversation_id: conversation.id, direction: 'in' })
    .orderBy('created_at', 'desc').first();
  if (lastOut?.campaign_id && (!lastIn || new Date(lastIn.created_at) < new Date(lastOut.created_at))) {
    await db('whatsapp_campaigns').where('id', lastOut.campaign_id).increment('stat_replied', 1);
  }

  const [message] = await db('whatsapp_messages').insert({
    org_id: account.org_id,
    account_id: account.id,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    phone_e164: event.from,
    direction: 'in',
    type: event.type,
    body: event.body ?? null,
    media: event.media ? JSON.stringify(event.media) : null,
    provider_message_id: event.provider_message_id,
    status: 'received',
    created_at: receivedAt,
  }).returning('*');

  await db('whatsapp_conversations').where('id', conversation.id).update({
    last_message_at: receivedAt,
    last_inbound_at: receivedAt,
    last_message_preview: (event.body || `[${event.type}]`).slice(0, 200),
    unread_count: db.raw('unread_count + 1'),
    status: conversation.status === 'closed' ? 'open' : conversation.status,
    updated_at: new Date(),
  });

  const aiSettings = typeof account.ai_settings === 'string' ? JSON.parse(account.ai_settings) : (account.ai_settings || {});
  const stopKeywords: string[] = aiSettings.stop_keywords?.length ? aiSettings.stop_keywords : DEFAULT_STOP_KEYWORDS;

  if (isStopMessage(event.body, stopKeywords)) {
    await handleOptOut(account, conversation, lastOut?.campaign_id ?? null);
    return;
  }
  if (isStopMessage(event.body, START_KEYWORDS)) {
    const handled = await handleOptIn(account, conversation);
    if (handled) return;
  }

  const handoffKeywords: string[] = aiSettings.handoff_keywords?.length ? aiSettings.handoff_keywords : DEFAULT_HANDOFF_KEYWORDS;
  if (account.ai_enabled && !conversation.ai_paused && wantsHuman(event.body, handoffKeywords)) {
    await flagNeedsHuman(account, conversation, 'The customer asked for a person');
    return;
  }

  if (account.ai_enabled && !conversation.ai_paused && conversation.status !== 'needs_human' && event.body) {
    await safeQueueAdd(whatsappAiQueue, 'auto-reply', { conversation_id: conversation.id, message_id: message.id }, {
      jobId: `ai-${message.id}`, delay: 3000, removeOnComplete: 1000, removeOnFail: 1000,
    });
  }
}

export async function flagNeedsHuman(account: any, conversation: any, reason: string) {
  await db('whatsapp_conversations').where('id', conversation.id).update({ status: 'needs_human', ai_paused: true, updated_at: new Date() });
  const name = conversation.profile_name || conversation.phone_e164;
  await createNotification(account.org_id, {
    title: `WhatsApp: ${name} needs a person`,
    body: reason,
    type: 'warning',
    link: `/whatsapp/inbox?c=${conversation.id}`,
  }).catch(() => {});
}

const START_KEYWORDS = ['start', 'subscribe', 'unstop', 'resume'];

/** "START" from someone who opted out: lift the opt-out, record consent, confirm once. */
async function handleOptIn(account: any, conversation: any): Promise<boolean> {
  const contacts = await db('contacts').where({ org_id: account.org_id, phone_e164: conversation.phone_e164, whatsapp_opt_out: true }).select('id');
  if (!contacts.length) return false;
  const now = new Date();
  for (const c of contacts) {
    await db('contacts').where('id', c.id).update({ whatsapp_opt_out: false, whatsapp_opt_out_at: null });
    const existing = await db('consent_records').where({ org_id: account.org_id, contact_id: c.id, consent_type: 'whatsapp_marketing' }).first();
    if (existing) {
      await db('consent_records').where('id', existing.id).update({ status: 'granted', source: 'whatsapp_reply', granted_at: now, revoked_at: null, updated_at: now });
    } else {
      await db('consent_records').insert({ org_id: account.org_id, contact_id: c.id, consent_type: 'whatsapp_marketing', status: 'granted', source: 'whatsapp_reply', granted_at: now });
    }
  }
  await db('whatsapp_messages').insert({
    org_id: account.org_id,
    account_id: account.id,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    phone_e164: conversation.phone_e164,
    direction: 'out',
    type: 'text',
    body: 'Welcome back! You will receive our WhatsApp updates again. Reply STOP any time to unsubscribe.',
    status: 'queued',
    sent_by: 'system',
  });
  await db('whatsapp_conversations').where('id', conversation.id).update({ ai_paused: false, updated_at: now });
  return true;
}

async function handleOptOut(account: any, conversation: any, campaignId: string | null) {
  const now = new Date();
  const contactIds = conversation.contact_id
    ? [conversation.contact_id]
    : (await db('contacts').where({ org_id: account.org_id, phone_e164: conversation.phone_e164 }).pluck('id'));
  if (contactIds.length) {
    await db('contacts').whereIn('id', contactIds).update({ whatsapp_opt_out: true, whatsapp_opt_out_at: now });
    await db('consent_records').whereIn('contact_id', contactIds)
      .where({ consent_type: 'whatsapp_marketing', status: 'granted' })
      .update({ status: 'revoked', revoked_at: now, updated_at: now });
  }
  // Nothing else goes out to this number from any of the org's campaigns
  const cancelled = await db('whatsapp_messages')
    .where({ org_id: account.org_id, phone_e164: conversation.phone_e164, status: 'queued' })
    .whereNotNull('campaign_id')
    .update({ status: 'cancelled', error: 'Recipient opted out', updated_at: now });
  if (campaignId) await db('whatsapp_campaigns').where('id', campaignId).increment('stat_opted_out', 1);
  if (cancelled && campaignId) await maybeCompleteCampaign(campaignId);

  // One confirmation, sent through the normal paced dispatcher
  await db('whatsapp_messages').insert({
    org_id: account.org_id,
    account_id: account.id,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    phone_e164: conversation.phone_e164,
    direction: 'out',
    type: 'text',
    body: 'You have been unsubscribed and will not receive marketing messages from us on WhatsApp. Reply START to join again.',
    status: 'queued',
    sent_by: 'system',
  });
  await db('whatsapp_conversations').where('id', conversation.id).update({ ai_paused: true, updated_at: now });
}

async function handleStatus(event: Extract<InboundEvent, { kind: 'status' }>) {
  const message = await db('whatsapp_messages')
    .where({ account_id: event.account_id, provider_message_id: event.provider_message_id })
    .first();
  if (!message || !shouldAdvanceStatus(message.status, event.status)) return;

  const at = new Date(event.timestamp || Date.now());
  const updates: Record<string, unknown> = { status: event.status, updated_at: new Date() };
  if (event.status === 'delivered') updates.delivered_at = at;
  if (event.status === 'read') {
    updates.read_at = at;
    if (!message.delivered_at) updates.delivered_at = at;
  }
  if (event.status === 'failed') {
    updates.failed_at = at;
    updates.error = event.error || 'Delivery failed';
  }
  await db('whatsapp_messages').where('id', message.id).update(updates);

  if (message.campaign_id) {
    const inc: Record<string, number> = {};
    if (event.status === 'delivered') inc.stat_delivered = 1;
    if (event.status === 'read') {
      inc.stat_read = 1;
      if (!message.delivered_at) inc.stat_delivered = 1;
    }
    if (event.status === 'failed') inc.stat_failed = 1;
    if (Object.keys(inc).length) await db('whatsapp_campaigns').where('id', message.campaign_id).increment(inc);
  }

  // Meta tells us the number is being rate-limited for spam / quality — stop before it gets worse
  if (event.status === 'failed' && event.error_code && [131048, 368, 131031].includes(event.error_code)) {
    await pauseAccount(event.account_id, `Meta limited this number (error ${event.error_code}: ${event.error || 'policy'}).`);
  }
}

async function handleTemplateStatus(event: Extract<InboundEvent, { kind: 'template_status' }>) {
  const metaAccounts = await db('whatsapp_accounts').where('provider', 'meta_cloud').whereNotNull('credentials_encrypted')
    .select('id', 'credentials_encrypted');
  // waba_id lives inside the encrypted credentials, so only accounts on this exact WABA are touched
  const accountIds = metaAccounts.filter((a) => {
    try { return decryptCredentials(a.credentials_encrypted).waba_id === event.waba_id; } catch { return false; }
  }).map((a) => a.id);
  if (!accountIds.length) return;
  const templates = await db('whatsapp_templates')
    .whereIn('account_id', accountIds)
    .where({ name: event.name, source: 'meta' })
    .modify((q) => { if (event.language) q.where('language', event.language); });
  for (const t of templates) {
    await db('whatsapp_templates').where('id', t.id).update({ status: event.status, rejection_reason: event.reason ?? null, updated_at: new Date() });
    await createNotification(t.org_id, {
      title: `WhatsApp template "${t.name}" is ${event.status}`,
      body: event.reason ? `Reason: ${event.reason}` : undefined,
      type: event.status === 'APPROVED' ? 'success' : 'warning',
      link: '/whatsapp/templates',
    }).catch(() => {});
  }
}
