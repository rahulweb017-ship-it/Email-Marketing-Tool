import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { normalizeEmail } from '../shared/utils/email-validator.js';
import { checkEmailLimit } from '../modules/usage/usage.service.js';

const EMAIL_SEND_BATCH_SIZE = 50;

interface CampaignProcessJob {
  campaign_id: string;
  org_id: string;
}

/**
 * CampaignProcessorWorker
 * Mirrors Odoo's _process_mass_mailing_queue (mailing.py:1089)
 *
 * 1. Resolve recipients from campaign lists + segment filters
 * 2. Exclude: blacklisted, opted-out, duplicates, invalid emails
 * 3. Batch-create mailing_traces (status: outgoing)
 * 4. Transition campaign to 'sending'
 * 5. Split into batches -> enqueue to 'email:send'
 */
async function processCampaign(job: Job<CampaignProcessJob>) {
  const { campaign_id, org_id } = job.data;

  // Check org is still active
  const org = await db('organizations').where('id', org_id).select('status').first();
  if (!org || org.status !== 'active') {
    console.log(`Org ${org_id} suspended, skipping campaign ${campaign_id}`);
    await db('campaigns').where('id', campaign_id).update({
      state: 'draft',
      failure_reason: 'Organization suspended',
      updated_at: new Date(),
    });
    return;
  }

  const campaign = await db('campaigns').where({ id: campaign_id }).first();
  if (!campaign || campaign.state !== 'in_queue') {
    console.log(`Campaign ${campaign_id} not in queue state, skipping`);
    return;
  }

  try {
    // Check email limit before processing
    try {
      await checkEmailLimit(org_id);
    } catch {
      await db('campaigns').where('id', campaign_id).update({
        state: 'draft',
        failure_reason: 'Monthly email limit reached. Upgrade your plan to send more emails.',
        updated_at: new Date(),
      });
      return;
    }
    // 1. Get all list IDs for this campaign
    const listIds = await db('campaign_lists').where('campaign_id', campaign_id).pluck('list_id');
    if (listIds.length === 0) {
      await failCampaign(campaign_id, 'No mailing lists attached to this campaign.');
      return;
    }

    // 2. Resolve recipients: active subscribers across all lists
    const recipients = await db('contacts')
      .join('subscriptions', 'contacts.id', 'subscriptions.contact_id')
      .whereIn('subscriptions.list_id', listIds)
      .where('subscriptions.opt_out', false)
      .where('contacts.org_id', org_id)
      .where('contacts.is_blacklisted', false)
      .whereNotNull('contacts.email')
      .distinct('contacts.id', 'contacts.email', 'contacts.email_normalized',
        'contacts.first_name', 'contacts.last_name', 'contacts.company_name',
        'contacts.custom_fields');

    // 3. Deduplicate by normalized email
    const seen = new Set<string>();
    const uniqueRecipients = [];
    for (const r of recipients) {
      const normalized = normalizeEmail(r.email);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueRecipients.push(r);
      }
    }

    // 4. Further exclude blacklisted emails
    let finalRecipients = uniqueRecipients;
    if (campaign.use_blacklist) {
      const blacklisted = await db('email_blacklist')
        .where({ org_id, is_active: true })
        .pluck('email_normalized');
      const blacklistSet = new Set(blacklisted);
      finalRecipients = uniqueRecipients.filter((r) => !blacklistSet.has(r.email_normalized));
    }

    if (finalRecipients.length === 0) {
      await failCampaign(campaign_id, 'No active recipients found after filtering blacklisted and opted-out contacts.');
      return;
    }

    // 5. Create mailing traces
    const traces = finalRecipients.map((r) => ({
      id: uuidv4(),
      campaign_id,
      contact_id: r.id,
      email: r.email,
      trace_status: 'outgoing' as const,
    }));

    // Insert in chunks to avoid massive single query
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < traces.length; i += CHUNK_SIZE) {
      await db('mailing_traces').insert(traces.slice(i, i + CHUNK_SIZE));
    }

    // 6. Update campaign stats and state
    await db('campaigns').where('id', campaign_id).update({
      state: 'sending',
      stat_total: traces.length,
      updated_at: new Date(),
    });

    // Initialize Redis counter hash
    await redis.hset(`campaign:${campaign_id}:stats`, {
      sent: '0', delivered: '0', opened: '0', clicked: '0',
      bounced: '0', failed: '0', replied: '0',
    });

    // 7. Split into batches and enqueue to email:send queue
    const { queues } = await import('../config/queue.js');
    for (let i = 0; i < traces.length; i += EMAIL_SEND_BATCH_SIZE) {
      const batch = traces.slice(i, i + EMAIL_SEND_BATCH_SIZE);
      await queues.emailSend.add('send-batch', {
        campaign_id,
        org_id,
        trace_ids: batch.map((t) => t.id),
        batch_index: Math.floor(i / EMAIL_SEND_BATCH_SIZE),
        total_batches: Math.ceil(traces.length / EMAIL_SEND_BATCH_SIZE),
      });
    }

    console.log(`Campaign ${campaign_id}: ${traces.length} recipients in ${Math.ceil(traces.length / EMAIL_SEND_BATCH_SIZE)} batches`);
  } catch (err) {
    console.error(`Campaign ${campaign_id} processing failed:`, err);
    await failCampaign(campaign_id, `Processing failed: ${(err as Error).message}`);
  }
}

/**
 * Mark campaign as failed and revert to draft so the user can fix and retry.
 */
async function failCampaign(campaignId: string, reason: string) {
  await db('campaigns').where('id', campaignId).update({
    state: 'draft',
    failure_reason: reason,
    updated_at: new Date(),
  });
  // Cancel any outgoing traces created before failure
  await db('mailing_traces')
    .where({ campaign_id: campaignId, trace_status: 'outgoing' })
    .update({ trace_status: 'cancelled' });
  console.log(`Campaign ${campaignId} reverted to draft: ${reason}`);
}

export function createCampaignProcessorWorker() {
  return new Worker('email-campaign-process', processCampaign, {
    connection: redis,
    concurrency: 2,
  });
}
