import { Worker, Job } from 'bullmq';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { syncUsageToDB } from '../modules/usage/usage.service.js';

let flushCount = 0;

/**
 * Stats Flush Worker
 * Flushes real-time Redis counters to PostgreSQL denormalized columns.
 * Runs every 30 seconds as a repeatable job.
 * Also syncs usage tracking every ~5 minutes (every 10th run).
 */
async function flushStats(job: Job) {
  // Find all campaign stat hashes in Redis
  const keys = await redis.keys('campaign:*:stats');

  for (const key of keys) {
    const campaignId = key.split(':')[1];
    const stats = await redis.hgetall(key);

    if (Object.keys(stats).length === 0) continue;

    await db('campaigns').where('id', campaignId).update({
      stat_sent: parseInt(stats.sent || '0'),
      stat_delivered: parseInt(stats.delivered || '0'),
      stat_opened: parseInt(stats.opened || '0'),
      stat_clicked: parseInt(stats.clicked || '0'),
      stat_replied: parseInt(stats.replied || '0'),
      stat_bounced: parseInt(stats.bounced || '0'),
      stat_failed: parseInt(stats.failed || '0'),
      updated_at: new Date(),
    });
  }

  // Sync usage tracking every 10th run (~5 minutes)
  flushCount++;
  if (flushCount % 10 === 0) {
    try {
      await syncUsageToDB();
    } catch (err) {
      console.error('Usage sync error:', (err as Error).message);
    }
  }
}

export function createStatsFlushWorker() {
  return new Worker('tracking-flush', flushStats, {
    connection: redis,
    concurrency: 1,
  });
}
