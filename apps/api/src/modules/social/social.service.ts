import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { createSocialProvider } from './providers/index.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreatePostInput, UpdatePostInput } from './social.schema.js';

// ─── Encryption (same pattern as sending-config.service.ts) ───
const ENCRYPTION_KEY = crypto.scryptSync(env.HMAC_SECRET, 'social-tokens', 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Account Management ───

export async function listAccounts(orgId: string) {
  const accounts = await db('social_accounts')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc')
    .select('id', 'platform', 'platform_account_id', 'account_name',
      'account_avatar_url', 'account_type', 'is_active', 'last_error',
      'last_verified_at', 'token_expires_at', 'created_at', 'updated_at');
  return accounts;
}

export async function getAccount(orgId: string, accountId: string) {
  const account = await db('social_accounts')
    .where({ id: accountId, org_id: orgId })
    .first();
  if (!account) throw new AppError(404, 'Social account not found');
  return account;
}

export async function initiateOAuth(orgId: string, userId: string, platform: string) {
  const provider = createSocialProvider(platform);
  const stateToken = uuidv4();
  const redirectUri = env.SOCIAL_OAUTH_CALLBACK_URL || `${env.APP_URL}/api/v1/social/accounts/callback`;

  // Store state in Redis (10 min TTL)
  await redis.set(
    `social:oauth:${stateToken}`,
    JSON.stringify({ org_id: orgId, user_id: userId, platform }),
    'EX', 600,
  );

  const authUrl = provider.getAuthUrl(stateToken, redirectUri);
  return { auth_url: authUrl, state: stateToken };
}

export async function handleOAuthCallback(stateParam: string, code: string) {
  // For Twitter, state might be JSON with code_verifier
  let stateToken = stateParam;
  let codeVerifier: string | undefined;

  try {
    const parsed = JSON.parse(stateParam);
    stateToken = parsed.state;
    codeVerifier = parsed.code_verifier;
  } catch {
    // Not JSON, use as-is
  }

  // Look up state from Redis
  const stateData = await redis.get(`social:oauth:${stateToken}`);
  if (!stateData) {
    throw new AppError(400, 'Invalid or expired OAuth state. Please try connecting again.');
  }

  const { org_id, platform } = JSON.parse(stateData) as {
    org_id: string;
    user_id: string;
    platform: string;
  };

  // Delete state (one-time use)
  await redis.del(`social:oauth:${stateToken}`);

  const provider = createSocialProvider(platform);
  const redirectUri = env.SOCIAL_OAUTH_CALLBACK_URL || `${env.APP_URL}/api/v1/social/accounts/callback`;

  // Exchange code for tokens
  const tokenData = await (provider as any).exchangeCode(code, redirectUri, codeVerifier);

  // Check if account already connected
  const existing = await db('social_accounts')
    .where({
      org_id,
      platform,
      platform_account_id: tokenData.account_id,
    })
    .first();

  if (existing) {
    // Update tokens
    await db('social_accounts').where('id', existing.id).update({
      access_token_encrypted: encrypt(tokenData.access_token),
      refresh_token_encrypted: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : existing.refresh_token_encrypted,
      token_expires_at: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null,
      account_name: tokenData.account_name,
      account_avatar_url: tokenData.account_avatar_url || existing.account_avatar_url,
      is_active: true,
      last_error: null,
      last_verified_at: new Date(),
      updated_at: new Date(),
    });
    return { account_id: existing.id, platform, reconnected: true };
  }

  // Create new account
  const id = uuidv4();
  await db('social_accounts').insert({
    id,
    org_id,
    platform,
    platform_account_id: tokenData.account_id,
    account_name: tokenData.account_name,
    account_avatar_url: tokenData.account_avatar_url,
    account_type: tokenData.account_type || 'personal',
    access_token_encrypted: encrypt(tokenData.access_token),
    refresh_token_encrypted: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
    token_expires_at: tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null,
    scopes: tokenData.scopes,
    is_active: true,
    last_verified_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  });

  return { account_id: id, platform, reconnected: false };
}

export async function disconnectAccount(orgId: string, accountId: string) {
  const account = await getAccount(orgId, accountId);
  await db('social_accounts').where('id', account.id).delete();
}

export async function verifyAccount(orgId: string, accountId: string) {
  const account = await getAccount(orgId, accountId);
  const provider = createSocialProvider(account.platform);
  const accessToken = decrypt(account.access_token_encrypted);

  const valid = await provider.verifyToken(accessToken);

  await db('social_accounts').where('id', accountId).update({
    is_active: valid,
    last_error: valid ? null : 'Token verification failed',
    last_verified_at: new Date(),
    updated_at: new Date(),
  });

  return { is_active: valid };
}

export async function getDecryptedToken(accountId: string): Promise<{ access_token: string; refresh_token?: string }> {
  const account = await db('social_accounts').where('id', accountId).first();
  if (!account) throw new AppError(404, 'Social account not found');

  return {
    access_token: decrypt(account.access_token_encrypted),
    refresh_token: account.refresh_token_encrypted ? decrypt(account.refresh_token_encrypted) : undefined,
  };
}

export async function refreshAccountToken(accountId: string) {
  const account = await db('social_accounts').where('id', accountId).first();
  if (!account) throw new AppError(404, 'Social account not found');
  if (!account.refresh_token_encrypted) return; // Can't refresh without refresh token

  const provider = createSocialProvider(account.platform);
  const refreshTokenValue = decrypt(account.refresh_token_encrypted);

  try {
    const newTokens = await provider.refreshToken(refreshTokenValue);

    await db('social_accounts').where('id', accountId).update({
      access_token_encrypted: encrypt(newTokens.access_token),
      refresh_token_encrypted: newTokens.refresh_token ? encrypt(newTokens.refresh_token) : account.refresh_token_encrypted,
      token_expires_at: newTokens.expires_in
        ? new Date(Date.now() + newTokens.expires_in * 1000)
        : null,
      last_error: null,
      updated_at: new Date(),
    });
  } catch (err: any) {
    await db('social_accounts').where('id', accountId).update({
      is_active: false,
      last_error: `Token refresh failed: ${err.message}`,
      updated_at: new Date(),
    });
    throw err;
  }
}

// ─── Post Management ───

export async function listPosts(orgId: string, pagination: PaginationParams, filters?: { status?: string; from?: string; to?: string }) {
  let query = db('social_posts').where('social_posts.org_id', orgId);

  if (filters?.status) query = query.where('social_posts.status', filters.status);
  if (filters?.from) query = query.where('social_posts.created_at', '>=', filters.from);
  if (filters?.to) query = query.where('social_posts.created_at', '<=', filters.to);

  const countQuery = query.clone();
  const [{ count }] = await countQuery.count('* as count');

  const posts = await query
    .orderBy('social_posts.created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset)
    .select('social_posts.*');

  // Attach accounts for each post
  const postIds = posts.map((p: any) => p.id);
  const postAccounts = postIds.length > 0
    ? await db('social_post_accounts')
        .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
        .whereIn('social_post_accounts.post_id', postIds)
        .select(
          'social_post_accounts.*',
          'social_accounts.platform',
          'social_accounts.account_name',
          'social_accounts.account_avatar_url',
        )
    : [];

  const postsWithAccounts = posts.map((post: any) => ({
    ...post,
    accounts: postAccounts.filter((pa: any) => pa.post_id === post.id),
  }));

  return { data: postsWithAccounts, total: Number(count) };
}

export async function getPost(orgId: string, postId: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');

  const accounts = await db('social_post_accounts')
    .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
    .where('social_post_accounts.post_id', postId)
    .select(
      'social_post_accounts.*',
      'social_accounts.platform',
      'social_accounts.account_name',
      'social_accounts.account_avatar_url',
    );

  const media = await db('social_post_media')
    .where('post_id', postId)
    .orderBy('sort_order', 'asc');

  const metrics = await db('social_post_metrics')
    .whereIn('post_account_id', accounts.map((a: any) => a.id))
    .orderBy('fetched_at', 'desc');

  return { ...post, accounts, media, metrics };
}

export async function createPost(orgId: string, userId: string, input: CreatePostInput) {
  const id = uuidv4();

  // Verify all accounts belong to this org
  const accounts = await db('social_accounts')
    .where('org_id', orgId)
    .whereIn('id', input.account_ids)
    .where('is_active', true);

  if (accounts.length !== input.account_ids.length) {
    throw new AppError(400, 'One or more selected accounts are invalid or inactive');
  }

  const status = input.scheduled_at ? 'scheduled' : 'draft';

  await db.transaction(async (trx) => {
    await trx('social_posts').insert({
      id,
      org_id: orgId,
      content: input.content,
      status,
      scheduled_at: input.scheduled_at || null,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const postAccountRows = input.account_ids.map(accountId => ({
      id: uuidv4(),
      post_id: id,
      account_id: accountId,
      status: 'pending',
    }));

    await trx('social_post_accounts').insert(postAccountRows);

    // Link media if provided
    if (input.media_ids && input.media_ids.length > 0) {
      await trx('social_post_media')
        .whereIn('id', input.media_ids)
        .update({ post_id: id });
    }
  });

  return getPost(orgId, id);
}

export async function updatePost(orgId: string, postId: string, input: UpdatePostInput) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new AppError(400, 'Can only edit draft or scheduled posts');
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.content !== undefined) updates.content = input.content;
  if (input.scheduled_at !== undefined) {
    updates.scheduled_at = input.scheduled_at;
    updates.status = input.scheduled_at ? 'scheduled' : 'draft';
  }

  await db.transaction(async (trx) => {
    await trx('social_posts').where('id', postId).update(updates);

    if (input.account_ids) {
      // Replace accounts
      await trx('social_post_accounts').where('post_id', postId).delete();
      const rows = input.account_ids.map(accountId => ({
        id: uuidv4(),
        post_id: postId,
        account_id: accountId,
        status: 'pending',
      }));
      await trx('social_post_accounts').insert(rows);
    }
  });

  return getPost(orgId, postId);
}

export async function deletePost(orgId: string, postId: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new AppError(400, 'Can only delete draft or scheduled posts');
  }
  await db('social_posts').where('id', postId).delete();
}

export async function publishPost(orgId: string, postId: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new AppError(400, 'Can only publish draft or scheduled posts');
  }

  await db('social_posts').where('id', postId).update({
    status: 'publishing',
    updated_at: new Date(),
  });

  // Add job to publish queue
  const { socialPublishQueue } = await import('../../config/queue.js');
  await socialPublishQueue.add('publish-social-post', {
    post_id: postId,
    org_id: orgId,
  });

  return getPost(orgId, postId);
}

export async function schedulePost(orgId: string, postId: string, scheduledAt: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (!['draft', 'scheduled'].includes(post.status)) {
    throw new AppError(400, 'Can only schedule draft or scheduled posts');
  }

  await db('social_posts').where('id', postId).update({
    status: 'scheduled',
    scheduled_at: scheduledAt,
    updated_at: new Date(),
  });

  return getPost(orgId, postId);
}

export async function getCalendarPosts(orgId: string, start: string, end: string) {
  const posts = await db('social_posts')
    .where('org_id', orgId)
    .whereIn('status', ['scheduled', 'published', 'publishing', 'partially_failed', 'failed'])
    .where(function () {
      this.whereBetween('scheduled_at', [start, end])
        .orWhereBetween('published_at', [start, end]);
    })
    .orderBy('scheduled_at', 'asc')
    .select('*');

  const postIds = posts.map((p: any) => p.id);
  const postAccounts = postIds.length > 0
    ? await db('social_post_accounts')
        .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
        .whereIn('social_post_accounts.post_id', postIds)
        .select(
          'social_post_accounts.post_id',
          'social_accounts.platform',
          'social_accounts.account_name',
          'social_post_accounts.status',
        )
    : [];

  return posts.map((post: any) => ({
    ...post,
    accounts: postAccounts.filter((pa: any) => pa.post_id === post.id),
  }));
}

export async function getPostMetrics(orgId: string, postId: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');

  const postAccounts = await db('social_post_accounts')
    .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
    .where('social_post_accounts.post_id', postId)
    .select(
      'social_post_accounts.id as post_account_id',
      'social_accounts.platform',
      'social_accounts.account_name',
      'social_post_accounts.platform_post_id',
      'social_post_accounts.status',
    );

  const metrics = await db('social_post_metrics')
    .whereIn('post_account_id', postAccounts.map((pa: any) => pa.post_account_id))
    .orderBy('fetched_at', 'desc');

  return postAccounts.map((pa: any) => ({
    ...pa,
    metrics: metrics.find((m: any) => m.post_account_id === pa.post_account_id) || null,
  }));
}

// ─── Media Upload ───

export async function uploadMedia(orgId: string, fileUrl: string, fileType: string, fileSize: number) {
  const id = uuidv4();
  await db('social_post_media').insert({
    id,
    post_id: null, // Will be linked when post is created
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize,
    sort_order: 0,
    created_at: new Date(),
  });
  return { id, file_url: fileUrl, file_type: fileType };
}
