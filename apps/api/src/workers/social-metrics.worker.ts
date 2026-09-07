import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis.js';
import { db } from '../config/database.js';
import { createSocialProvider } from '../modules/social/providers/index.js';
import * as socialService from '../modules/social/social.service.js';
import { v4 as uuidv4 } from 'uuid';

async function fetchSocialMetrics(_job: Job) {
  // Get recently published posts (last 7 days) with platform_post_id
  const postAccounts = await db('social_post_accounts')
    .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
    .join('social_posts', 'social_post_accounts.post_id', 'social_posts.id')
    .where('social_post_accounts.status', 'published')
    .whereNotNull('social_post_accounts.platform_post_id')
    .where('social_post_accounts.published_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .select(
      'social_post_accounts.id as post_account_id',
      'social_post_accounts.platform_post_id',
      'social_post_accounts.account_id',
      'social_accounts.platform',
      'social_accounts.is_active',
    );

  if (postAccounts.length === 0) return;

  console.log(`[social-metrics] Fetching metrics for ${postAccounts.length} post-accounts`);

  let successCount = 0;
  let failCount = 0;

  // Group by platform for rate limit awareness
  const byPlatform = new Map<string, typeof postAccounts>();
  for (const pa of postAccounts) {
    const list = byPlatform.get(pa.platform) || [];
    list.push(pa);
    byPlatform.set(pa.platform, list);
  }

  for (const [platform, accounts] of byPlatform) {
    const provider = createSocialProvider(platform);

    for (const pa of accounts) {
      if (!pa.is_active) continue;

      try {
        const tokens = await socialService.getDecryptedToken(pa.account_id);
        const metrics = await provider.getMetrics(tokens.access_token, pa.platform_post_id);

        // Upsert metrics
        const existing = await db('social_post_metrics')
          .where('post_account_id', pa.post_account_id)
          .first();

        if (existing) {
          await db('social_post_metrics').where('id', existing.id).update({
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            reach: metrics.reach,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            fetched_at: new Date(),
          });
        } else {
          await db('social_post_metrics').insert({
            id: uuidv4(),
            post_account_id: pa.post_account_id,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            reach: metrics.reach,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            fetched_at: new Date(),
          });
        }

        successCount++;
      } catch (err: any) {
        failCount++;
        if (err.isRateLimit) {
          console.warn(`[social-metrics] Rate limited on ${platform}, skipping remaining`);
          break; // Skip rest of this platform
        }
        console.warn(`[social-metrics] Failed for ${platform} post ${pa.platform_post_id}: ${err.message}`);
      }
    }
  }

  console.log(`[social-metrics] Done: ${successCount} updated, ${failCount} failed`);
}

export function createSocialMetricsWorker() {
  return new Worker('social-metrics', fetchSocialMetrics, {
    connection: redis,
    concurrency: 1,
  });
}
