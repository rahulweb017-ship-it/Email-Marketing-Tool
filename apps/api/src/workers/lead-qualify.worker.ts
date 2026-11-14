import { Worker } from 'bullmq';
import { redis } from '../config/redis.js';
import { qualifyLead } from '../modules/ai/leads-ai.service.js';

export function createLeadQualifyWorker() {
  return new Worker('lead-qualify', async (job) => {
    await qualifyLead(job.data.lead_id, { silent: true });
  }, { connection: redis, concurrency: 3 });
}
