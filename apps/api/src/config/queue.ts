import { Queue } from 'bullmq';
import { redis } from './redis.js';

const defaultOpts = { connection: redis };

export const emailSendQueue = new Queue('email-send', defaultOpts);
export const campaignProcessQueue = new Queue('email-campaign-process', defaultOpts);
export const campaignSchedulerQueue = new Queue('email-campaign-scheduler', defaultOpts);
export const trackingProcessQueue = new Queue('tracking-process', defaultOpts);
export const trackingFlushQueue = new Queue('tracking-flush', defaultOpts);
export const automationSyncQueue = new Queue('automation-sync', defaultOpts);
export const automationExecuteQueue = new Queue('automation-execute', defaultOpts);
export const automationEventQueue = new Queue('automation-event', defaultOpts);
export const abTestingEvaluateQueue = new Queue('ab-testing-evaluate', defaultOpts);
export const webhookProcessQueue = new Queue('webhook-process', defaultOpts);
export const importContactsQueue = new Queue('import-contacts', defaultOpts);
export const engagementScoringQueue = new Queue('engagement-scoring', defaultOpts);
export const socialPublishQueue = new Queue('social-publish', defaultOpts);
export const socialMetricsQueue = new Queue('social-metrics', defaultOpts);

export const queues = {
  emailSend: emailSendQueue,
  campaignProcess: campaignProcessQueue,
  campaignScheduler: campaignSchedulerQueue,
  trackingProcess: trackingProcessQueue,
  trackingFlush: trackingFlushQueue,
  automationSync: automationSyncQueue,
  automationExecute: automationExecuteQueue,
  automationEvent: automationEventQueue,
  abTestingEvaluate: abTestingEvaluateQueue,
  webhookProcess: webhookProcessQueue,
  importContacts: importContactsQueue,
  engagementScoring: engagementScoringQueue,
  socialPublish: socialPublishQueue,
  socialMetrics: socialMetricsQueue,
};
