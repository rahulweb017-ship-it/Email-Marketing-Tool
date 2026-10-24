import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { whatsappCampaignQueue } from '../../config/queue.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { safeQueueAdd } from '../../shared/utils/queue-helper.js';
import { toE164 } from '../../shared/utils/phone.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import { checkWhatsAppLimit } from '../usage/usage.service.js';
import { buildOutbound, queueOutbound } from './whatsapp-messages.service.js';
import { getAccountRow, getSentToday, maybeCompleteCampaign } from './whatsapp.shared.js';
import { dailyCap } from './whatsapp.utils.js';
import type { CampaignInput } from './whatsapp.schema.js';

const EDITABLE_STATES = ['draft', 'scheduled'];

export async function listCampaigns(orgId: string, pagination: PaginationParams, filters: { state?: string; search?: string }) {
  const base = db('whatsapp_campaigns as c').leftJoin('whatsapp_accounts as a', 'a.id', 'c.account_id').where('c.org_id', orgId);
  if (filters.state) base.where('c.state', filters.state);
  if (filters.search) base.whereILike('c.name', `%${filters.search}%`);
  const [{ count }] = await base.clone().count('c.id as count');
  const data = await base.select('c.*', 'a.name as account_name', 'a.provider as account_provider')
    .orderBy('c.created_at', 'desc').limit(pagination.per_page).offset(pagination.offset);
  return { data, total: Number(count) };
}

export async function getCampaign(orgId: string, campaignId: string) {
  const campaign = await db('whatsapp_campaigns as c')
    .leftJoin('whatsapp_accounts as a', 'a.id', 'c.account_id')
    .leftJoin('whatsapp_templates as t', 't.id', 'c.template_id')
    .where({ 'c.id': campaignId, 'c.org_id': orgId })
    .select('c.*', 'a.name as account_name', 'a.provider as account_provider', 'a.status as account_status',
      't.name as template_name', 't.body as template_body', 't.source as template_source')
    .first();
  if (!campaign) throw new AppError(404, 'WhatsApp campaign not found');
  const lists = await db('whatsapp_campaign_lists as cl').join('mailing_lists as l', 'l.id', 'cl.list_id')
    .where('cl.campaign_id', campaignId).select('l.id', 'l.name');
  return { ...campaign, lists, list_ids: lists.map((l) => l.id) };
}

async function validateContent(orgId: string, input: Partial<CampaignInput>, accountId: string) {
  const account = await getAccountRow(orgId, accountId);
  if (input.template_id) {
    const template = await db('whatsapp_templates').where({ id: input.template_id, org_id: orgId }).first();
    if (!template) throw new AppError(404, 'Template not found');
    if (template.source === 'meta' && account.provider !== 'meta_cloud') {
      throw new AppError(400, 'Meta templates can only be sent from a Meta Cloud API number');
    }
  }
  for (const listId of input.list_ids || []) {
    const list = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
    if (!list) throw new AppError(404, 'List not found');
  }
  return account;
}

export async function createCampaign(orgId: string, userId: string, input: CampaignInput) {
  await validateContent(orgId, input, input.account_id);
  const [row] = await db('whatsapp_campaigns').insert({
    org_id: orgId,
    account_id: input.account_id,
    name: input.name,
    template_id: input.template_id ?? null,
    message_body: input.message_body ?? null,
    media: input.media ? JSON.stringify(input.media) : null,
    variable_mapping: JSON.stringify(input.variable_mapping || {}),
    require_consent: input.require_consent ?? true,
    created_by: userId,
  }).returning('id');
  await db('whatsapp_campaign_lists').insert(input.list_ids.map((list_id) => ({ campaign_id: row.id, list_id })));
  return getCampaign(orgId, row.id);
}

export async function updateCampaign(orgId: string, campaignId: string, input: Partial<CampaignInput>) {
  const campaign = await getCampaign(orgId, campaignId);
  if (!EDITABLE_STATES.includes(campaign.state)) throw new AppError(400, 'Only draft or scheduled campaigns can be edited');
  await validateContent(orgId, input, input.account_id || campaign.account_id);
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.account_id !== undefined) updates.account_id = input.account_id;
  if (input.template_id !== undefined) updates.template_id = input.template_id;
  if (input.message_body !== undefined) updates.message_body = input.message_body;
  if (input.media !== undefined) updates.media = input.media ? JSON.stringify(input.media) : null;
  if (input.variable_mapping !== undefined) updates.variable_mapping = JSON.stringify(input.variable_mapping);
  if (input.require_consent !== undefined) updates.require_consent = input.require_consent;
  await db('whatsapp_campaigns').where('id', campaignId).update(updates);
  if (input.list_ids) {
    await db('whatsapp_campaign_lists').where('campaign_id', campaignId).delete();
    await db('whatsapp_campaign_lists').insert(input.list_ids.map((list_id) => ({ campaign_id: campaignId, list_id })));
  }
  return getCampaign(orgId, campaignId);
}

export async function deleteCampaign(orgId: string, campaignId: string) {
  const campaign = await getCampaign(orgId, campaignId);
  if (['sending', 'queued'].includes(campaign.state)) throw new AppError(400, 'Pause or cancel the campaign before deleting it');
  await db('whatsapp_campaigns').where('id', campaignId).delete();
}

/** Recipients a campaign would reach: list members with a valid mobile, not opted out / blacklisted, optionally consented. */
function audienceQuery(orgId: string, campaignId: string, requireConsent: boolean) {
  const q = db('contacts as ct')
    .join('subscriptions as s', 's.contact_id', 'ct.id')
    .join('whatsapp_campaign_lists as cl', 'cl.list_id', 's.list_id')
    .where('cl.campaign_id', campaignId)
    .where('ct.org_id', orgId)
    .where('s.opt_out', false)
    .where('ct.is_blacklisted', false)
    .where('ct.whatsapp_opt_out', false)
    .whereNotNull('ct.phone_e164');
  if (requireConsent) {
    q.whereExists(
      db('consent_records as cr').whereRaw('cr.contact_id = ct.id')
        .where({ 'cr.consent_type': 'whatsapp_marketing', 'cr.status': 'granted' }),
    );
  }
  return q;
}

/** Audience size preview for the wizard, plus how long a QR number would take at its daily cap. */
export async function previewAudience(orgId: string, campaignId: string) {
  const campaign = await getCampaign(orgId, campaignId);
  const [{ total }] = await db('contacts as ct')
    .join('subscriptions as s', 's.contact_id', 'ct.id')
    .join('whatsapp_campaign_lists as cl', 'cl.list_id', 's.list_id')
    .where({ 'cl.campaign_id': campaignId, 'ct.org_id': orgId, 's.opt_out': false })
    .countDistinct('ct.id as total');
  const [{ eligible }] = await audienceQuery(orgId, campaignId, campaign.require_consent).countDistinct('ct.phone_e164 as eligible');
  const account = await getAccountRow(orgId, campaign.account_id);
  const cap = dailyCap(account);
  const remainingToday = Math.max(0, cap - await getSentToday(account.id));
  const eligibleCount = Number(eligible);
  return {
    list_members: Number(total),
    eligible: eligibleCount,
    skipped: Number(total) - eligibleCount,
    daily_cap: cap,
    remaining_today: remainingToday,
    estimated_days: eligibleCount <= remainingToday ? 1 : 1 + Math.ceil((eligibleCount - remainingToday) / Math.max(cap, 1)),
  };
}

export async function scheduleCampaign(orgId: string, campaignId: string, scheduleAt?: string) {
  const campaign = await getCampaign(orgId, campaignId);
  if (!EDITABLE_STATES.includes(campaign.state)) throw new AppError(400, 'This campaign has already been sent');
  if (!campaign.template_id && !campaign.message_body && !campaign.media) throw new AppError(400, 'Add a message before sending');
  if (campaign.account_provider === 'meta_cloud' && !campaign.template_id) {
    throw new AppError(400, 'Meta only allows approved templates for campaigns. Pick a template.');
  }
  if (campaign.account_status !== 'connected') throw new AppError(400, 'The WhatsApp number for this campaign is not connected');

  const when = scheduleAt ? new Date(scheduleAt) : new Date();
  if (scheduleAt && when.getTime() > Date.now() + 60_000) {
    await db('whatsapp_campaigns').where('id', campaignId).update({ state: 'scheduled', schedule_at: when, updated_at: new Date() });
  } else {
    await db('whatsapp_campaigns').where('id', campaignId).update({ state: 'queued', schedule_at: when, updated_at: new Date() });
    await enqueueExpand(campaignId);
  }
  return getCampaign(orgId, campaignId);
}

function enqueueExpand(campaignId: string) {
  return safeQueueAdd(whatsappCampaignQueue, 'expand', { campaign_id: campaignId }, { removeOnComplete: 1000, removeOnFail: 1000 });
}

/** Worker: turn a queued campaign into per-recipient queued messages. The gateway dispatcher paces actual sending. */
export async function expandCampaign(campaignId: string) {
  // One expansion at a time per campaign, even if the job is delivered twice
  const lockKey = `wa:expand:${campaignId}`;
  if ((await redis.set(lockKey, '1', 'EX', 900, 'NX')) !== 'OK') return;
  try {
    await expandCampaignLocked(campaignId);
  } finally {
    await redis.del(lockKey);
  }
}

async function expandCampaignLocked(campaignId: string) {
  const campaign = await db('whatsapp_campaigns').where('id', campaignId).first();
  if (!campaign || campaign.state !== 'queued') return;
  // A crashed earlier attempt may have queued some messages already — don't queue them twice
  await db('whatsapp_messages').where({ campaign_id: campaignId, status: 'queued' }).delete();
  const fail = (reason: string) => db('whatsapp_campaigns').where('id', campaignId)
    .update({ state: 'failed', failure_reason: reason, updated_at: new Date() });

  const account = await db('whatsapp_accounts').where('id', campaign.account_id).first();
  if (!account || account.status !== 'connected') return fail('The WhatsApp number is not connected');

  const recipients = await audienceQuery(campaign.org_id, campaignId, campaign.require_consent)
    .distinctOn('ct.phone_e164')
    .select('ct.id', 'ct.phone_e164', 'ct.first_name', 'ct.last_name', 'ct.email', 'ct.company_name', 'ct.phone', 'ct.custom_fields', 'ct.whatsapp_opt_out')
    .orderBy('ct.phone_e164');
  const [{ members }] = await db('contacts as ct')
    .join('subscriptions as s', 's.contact_id', 'ct.id')
    .join('whatsapp_campaign_lists as cl', 'cl.list_id', 's.list_id')
    .where({ 'cl.campaign_id': campaignId, 'ct.org_id': campaign.org_id, 's.opt_out': false })
    .countDistinct('ct.id as members');

  if (!recipients.length) {
    return fail(campaign.require_consent
      ? 'No recipients: nobody on these lists has a valid mobile number and WhatsApp consent'
      : 'No recipients: nobody on these lists has a valid mobile number');
  }
  try {
    await checkWhatsAppLimit(campaign.org_id, recipients.length);
  } catch (err: any) {
    return fail(err.message);
  }

  const variableMapping = typeof campaign.variable_mapping === 'string' ? JSON.parse(campaign.variable_mapping) : (campaign.variable_mapping || {});
  const media = typeof campaign.media === 'string' ? JSON.parse(campaign.media) : campaign.media;

  let queued = 0;
  for (const contact of recipients) {
    try {
      await queueOutbound({
        orgId: campaign.org_id, account, phoneE164: contact.phone_e164, contact,
        body: campaign.message_body, media, templateId: campaign.template_id, variableMapping,
        sentBy: 'campaign', campaignId, enforceWindow: false,
      });
      queued++;
    } catch (err: any) {
      console.warn(`WhatsApp campaign ${campaignId}: skipped ${contact.phone_e164}: ${err.message}`);
    }
  }

  await db('whatsapp_campaigns').where('id', campaignId).update({
    state: queued ? 'sending' : 'failed',
    failure_reason: queued ? null : 'No messages could be prepared',
    stat_total: queued,
    stat_skipped: Number(members) - queued,
    started_at: new Date(),
    updated_at: new Date(),
  });
}

/** Worker cron: kick off scheduled campaigns that are due, and retry expansions that never finished. */
export async function enqueueDueCampaigns() {
  const due = await db('whatsapp_campaigns').where('state', 'scheduled').where('schedule_at', '<=', new Date()).select('id');
  for (const c of due) {
    const updated = await db('whatsapp_campaigns').where({ id: c.id, state: 'scheduled' }).update({ state: 'queued', updated_at: new Date() });
    if (updated) await enqueueExpand(c.id);
  }
  const stuck = await db('whatsapp_campaigns').where('state', 'queued')
    .where('updated_at', '<', new Date(Date.now() - 15 * 60_000)).select('id');
  for (const c of stuck) {
    await db('whatsapp_campaigns').where('id', c.id).update({ updated_at: new Date() });
    await enqueueExpand(c.id);
  }
  return due.length + stuck.length;
}

export async function pauseCampaign(orgId: string, campaignId: string) {
  const campaign = await getCampaign(orgId, campaignId);
  if (campaign.state !== 'sending') throw new AppError(400, 'Only a sending campaign can be paused');
  await db('whatsapp_campaigns').where('id', campaignId).update({ state: 'paused', updated_at: new Date() });
  return getCampaign(orgId, campaignId);
}

export async function resumeCampaign(orgId: string, campaignId: string) {
  const campaign = await getCampaign(orgId, campaignId);
  if (campaign.state !== 'paused') throw new AppError(400, 'Only a paused campaign can be resumed');
  if (campaign.account_status !== 'connected') throw new AppError(400, 'Reconnect the WhatsApp number before resuming');
  await db('whatsapp_campaigns').where('id', campaignId).update({ state: 'sending', failure_reason: null, updated_at: new Date() });
  await maybeCompleteCampaign(campaignId);
  return getCampaign(orgId, campaignId);
}

export async function cancelCampaign(orgId: string, campaignId: string) {
  const campaign = await getCampaign(orgId, campaignId);
  if (['done', 'cancelled', 'failed'].includes(campaign.state)) throw new AppError(400, 'This campaign has already finished');
  await db('whatsapp_messages').where({ campaign_id: campaignId, status: 'queued' })
    .update({ status: 'cancelled', updated_at: new Date() });
  await db('whatsapp_campaigns').where('id', campaignId).update({ state: 'cancelled', completed_at: new Date(), updated_at: new Date() });
  return getCampaign(orgId, campaignId);
}

/** Send the campaign's message to 1–3 test numbers (not counted in campaign stats). */
export async function testCampaign(orgId: string, userId: string, campaignId: string, phones: string[]) {
  const campaign = await getCampaign(orgId, campaignId);
  const account = await getAccountRow(orgId, campaign.account_id);
  if (account.status !== 'connected') throw new AppError(400, 'The WhatsApp number is not connected');
  await checkWhatsAppLimit(orgId, phones.length);
  const variableMapping = typeof campaign.variable_mapping === 'string' ? JSON.parse(campaign.variable_mapping) : (campaign.variable_mapping || {});
  const media = typeof campaign.media === 'string' ? JSON.parse(campaign.media) : campaign.media;
  const results = [];
  for (const raw of phones) {
    const phone = toE164(raw, 'IN');
    if (!phone) { results.push({ phone: raw, ok: false, error: 'Invalid number' }); continue; }
    const contact = await db('contacts').where({ org_id: orgId, phone_e164: phone }).first()
      || { first_name: 'Test', last_name: 'User', company_name: 'Your Company', whatsapp_opt_out: false };
    try {
      await queueOutbound({
        orgId, account, phoneE164: phone, contact,
        body: campaign.message_body, media, templateId: campaign.template_id, variableMapping,
        sentBy: 'user', userId, enforceWindow: false,
      });
      results.push({ phone, ok: true });
    } catch (err: any) {
      results.push({ phone, ok: false, error: err.message });
    }
  }
  return { results };
}

/** Preview the rendered message for a sample contact (wizard phone preview). */
export async function previewMessage(orgId: string, input: {
  account_id: string; template_id?: string | null; message_body?: string | null; variable_mapping?: Record<string, string>; contact_id?: string;
}) {
  const account = await getAccountRow(orgId, input.account_id);
  const contact = input.contact_id
    ? await db('contacts').where({ id: input.contact_id, org_id: orgId }).first()
    : { first_name: 'Priya', last_name: 'Sharma', company_name: 'Sharma Traders', email: 'priya@example.com' };
  const out = await buildOutbound({
    orgId, account, contact, body: input.message_body, templateId: input.template_id, variableMapping: input.variable_mapping,
  });
  return { body: out.body, type: out.type };
}

export async function getCampaignMessages(orgId: string, campaignId: string, pagination: PaginationParams, status?: string) {
  await getCampaign(orgId, campaignId);
  const base = db('whatsapp_messages as m').leftJoin('contacts as ct', 'ct.id', 'm.contact_id')
    .where({ 'm.org_id': orgId, 'm.campaign_id': campaignId });
  if (status) base.where('m.status', status);
  const [{ count }] = await base.clone().count('m.id as count');
  const data = await base.select('m.id', 'm.phone_e164', 'm.status', 'm.error', 'm.sent_at', 'm.delivered_at', 'm.read_at',
    'm.created_at', 'ct.first_name', 'ct.last_name', 'ct.email')
    .orderBy('m.created_at', 'asc').limit(pagination.per_page).offset(pagination.offset);
  return { data, total: Number(count) };
}
