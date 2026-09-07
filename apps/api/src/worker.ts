import 'dotenv/config';
import { queues } from './config/queue.js';
import { createCampaignProcessorWorker } from './workers/campaign-processor.worker.js';
import { createEmailSenderWorker } from './workers/email-sender.worker.js';
import { createAutomationSyncWorker } from './workers/automation-sync.worker.js';
import { createAutomationExecutorWorker } from './workers/automation-executor.worker.js';
import { createAutomationEventWorker } from './workers/automation-event.worker.js';
import { createStatsFlushWorker } from './workers/stats-flush.worker.js';
import { createCampaignSchedulerWorker } from './workers/campaign-scheduler.worker.js';
import { createAbTestingEvaluatorWorker } from './workers/ab-testing-evaluator.worker.js';
import { createOutgoingWebhookWorker } from './workers/outgoing-webhook.worker.js';
import { createEngagementScorerWorker } from './workers/engagement-scorer.worker.js';
import { createSocialPublisherWorker } from './workers/social-publisher.worker.js';
import { createSocialMetricsWorker } from './workers/social-metrics.worker.js';

// Worker intervals
const CAMPAIGN_SCHEDULER_INTERVAL_MS = 60_000; // 60s
const AB_TESTING_EVALUATE_INTERVAL_MS = 300_000; // 5 minutes
const AUTOMATION_SYNC_INTERVAL_MS = 120_000; // 2 minutes
const AUTOMATION_EXECUTE_INTERVAL_MS = 30_000; // 30s
const STATS_FLUSH_INTERVAL_MS = 30_000; // 30s
const ENGAGEMENT_SCORING_INTERVAL_MS = 3_600_000; // 1 hour
const SOCIAL_SCHEDULE_CHECK_INTERVAL_MS = 60_000; // 60s
const SOCIAL_METRICS_INTERVAL_MS = 1_800_000; // 30 minutes

console.log('Starting workers...');

// Create all workers
const workers = [
  createCampaignProcessorWorker(),
  createEmailSenderWorker(),
  createAutomationSyncWorker(),
  createAutomationExecutorWorker(),
  createAutomationEventWorker(),
  createStatsFlushWorker(),
  createCampaignSchedulerWorker(),
  createAbTestingEvaluatorWorker(),
  createOutgoingWebhookWorker(),
  createEngagementScorerWorker(),
  createSocialPublisherWorker(),
  createSocialMetricsWorker(),
];

// Add error logging to all workers
workers.forEach((worker, i) => {
  worker.on('error', (err) => {
    console.error(`Worker ${i} error:`, err);
  });
  worker.on('failed', (job, err) => {
    console.error(`Worker ${i} job ${job?.id} failed:`, err.message);
  });
});

// Set up repeatable jobs (cron-like)
async function setupRepeatableJobs() {
  await queues.automationSync.upsertJobScheduler('sync-participants', {
    every: AUTOMATION_SYNC_INTERVAL_MS,
  }, { data: {} });

  await queues.automationExecute.upsertJobScheduler('execute-traces', {
    every: AUTOMATION_EXECUTE_INTERVAL_MS,
  }, { data: {} });

  await queues.trackingFlush.upsertJobScheduler('flush-stats', {
    every: STATS_FLUSH_INTERVAL_MS,
  }, { data: {} });

  await queues.campaignScheduler.upsertJobScheduler('check-scheduled', {
    every: CAMPAIGN_SCHEDULER_INTERVAL_MS,
  }, { data: {} });

  await queues.abTestingEvaluate.upsertJobScheduler('evaluate-ab-tests', {
    every: AB_TESTING_EVALUATE_INTERVAL_MS,
  }, { data: {} });

  await queues.engagementScoring.upsertJobScheduler('recalculate-engagement-scores', {
    every: ENGAGEMENT_SCORING_INTERVAL_MS,
  }, { data: {} });

  await queues.socialPublish.upsertJobScheduler('check-scheduled-social', {
    every: SOCIAL_SCHEDULE_CHECK_INTERVAL_MS,
  }, { data: {} });

  await queues.socialMetrics.upsertJobScheduler('fetch-social-metrics', {
    every: SOCIAL_METRICS_INTERVAL_MS,
  }, { data: {} });

  console.log('Repeatable jobs scheduled');
}

setupRepeatableJobs().catch(console.error);

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`${workers.length} workers started`);
