import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis.js';
import { db } from '../config/database.js';
import { createSocialProvider } from '../modules/social/providers/index.js';
import * as socialService from '../modules/social/social.service.js';

interface PublishSocialPostJob {
  post_id: string;
  org_id: string;
}

async function processPublishJob(job: Job<PublishSocialPostJob>) {
  const { post_id, org_id } = job.data;

  console.log(`[social-publisher] Publishing post ${post_id}`);

  const postAccounts = await db('social_post_accounts')
    .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
    .where('social_post_accounts.post_id', post_id)
    .where('social_post_accounts.status', 'pending')
    .select(
      'social_post_accounts.id as post_account_id',
      'social_post_accounts.account_id',
      'social_post_accounts.content_override',
      'social_post_accounts.first_comment',
      'social_accounts.platform',
      'social_accounts.access_token_encrypted',
      'social_accounts.refresh_token_encrypted',
      'social_accounts.token_expires_at',
      'social_accounts.is_active',
    );

  if (postAccounts.length === 0) {
    console.log(`[social-publisher] No pending accounts for post ${post_id}`);
    return;
  }

  const post = await db('social_posts').where({ id: post_id, org_id }).first();
  if (!post) return;

  // Get media for this post
  const media = await db('social_post_media')
    .where('post_id', post_id)
    .orderBy('sort_order', 'asc');

  let successCount = 0;
  let failCount = 0;

  for (const pa of postAccounts) {
    try {
      if (!pa.is_active) {
        throw new Error('Account is inactive');
      }

      // Refresh token if expiring soon (within 5 min)
      if (pa.token_expires_at && new Date(pa.token_expires_at).getTime() < Date.now() + 5 * 60 * 1000) {
        try {
          await socialService.refreshAccountToken(pa.account_id);
        } catch (err: any) {
          throw new Error(`Token refresh failed: ${err.message}`);
        }
      }

      const tokens = await socialService.getDecryptedToken(pa.account_id);
      const provider = createSocialProvider(pa.platform);

      // Upload media to platform if needed
      const mediaIds: string[] = [];
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];
      for (const m of media) {
        mediaUrls.push(m.file_url);
        mediaTypes.push(m.file_type);
        try {
          const platformMediaId = await provider.uploadMedia(tokens.access_token, m.file_url, m.file_type);
          mediaIds.push(platformMediaId);
        } catch (err: any) {
          console.warn(`[social-publisher] Media upload failed for ${pa.platform}: ${err.message}`);
        }
      }

      // Publish
      const result = await provider.publish(tokens.access_token, {
        content: pa.content_override || post.content,
        media_ids: mediaIds.length > 0 ? mediaIds : undefined,
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
        media_types: mediaTypes.length > 0 ? mediaTypes : undefined,
      });

      if (result.success) {
        await db('social_post_accounts').where('id', pa.post_account_id).update({
          status: 'published',
          platform_post_id: result.platform_post_id,
          platform_post_url: result.platform_post_url,
          published_at: new Date(),
        });
        successCount++;
        if (pa.first_comment && result.platform_post_id && provider.postComment) {
          try {
            await provider.postComment(tokens.access_token, result.platform_post_id, pa.first_comment);
          } catch (err: any) {
            // The post itself is live; a failed first comment must not mark it failed
            console.warn(`[social-publisher] First comment failed for ${pa.platform}: ${err.message}`);
          }
        }
      } else {
        throw new Error(result.error || 'Publish returned unsuccessful');
      }
    } catch (err: any) {
      console.error(`[social-publisher] Failed for ${pa.platform} (account ${pa.account_id}): ${err.message}`);
      await db('social_post_accounts').where('id', pa.post_account_id).update({
        status: 'failed',
        error_message: err.message,
      });
      failCount++;
    }
  }

  // Aggregate over every account row so a retry counts earlier successes too
  const all = await db('social_post_accounts').where('post_id', post_id).select('status');
  const published = all.filter((r: any) => r.status === 'published').length;
  const failed = all.filter((r: any) => r.status === 'failed').length;
  let postStatus: string;
  if (failed === 0) {
    postStatus = 'published';
  } else if (published === 0) {
    postStatus = 'failed';
  } else {
    postStatus = 'partially_failed';
  }

  await db('social_posts').where('id', post_id).update({
    status: postStatus,
    published_at: published > 0 ? (post.published_at || new Date()) : null,
    updated_at: new Date(),
  });

  console.log(`[social-publisher] Post ${post_id}: ${successCount} success, ${failCount} failed → ${postStatus}`);
}

async function checkScheduledPosts(job: Job) {
  const now = new Date();

  const scheduledPosts = await db('social_posts')
    .where('status', 'scheduled')
    .where('scheduled_at', '<=', now)
    .select('id', 'org_id');

  if (scheduledPosts.length === 0) return;

  console.log(`[social-publisher] Found ${scheduledPosts.length} scheduled posts ready to publish`);

  const { socialPublishQueue } = await import('../config/queue.js');

  for (const post of scheduledPosts) {
    await db('social_posts').where('id', post.id).update({
      status: 'publishing',
      updated_at: new Date(),
    });

    await socialPublishQueue.add('publish-social-post', {
      post_id: post.id,
      org_id: post.org_id,
    });
  }
}

export function createSocialPublisherWorker() {
  return new Worker('social-publish', async (job) => {
    if (job.name === 'check-scheduled-social') {
      await checkScheduledPosts(job);
    } else {
      await processPublishJob(job as Job<PublishSocialPostJob>);
    }
  }, {
    connection: redis,
    concurrency: 5,
  });
}
