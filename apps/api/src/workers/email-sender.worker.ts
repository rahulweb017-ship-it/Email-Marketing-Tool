import { Worker, Job } from 'bullmq';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { rewriteLinks, renderMergeTags } from '../modules/sending/link-rewriter.js';
import type { EmailProvider, EmailMessage } from '../modules/sending/providers/types.js';
import { getSendingConfig, createProviderFromConfig } from '../modules/sending/sending-config.service.js';
import { env } from '../config/env.js';
import { generateUnsubscribeToken } from '../shared/utils/hmac.js';
import { checkEmailLimit, incrementEmailCounter } from '../modules/usage/usage.service.js';

interface SendBatchJob {
  campaign_id: string;
  org_id: string;
  trace_ids: string[];
  batch_index: number;
  total_batches: number;
}

/**
 * EmailSenderWorker
 * Mirrors Odoo's _action_send_mail per batch (mailing.py:1089-1187)
 *
 * For each trace in batch:
 * 1. Render HTML with merge tags
 * 2. Rewrite links to tracked URLs
 * 3. Inject open tracking pixel
 * 4. Add List-Unsubscribe headers
 * 5. Send via configured provider
 * 6. Update trace status + Redis counters
 */
async function sendBatch(job: Job<SendBatchJob>) {
  const { campaign_id, org_id, trace_ids, batch_index, total_batches } = job.data;

  const campaign = await db('campaigns').where('id', campaign_id).first();
  if (!campaign) return;
  const isAutomation = !!campaign.is_automation;

  // Automation step campaigns stay in 'sending' forever and serve many future
  // sends, so a failure only cancels this batch instead of stopping the campaign.
  const stopCampaign = async (reason: string) => {
    if (isAutomation) {
      await db('mailing_traces').whereIn('id', trace_ids).where('trace_status', 'outgoing')
        .update({ trace_status: 'cancelled', failure_reason: reason.substring(0, 500) });
      return;
    }
    await db('campaigns').where('id', campaign_id).update({ state: 'draft', failure_reason: reason, updated_at: new Date() });
    await db('mailing_traces').where({ campaign_id, trace_status: 'outgoing' }).update({ trace_status: 'cancelled' });
  };

  // Check org is still active
  const org = await db('organizations').where('id', org_id).select('status').first();
  if (!org || org.status !== 'active') {
    console.log(`Org ${org_id} suspended, stopping campaign ${campaign_id}`);
    await stopCampaign('Organization suspended');
    return;
  }

  // Check email limit
  try {
    await checkEmailLimit(org_id);
  } catch {
    console.log(`Org ${org_id} hit email limit, stopping campaign ${campaign_id}`);
    await stopCampaign('Monthly email limit reached. Upgrade your plan to send more emails.');
    return;
  }

  if (campaign.state !== 'sending') {
    console.log(`Campaign ${campaign_id} no longer sending, skipping batch ${batch_index}`);
    return;
  }

  // Get or create provider — if this fails, stop the entire campaign
  let provider: EmailProvider;
  try {
    provider = await getProvider(campaign.sending_config_id, org_id);
  } catch (err) {
    console.error(`Campaign ${campaign_id}: provider setup failed:`, err);
    await stopCampaign(`Email provider error: ${(err as Error).message}`);
    return;
  }

  // Get traces with contact data
  const traces = await db('mailing_traces')
    .join('contacts', 'contacts.id', 'mailing_traces.contact_id')
    .whereIn('mailing_traces.id', trace_ids)
    .where('mailing_traces.trace_status', 'outgoing')
    .select(
      'mailing_traces.id as trace_id',
      'mailing_traces.email',
      'contacts.id as contact_id',
      'contacts.first_name',
      'contacts.last_name',
      'contacts.company_name',
      'contacts.custom_fields',
      'contacts.preferences_token',
    );

  // Throttle: delay between each email to avoid overwhelming the mail server
  const SEND_DELAY_MS = 200; // 5 emails/second max per batch worker

  let sentCount = 0;
  let failedCount = 0;
  let consecutiveErrors = 0;

  for (const trace of traces) {
    // Re-check campaign state periodically — stop if cancelled
    if ((sentCount + failedCount) % 50 === 0 && (sentCount + failedCount) > 0) {
      const current = await db('campaigns').where('id', campaign_id).select('state').first();
      if (!current || current.state !== 'sending') {
        console.log(`Campaign ${campaign_id} no longer sending, aborting batch`);
        break;
      }
    }

    // If too many consecutive errors, stop the campaign — something is fundamentally wrong
    if (consecutiveErrors >= 10) {
      console.error(`Campaign ${campaign_id}: ${consecutiveErrors} consecutive errors, stopping campaign`);
      await stopCampaign(`Sending stopped: ${consecutiveErrors} consecutive email failures. Check your email provider settings.`);
      return;
    }

    // Brief pause after errors to avoid hammering a failing server
    if (consecutiveErrors >= 5) {
      console.log(`Campaign ${campaign_id}: ${consecutiveErrors} consecutive errors, pausing 30s`);
      await new Promise((r) => setTimeout(r, 30_000));
    }

    try {
      // 1. Render merge tags (inject unsubscribe_url into context)
      const unsubToken = generateUnsubscribeToken(campaign_id, trace.contact_id, trace.email);
      const unsubscribeUrl = `${env.APP_URL}/unsubscribe/${campaign_id}?contact_id=${trace.contact_id}&token=${unsubToken}`;
      const html = renderMergeTags(campaign.body_html, { ...trace, unsubscribe_url: unsubscribeUrl });

      // 2. Rewrite links + inject pixel + get unsubscribe headers
      const { html: processedHtml, headers } = await rewriteLinks(
        html, campaign_id, trace.trace_id, trace.contact_id, trace.email,
      );

      // 3. Build email message
      const message: EmailMessage = {
        from: campaign.email_from,
        to: trace.email,
        subject: renderMergeTags(campaign.subject, trace),
        html: processedHtml,
        reply_to: campaign.reply_to || undefined,
        headers,
      };

      // 4. Send
      const result = await provider.send(message);

      if (result.success) {
        await db('mailing_traces').where('id', trace.trace_id).update({
          trace_status: 'sent',
          message_id: result.message_id || null,
          sent_at: new Date(),
        });
        sentCount++;
        consecutiveErrors = 0;
        await redis.hincrby(`campaign:${campaign_id}:stats`, 'sent', 1);
        await incrementEmailCounter(org_id);
      } else {
        await db('mailing_traces').where('id', trace.trace_id).update({
          trace_status: 'error',
          failure_type: 'provider_error',
          failure_reason: result.error?.substring(0, 500) || 'Unknown error',
        });
        failedCount++;
        consecutiveErrors++;
        await redis.hincrby(`campaign:${campaign_id}:stats`, 'failed', 1);
      }
    } catch (err) {
      await db('mailing_traces').where('id', trace.trace_id).update({
        trace_status: 'error',
        failure_type: 'smtp_error',
        failure_reason: (err as Error).message.substring(0, 500),
      });
      failedCount++;
      consecutiveErrors++;
      await redis.hincrby(`campaign:${campaign_id}:stats`, 'failed', 1);
    }

    // Throttle between emails
    if (SEND_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
    }
  }

  console.log(`Campaign ${campaign_id} batch ${batch_index + 1}/${total_batches}: ${sentCount} sent, ${failedCount} failed`);

  if (isAutomation) {
    await db('campaigns').where('id', campaign_id).update({
      stat_sent: db.raw('stat_sent + ?', [sentCount]),
      stat_failed: db.raw('stat_failed + ?', [failedCount]),
      updated_at: new Date(),
    });
    await redis.del(`campaign:${campaign_id}:stats`);
    return;
  }

  // Batches can be delayed (send-time optimisation) or finish out of order, so
  // the campaign is done once no outgoing traces remain rather than after the last index.
  const remaining = await db('mailing_traces').where({ campaign_id, trace_status: 'outgoing' }).count('* as n').first();
  if (Number(remaining?.n || 0) === 0) {
    const claimed = await redis.set(`campaign:${campaign_id}:finalized`, '1', 'EX', 60, 'NX');
    if (claimed) await finalizeCampaign(campaign_id);
  }
}

async function finalizeCampaign(campaignId: string) {
  // Flush Redis stats to PostgreSQL
  const stats = await redis.hgetall(`campaign:${campaignId}:stats`);
  const sent = parseInt(stats.sent || '0');
  const failed = parseInt(stats.failed || '0');

  // If every single email failed, revert to draft so user can fix and retry
  if (sent === 0 && failed > 0) {
    await db('campaigns').where('id', campaignId).update({
      state: 'draft',
      failure_reason: `All ${failed} emails failed to send. Check your email provider settings and try again.`,
      stat_sent: 0,
      stat_failed: failed,
      updated_at: new Date(),
    });
    await redis.del(`campaign:${campaignId}:stats`);
    console.log(`Campaign ${campaignId} fully failed (${failed} errors), reverted to draft`);
    return;
  }

  await db('campaigns').where('id', campaignId).update({
    state: 'done',
    sent_date: new Date(),
    stat_sent: sent,
    stat_failed: failed,
    failure_reason: failed > 0 ? `${failed} of ${sent + failed} emails failed` : null,
    updated_at: new Date(),
  });

  // Cleanup Redis
  await redis.del(`campaign:${campaignId}:stats`);
  console.log(`Campaign ${campaignId} completed: ${sent} sent, ${failed} failed`);
}

async function getProvider(sendingConfigId?: string, orgId?: string): Promise<EmailProvider> {
  // Try to use the specified sending config
  if (sendingConfigId && orgId) {
    try {
      const config = await getSendingConfig(orgId, sendingConfigId);
      return createProviderFromConfig(config);
    } catch (err) {
      console.error('Failed to load sending config:', err);
    }
  }

  // Fall back to default provider, then any active provider for this org
  if (orgId) {
    const fallbackConfig = await db('sending_configs')
      .where({ org_id: orgId, is_active: true })
      .orderBy('is_default', 'desc')
      .first();
    if (fallbackConfig?.id) {
      try {
        const config = await getSendingConfig(orgId, fallbackConfig.id);
        return createProviderFromConfig(config);
      } catch (err) {
        console.error('Failed to load fallback sending config:', err);
      }
    }
  }

  throw new Error('No email sending provider configured for this organization');
}

export function createEmailSenderWorker() {
  return new Worker('email-send', sendBatch, {
    connection: redis,
    concurrency: 3,
  });
}
