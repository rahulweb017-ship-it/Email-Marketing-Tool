import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateCampaignInput, UpdateCampaignInput } from './campaign.schema.js';
import { checkEmailLimit } from '../usage/usage.service.js';
import { getSendingConfig, createProviderFromConfig } from '../sending/sending-config.service.js';
import { campaignProcessQueue } from '../../config/queue.js';
import { safeQueueAdd } from '../../shared/utils/queue-helper.js';

export async function listCampaigns(orgId: string, pagination: PaginationParams, filters?: { state?: string; search?: string }) {
  let query = db('campaigns').where({ org_id: orgId, is_automation: false });
  let countQuery = db('campaigns').where({ org_id: orgId, is_automation: false });

  if (filters?.state) {
    query = query.where('state', filters.state);
    countQuery = countQuery.where('state', filters.state);
  }

  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.where(function () {
      this.whereILike('name', s).orWhereILike('subject', s);
    });
    countQuery = countQuery.where(function () {
      this.whereILike('name', s).orWhereILike('subject', s);
    });
  }

  const [{ count }] = await countQuery.count('* as count');
  const data = await query
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getCampaign(orgId: string, campaignId: string) {
  const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');

  const lists = await db('mailing_lists')
    .join('campaign_lists', 'mailing_lists.id', 'campaign_lists.list_id')
    .where('campaign_lists.campaign_id', campaignId)
    .select('mailing_lists.*');

  return { ...campaign, lists };
}

async function assertSegment(orgId: string, segmentId?: string | null) {
  if (!segmentId) return;
  const segment = await db('segments').where({ id: segmentId, org_id: orgId }).first('id');
  if (!segment) throw new AppError(400, 'Segment not found');
}

export async function createCampaign(orgId: string, input: CreateCampaignInput) {
  const id = uuidv4();
  await assertSegment(orgId, input.segment_id);

  await db.transaction(async (trx) => {
    await trx('campaigns').insert({
      id,
      org_id: orgId,
      name: input.name || input.subject,
      subject: input.subject,
      preview_text: input.preview_text || null,
      email_from: input.email_from,
      reply_to: input.reply_to || null,
      body_html: input.body_html || null,
      body_design: input.body_design ? JSON.stringify(input.body_design) : null,
      campaign_type: input.campaign_type,
      schedule_type: input.schedule_type,
      schedule_date: input.schedule_date || null,
      ab_test_enabled: input.ab_test_enabled,
      ab_test_percentage: input.ab_test_percentage,
      use_blacklist: input.use_blacklist,
      sending_config_id: input.sending_config_id || null,
      utm_campaign: input.utm_campaign || null,
      utm_medium: input.utm_medium || 'email',
      utm_source: input.utm_source || null,
      segment_id: input.segment_id || null,
      send_time_optimized: input.send_time_optimized ?? false,
      state: 'draft',
    });

    if (input.list_ids?.length) {
      await trx('campaign_lists').insert(
        input.list_ids.map((list_id) => ({ campaign_id: id, list_id })),
      );
    }
  });

  return getCampaign(orgId, id);
}

export async function updateCampaign(orgId: string, campaignId: string, input: UpdateCampaignInput) {
  const existing = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Campaign not found');
  if (existing.state !== 'draft') throw new AppError(400, 'Can only edit draft campaigns');

  const updates: Record<string, unknown> = {};
  const fields = [
    'name', 'subject', 'preview_text', 'email_from', 'reply_to',
    'body_html', 'campaign_type', 'schedule_type', 'schedule_date',
    'ab_test_enabled', 'ab_test_percentage', 'use_blacklist',
    'sending_config_id', 'utm_campaign', 'utm_medium', 'utm_source',
    'segment_id', 'send_time_optimized',
  ] as const;
  await assertSegment(orgId, input.segment_id);

  for (const field of fields) {
    if (input[field] !== undefined) updates[field] = input[field] ?? null;
  }

  if (input.body_design !== undefined) {
    updates.body_design = input.body_design ? JSON.stringify(input.body_design) : null;
  }

  await db.transaction(async (trx) => {
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      await trx('campaigns').where({ id: campaignId }).update(updates);
    }

    if (input.list_ids) {
      await trx('campaign_lists').where('campaign_id', campaignId).del();
      if (input.list_ids.length > 0) {
        await trx('campaign_lists').insert(
          input.list_ids.map((list_id) => ({ campaign_id: campaignId, list_id })),
        );
      }
    }
  });

  return getCampaign(orgId, campaignId);
}

export async function deleteCampaign(orgId: string, campaignId: string) {
  const existing = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Campaign not found');
  if (!['draft', 'cancelled'].includes(existing.state)) {
    throw new AppError(400, 'Can only delete draft or cancelled campaigns');
  }

  await db('campaigns').where({ id: campaignId }).del();
}

export async function duplicateCampaign(orgId: string, campaignId: string) {
  const original = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!original) throw new AppError(404, 'Campaign not found');

  const newId = uuidv4();
  const { id, created_at, updated_at, state, sent_date, stat_total, stat_sent, stat_delivered, stat_opened, stat_clicked, stat_replied, stat_bounced, stat_failed, stat_unsubscribed, ai_insights, ai_insights_at, ...rest } = original;

  await db.transaction(async (trx) => {
    await trx('campaigns').insert({
      ...rest,
      id: newId,
      name: `${original.name} (Copy)`,
      state: 'draft',
      sent_date: null,
      stat_total: 0, stat_sent: 0, stat_delivered: 0, stat_opened: 0,
      stat_clicked: 0, stat_replied: 0, stat_bounced: 0, stat_failed: 0, stat_unsubscribed: 0,
    });

    const lists = await trx('campaign_lists').where('campaign_id', campaignId);
    if (lists.length > 0) {
      await trx('campaign_lists').insert(
        lists.map((l: { list_id: string }) => ({ campaign_id: newId, list_id: l.list_id })),
      );
    }
  });

  return getCampaign(orgId, newId);
}

/**
 * Transition campaign state: draft -> in_queue or scheduled
 * This mirrors Odoo's action_put_in_queue (mailing.py)
 */
/**
 * Pre-flight validation for a campaign before sending/scheduling.
 * Checks content, recipients, provider, domain match, and connection.
 * Throws AppError with a clear message if any check fails.
 */
export async function validateCampaignReadyToSend(campaign: Record<string, unknown>, orgId: string, campaignId: string) {
  // 1. Must have a subject
  if (!(campaign.subject as string)?.trim()) throw new AppError(400, 'Campaign must have a subject line');

  // 2. Must have email body
  if (!(campaign.body_html as string)?.trim()) throw new AppError(400, 'Campaign must have email body content');

  // 3. Must have a valid From Email
  if (!(campaign.email_from as string)?.includes('@')) throw new AppError(400, 'Campaign must have a valid From Email address');

  // 4. Must have at least one mailing list
  const listIds = await db('campaign_lists').where('campaign_id', campaignId).pluck('list_id');
  if (listIds.length === 0) throw new AppError(400, 'Campaign must have at least one mailing list');

  // 5. Must have recipients in those lists
  const recipientCount = await db('contacts')
    .join('subscriptions', 'contacts.id', 'subscriptions.contact_id')
    .whereIn('subscriptions.list_id', listIds)
    .where('subscriptions.opt_out', false)
    .where('contacts.org_id', orgId)
    .where('contacts.is_blacklisted', false)
    .countDistinct('contacts.id as count')
    .first();
  if (!recipientCount || Number(recipientCount.count) === 0) {
    throw new AppError(400, 'No active recipients found in the selected mailing lists. Add contacts to your lists first.');
  }

  // 6. Validate provider exists and From domain matches
  const { provider, config } = await resolveSendingProvider(orgId, campaign.sending_config_id as string | null);
  validateFromDomain(campaign.email_from as string, config);

  // 7. Test provider connection
  try {
    const canConnect = await provider.testConnection();
    if (!canConnect) {
      throw new AppError(400, 'Cannot connect to your email provider. Please check your SMTP/API settings in Settings.');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, `Email provider connection failed: ${(err as Error).message}`);
  }
}

export async function scheduleCampaign(orgId: string, campaignId: string, scheduleDate?: string) {
  const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');
  if (campaign.state !== 'draft') throw new AppError(400, 'Campaign must be in draft state');

  // Run all pre-flight checks — throws on any failure
  await validateCampaignReadyToSend(campaign, orgId, campaignId);

  // Check email sending limit
  await checkEmailLimit(orgId);

  // --- All validations passed, now queue ---

  const targetDate = scheduleDate || campaign.schedule_date;
  const isFutureSchedule = targetDate && new Date(targetDate) > new Date();

  // Clear any previous failure reason on retry
  if (isFutureSchedule) {
    await db('campaigns').where({ id: campaignId }).update({
      state: 'scheduled',
      schedule_type: 'scheduled',
      schedule_date: targetDate,
      failure_reason: null,
      updated_at: new Date(),
    });
  } else {
    await db('campaigns').where({ id: campaignId }).update({
      state: 'in_queue',
      failure_reason: null,
      updated_at: new Date(),
    });
    const queued = await safeQueueAdd(campaignProcessQueue, 'process-campaign', {
      campaign_id: campaignId,
      org_id: orgId
    });
    if (!queued) {
      // Roll back to draft — don't leave campaign stuck in in_queue
      await db('campaigns').where({ id: campaignId }).update({ state: 'draft', updated_at: new Date() });
      throw new AppError(500, 'Failed to queue campaign for processing. Please try again.');
    }
    console.log(`Campaign ${campaignId} queued for processing`);
  }

  return getCampaign(orgId, campaignId);
}

/**
 * Cancel a sending campaign
 */
export async function cancelCampaign(orgId: string, campaignId: string) {
  const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');
  if (!['in_queue', 'sending', 'scheduled'].includes(campaign.state)) {
    throw new AppError(400, 'Can only cancel campaigns that are in queue, scheduled, or sending');
  }

  await db.transaction(async (trx) => {
    await trx('campaigns').where({ id: campaignId }).update({ state: 'cancelled', updated_at: new Date() });
    // Cancel pending traces
    await trx('mailing_traces').where({ campaign_id: campaignId, trace_status: 'outgoing' }).update({ trace_status: 'cancelled' });
  });

  return getCampaign(orgId, campaignId);
}

/**
 * Cancel a scheduled campaign back to draft
 */
export async function cancelSchedule(orgId: string, campaignId: string) {
  const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');
  if (campaign.state !== 'scheduled') throw new AppError(400, 'Can only cancel schedule of scheduled campaigns');

  await db('campaigns').where({ id: campaignId }).update({
    state: 'draft',
    schedule_type: 'now',
    schedule_date: null,
    updated_at: new Date(),
  });

  return getCampaign(orgId, campaignId);
}

/**
 * Send test email(s) for a campaign
 */
/**
 * Resolve the sending provider and its config for a campaign.
 * Returns both the provider instance and the raw config (for domain validation etc).
 */
async function resolveSendingProvider(orgId: string, sendingConfigId?: string | null) {
  let configRecord;
  if (sendingConfigId) {
    configRecord = await getSendingConfig(orgId, sendingConfigId);
  } else {
    const fallback = await db('sending_configs')
      .where({ org_id: orgId, is_active: true })
      .orderBy('is_default', 'desc')
      .first();
    if (fallback) {
      configRecord = await getSendingConfig(orgId, fallback.id);
    }
  }
  if (!configRecord) {
    throw new AppError(400, 'No email sending provider configured. Please add an SMTP, SendGrid, or AWS SES provider in Settings.');
  }
  return { provider: createProviderFromConfig(configRecord), config: configRecord };
}

/**
 * Validate that the From Email domain matches the SMTP provider's authenticated domain.
 * Prevents rejection by mail servers enforcing sender alignment.
 */
function validateFromDomain(emailFrom: string, config: Record<string, unknown>) {
  const settings = (config.settings || {}) as Record<string, unknown>;
  const providerEmail = (settings.from_email || settings.username || '') as string;
  if (!providerEmail || !providerEmail.includes('@')) return; // can't validate API-based providers

  const fromDomain = emailFrom.split('@')[1]?.toLowerCase();
  const providerDomain = providerEmail.split('@')[1]?.toLowerCase();

  if (fromDomain && providerDomain && fromDomain !== providerDomain) {
    throw new AppError(400,
      `From Email domain "@${fromDomain}" doesn't match your SMTP provider's domain "@${providerDomain}". ` +
      `Use an address like "you@${providerDomain}" to prevent mail rejection.`
    );
  }
}

export async function sendTestEmail(orgId: string, campaignId: string, emails: string[]) {
  const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');

  // Validate content and provider before sending
  if (!(campaign.subject as string)?.trim()) throw new AppError(400, 'Campaign must have a subject line');
  if (!(campaign.body_html as string)?.trim()) throw new AppError(400, 'Campaign must have email body content');
  if (!(campaign.email_from as string)?.includes('@')) throw new AppError(400, 'Campaign must have a valid From Email address');

  // Resolve provider, validate domain, and test connection
  const { provider, config } = await resolveSendingProvider(orgId, campaign.sending_config_id);
  validateFromDomain(campaign.email_from, config);

  try {
    const canConnect = await provider.testConnection();
    if (!canConnect) {
      throw new AppError(400, 'Cannot connect to your email provider. Please check your SMTP/API settings in Settings.');
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, `Email provider connection failed: ${(err as Error).message}`);
  }

  // Render merge tags with dummy data
  const dummyData: Record<string, string> = {
    '{{first_name}}': 'Test',
    '{{last_name}}': 'User',
    '{{email}}': emails[0],
    '{{company}}': 'Test Company',
    '{{unsubscribe_url}}': '#',
  };

  let html = campaign.body_html;
  for (const [tag, value] of Object.entries(dummyData)) {
    html = html.replaceAll(tag, value);
  }

  const subject = `[TEST] ${campaign.subject}`;
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const email of emails) {
    try {
      const result = await provider.send({
        from: campaign.email_from,
        to: email,
        subject,
        html,
        reply_to: campaign.reply_to || undefined,
      });
      results.push({ email, success: result.success, error: result.error });
    } catch (err) {
      results.push({ email, success: false, error: (err as Error).message });
    }
  }

  return { results };
}

/**
 * Get campaign statistics
 */
export async function getCampaignStats(orgId: string, campaignId: string) {
  const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');

  const traceStats = await db('mailing_traces')
    .where('campaign_id', campaignId)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE sent_at IS NOT NULL) as sent"),
      db.raw("COUNT(*) FILTER (WHERE first_open_at IS NOT NULL) as opened"),
      db.raw("COUNT(*) FILTER (WHERE trace_status = 'replied') as replied"),
      db.raw("COUNT(*) FILTER (WHERE trace_status = 'bounced') as bounced"),
      db.raw("COUNT(*) FILTER (WHERE trace_status = 'error') as failed"),
      db.raw("COUNT(DISTINCT contact_id) FILTER (WHERE first_click_at IS NOT NULL) as clicked"),
    )
    .first();

  const total = Number(traceStats.total);
  const sent = Number(traceStats.sent);
  const opened = Number(traceStats.opened);
  const clicked = Number(traceStats.clicked);
  const bounced = Number(traceStats.bounced);

  return {
    campaign_id: campaignId,
    state: campaign.state,
    ...traceStats,
    sent,
    opened,
    clicked,
    open_rate: sent > 0 ? ((opened / sent) * 100).toFixed(2) : '0.00',
    click_rate: sent > 0 ? ((clicked / sent) * 100).toFixed(2) : '0.00',
    bounce_rate: sent > 0 ? ((bounced / sent) * 100).toFixed(2) : '0.00',
  };
}
