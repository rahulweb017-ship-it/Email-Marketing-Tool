import { Worker, Job } from 'bullmq';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';

/**
 * A/B Testing Evaluator Worker
 * Runs every 5 minutes to check for A/B test groups that are in 'testing' status
 * and have passed their evaluation_hours window. Automatically picks the winner
 * based on the configured winner_criteria (open_rate or click_rate).
 */
async function evaluateAbTests(_job: Job) {
  const now = new Date();

  // Find test groups that are not completed and have passed their evaluation date
  const groups = await db('ab_test_groups')
    .where('is_completed', false)
    .where('evaluation_date', '<=', now)
    .whereNotNull('evaluation_date')
    .select('id', 'org_id', 'winner_criteria');

  for (const group of groups) {
    try {
      const variants = await db('campaigns')
        .where({ ab_test_group_id: group.id, org_id: group.org_id })
        .select('id', 'name', 'stat_sent', 'stat_opened', 'stat_clicked');

      if (variants.length === 0) continue;

      let winnerId: string | null = null;
      let bestRate = -1;

      for (const v of variants) {
        const sent = Number(v.stat_sent) || 0;
        if (sent === 0) continue;

        let rate: number;
        if (group.winner_criteria === 'click_rate') {
          rate = Number(v.stat_clicked) / sent;
        } else {
          rate = Number(v.stat_opened) / sent;
        }

        if (rate > bestRate) {
          bestRate = rate;
          winnerId = v.id;
        }
      }

      // If no sends yet, pick the first variant
      if (!winnerId) {
        winnerId = variants[0].id;
      }

      await db('ab_test_groups').where({ id: group.id }).update({
        winner_campaign_id: winnerId,
        is_completed: true,
        updated_at: new Date(),
      });

      const winnerName = variants.find((v: { id: string }) => v.id === winnerId)?.name || 'Unknown';
      console.log(`[ab-testing-evaluator] Auto-picked winner "${winnerName}" for group ${group.id}`);
    } catch (err) {
      console.error(`[ab-testing-evaluator] Failed to evaluate group ${group.id}:`, err);
    }
  }

  if (groups.length > 0) {
    console.log(`[ab-testing-evaluator] Evaluated ${groups.length} A/B test group(s)`);
  }
}

export function createAbTestingEvaluatorWorker() {
  return new Worker('ab-testing-evaluate', evaluateAbTests, {
    connection: redis,
    concurrency: 1,
  });
}
