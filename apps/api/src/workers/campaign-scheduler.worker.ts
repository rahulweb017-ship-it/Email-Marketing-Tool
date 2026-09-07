import { Worker, Job } from 'bullmq';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { campaignProcessQueue } from '../config/queue.js';
import { validateCampaignReadyToSend } from '../modules/campaigns/campaign.service.js';

/**
 * Campaign Scheduler Worker
 * Runs every 60 seconds to check for scheduled campaigns whose
 * schedule_date has passed, then validates and transitions them to in_queue.
 */
async function checkScheduledCampaigns(_job: Job) {
  const campaigns = await db('campaigns')
    .where('state', 'scheduled')
    .where('schedule_date', '<=', new Date())
    .select('*');

  for (const campaign of campaigns) {
    try {
      // Re-validate before sending — settings may have changed since scheduling
      await validateCampaignReadyToSend(campaign, campaign.org_id, campaign.id);

      await db('campaigns').where('id', campaign.id).update({
        state: 'in_queue',
        failure_reason: null,
        updated_at: new Date(),
      });
      await campaignProcessQueue.add('process-campaign', {
        campaign_id: campaign.id,
        org_id: campaign.org_id,
      });
      console.log(`[scheduler] Campaign ${campaign.id} validated and queued`);
    } catch (err) {
      // Validation failed — revert to draft with error so user can fix and retry
      const reason = (err as Error).message || 'Unknown validation error';
      await db('campaigns').where('id', campaign.id).update({
        state: 'draft',
        failure_reason: `Scheduled send failed: ${reason}`,
        updated_at: new Date(),
      });
      console.error(`[scheduler] Campaign ${campaign.id} failed validation: ${reason}`);
    }
  }

  if (campaigns.length > 0) {
    console.log(`[scheduler] Processed ${campaigns.length} scheduled campaign(s)`);
  }
}

export function createCampaignSchedulerWorker() {
  return new Worker('email-campaign-scheduler', checkScheduledCampaigns, {
    connection: redis,
    concurrency: 1,
  });
}
