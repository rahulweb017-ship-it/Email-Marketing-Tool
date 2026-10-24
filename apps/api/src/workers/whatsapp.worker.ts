import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { enqueueDueCampaigns, expandCampaign } from '../modules/whatsapp/whatsapp-campaigns.service.js';
import { processInboundEvent, processMetaWebhook, type InboundEvent } from '../modules/whatsapp/whatsapp-inbound.service.js';
import { runAutoReply } from '../modules/whatsapp/whatsapp-ai.service.js';

/** Campaign expansion + the scheduled-campaign check. */
export function createWhatsAppCampaignWorker() {
  return new Worker('whatsapp-campaign', async (job) => {
    if (job.name === 'check-scheduled-whatsapp') return enqueueDueCampaigns();
    if (job.name === 'expand') return expandCampaign(job.data.campaign_id);
  }, { connection: redis, concurrency: 2 });
}

/** Meta webhooks and QR-session events share one processor. */
export function createWhatsAppInboundWorker() {
  return new Worker('whatsapp-inbound', async (job) => {
    if (job.name === 'meta-webhook') return processMetaWebhook(job.data.payload);
    if (job.name === 'event') return processInboundEvent(job.data as InboundEvent);
  }, { connection: redis, concurrency: 5 });
}

export function createWhatsAppAiWorker() {
  return new Worker('whatsapp-ai-reply', async (job) => {
    return runAutoReply(job.data.conversation_id, job.data.message_id);
  }, { connection: redis, concurrency: 3 });
}
