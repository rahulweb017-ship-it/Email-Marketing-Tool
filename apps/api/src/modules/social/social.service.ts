import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { createSocialProvider, assertPlatformConfigured } from './providers/index.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreatePostInput, UpdatePostInput, ListPostsQuery, ScheduleMode } from './social.schema.js';
import {
  nextQueueSlot, defaultQueueSlots, isValidTimeZone, validatePostForPlatforms, DEFAULT_QUEUE_TIMEZONE,
  type QueueSlot,
} from './social.utils.js';

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
  assertPlatformConfigured(platform);
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
  const tokenData = await provider.exchangeCode(code, redirectUri, codeVerifier);

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

export interface SocialActor {
  id: string;
  role: string;
  is_super_admin?: boolean;
}

/** Owners/admins (and super admins acting on a tenant) publish without review. */
export function canApprove(actor: SocialActor): boolean {
  return !!actor.is_super_admin || ['admin', 'owner'].includes(actor.role);
}

interface MediaItem { url: string; type: string; alt_text?: string | null; file_size?: number | null }
interface OverrideItem { account_id: string; content_override?: string | null; first_comment?: string | null }

const SENT_STATUSES = ['publishing', 'published', 'partially_failed', 'failed'];
const EDITABLE_STATUSES = ['draft', 'scheduled', 'pending_approval'];

async function enqueuePublish(orgId: string, postId: string) {
  const { socialPublishQueue } = await import('../../config/queue.js');
  await socialPublishQueue.add('publish-social-post', { post_id: postId, org_id: orgId });
}

async function loadOrgAccounts(orgId: string, accountIds: string[]) {
  if (accountIds.length === 0) return [];
  const accounts = await db('social_accounts')
    .where('org_id', orgId)
    .whereIn('id', accountIds)
    .where('is_active', true)
    .select('id', 'platform', 'account_name');
  if (accounts.length !== accountIds.length) {
    throw new AppError(400, 'One or more selected accounts are invalid or inactive');
  }
  return accounts as Array<{ id: string; platform: string; account_name: string }>;
}

async function filterOrgTags(orgId: string, tagIds: string[] | undefined): Promise<string[] | undefined> {
  if (!tagIds) return undefined;
  if (tagIds.length === 0) return [];
  const rows = await db('social_tags').where('org_id', orgId).whereIn('id', tagIds).select('id');
  const valid = new Set(rows.map((r: any) => r.id));
  return tagIds.filter((t) => valid.has(t));
}

export async function getQueueTimezone(orgId: string): Promise<string> {
  const row = await db('social_queue_settings').where('org_id', orgId).first();
  return row?.timezone && isValidTimeZone(row.timezone) ? row.timezone : DEFAULT_QUEUE_TIMEZONE;
}

/**
 * 'queue' takes the first free slot after the latest post already queued for
 * these accounts (Buffer's "add to queue"); 'queue_top' takes the soonest free
 * slot after now without shifting other posts. Slots are the union of the
 * selected accounts' slots (or the defaults when none are set), and a slot is
 * taken when any selected account already has a post scheduled at that minute.
 */
export async function computeQueueSlot(orgId: string, accountIds: string[], mode: 'queue' | 'queue_top', excludePostId?: string): Promise<Date> {
  if (accountIds.length === 0) throw new AppError(400, 'Select at least one channel');
  const timezone = await getQueueTimezone(orgId);
  const slotRows = await db('social_queue_slots')
    .where('org_id', orgId)
    .whereIn('account_id', accountIds)
    .select('day_of_week', 'time_of_day');
  const slots: QueueSlot[] = slotRows.length ? slotRows : defaultQueueSlots();

  let busy = db('social_posts')
    .where('social_posts.org_id', orgId)
    .whereIn('social_posts.status', ['scheduled', 'pending_approval'])
    .whereNotNull('social_posts.scheduled_at')
    .whereExists(
      db('social_post_accounts')
        .whereRaw('social_post_accounts.post_id = social_posts.id')
        .whereIn('social_post_accounts.account_id', accountIds),
    );
  if (excludePostId) busy = busy.whereNot('social_posts.id', excludePostId);
  const rows = await busy.select('social_posts.scheduled_at', 'social_posts.queued');

  const now = new Date();
  let after = now;
  if (mode === 'queue') {
    for (const r of rows) {
      const t = new Date(r.scheduled_at);
      if (r.queued && t > after) after = t;
    }
  }
  const next = nextQueueSlot({ slots, timezone, after, taken: rows.map((r: any) => r.scheduled_at) });
  if (!next) throw new AppError(400, 'No free queue slot in the next 8 weeks. Add more posting times in Queue settings.');
  return next;
}

async function resolveSchedule(
  orgId: string, actor: SocialActor, mode: ScheduleMode, scheduledAt: string | null | undefined,
  accountIds: string[], excludePostId?: string,
) {
  let status = 'draft';
  let when: Date | null = null;
  let queued = false;
  if (mode === 'now') {
    status = 'publishing';
  } else if (mode === 'custom') {
    if (!scheduledAt) throw new AppError(400, 'Pick a date and time');
    when = new Date(scheduledAt);
    if (when.getTime() < Date.now() - 60_000) throw new AppError(400, 'Pick a time in the future');
    status = 'scheduled';
  } else if (mode === 'queue' || mode === 'queue_top') {
    when = await computeQueueSlot(orgId, accountIds, mode, excludePostId);
    status = 'scheduled';
    queued = true;
  }
  if (status !== 'draft' && accountIds.length === 0) throw new AppError(400, 'Select at least one channel');
  if (status !== 'draft' && !canApprove(actor)) status = 'pending_approval';
  return { status, scheduled_at: when, queued, publishNow: status === 'publishing' };
}

function assertPublishable(
  accounts: Array<{ id: string; platform: string }>, content: string,
  overrides: Map<string, OverrideItem>, media: Array<{ type: string }>,
) {
  const errors = validatePostForPlatforms(
    accounts.map((a) => ({ platform: a.platform, content: overrides.get(a.id)?.content_override || content })),
    media,
  );
  if (errors.length) throw new AppError(400, errors.join('. '), { errors });
}

async function attachDetails(posts: any[]) {
  const postIds = posts.map((p) => p.id);
  if (postIds.length === 0) return posts;
  const [postAccounts, media] = await Promise.all([
    db('social_post_accounts')
      .join('social_accounts', 'social_post_accounts.account_id', 'social_accounts.id')
      .whereIn('social_post_accounts.post_id', postIds)
      .select(
        'social_post_accounts.*',
        'social_accounts.platform',
        'social_accounts.account_name',
        'social_accounts.account_avatar_url',
      ),
    db('social_post_media').whereIn('post_id', postIds).orderBy('sort_order', 'asc'),
  ]);
  return posts.map((post) => ({
    ...post,
    tags: Array.isArray(post.tags) ? post.tags : [],
    accounts: postAccounts.filter((pa: any) => pa.post_id === post.id),
    media: media.filter((m: any) => m.post_id === post.id),
  }));
}

export async function listPosts(orgId: string, pagination: PaginationParams, filters: ListPostsQuery = {}) {
  let query = db('social_posts').where('social_posts.org_id', orgId);

  if (filters.tab === 'queue') query = query.where('social_posts.status', 'scheduled');
  else if (filters.tab === 'drafts') query = query.where('social_posts.status', 'draft');
  else if (filters.tab === 'approvals') query = query.where('social_posts.status', 'pending_approval');
  else if (filters.tab === 'sent') query = query.whereIn('social_posts.status', SENT_STATUSES);
  else if (filters.status) query = query.where('social_posts.status', filters.status);

  if (filters.account_id) {
    query = query.whereExists(
      db('social_post_accounts')
        .whereRaw('social_post_accounts.post_id = social_posts.id')
        .where('social_post_accounts.account_id', filters.account_id),
    );
  }
  if (filters.tag) query = query.whereRaw('social_posts.tags @> ?::jsonb', [JSON.stringify([filters.tag])]);
  if (filters.from) query = query.where('social_posts.created_at', '>=', filters.from);
  if (filters.to) query = query.where('social_posts.created_at', '<=', filters.to);

  const [{ count }] = await query.clone().count('* as count');

  if (filters.tab === 'queue') query = query.orderBy('social_posts.scheduled_at', 'asc');
  else if (filters.tab === 'approvals') query = query.orderByRaw('coalesce(social_posts.scheduled_at, social_posts.created_at) asc');
  else if (filters.tab === 'sent') query = query.orderByRaw('coalesce(social_posts.published_at, social_posts.updated_at) desc');
  else if (filters.tab === 'drafts') query = query.orderBy('social_posts.updated_at', 'desc');
  else query = query.orderBy('social_posts.created_at', 'desc');

  const posts = await query
    .leftJoin('users', 'users.id', 'social_posts.created_by')
    .limit(pagination.per_page)
    .offset(pagination.offset)
    .select('social_posts.*', 'users.name as created_by_name');

  return { data: await attachDetails(posts), total: Number(count) };
}

export async function getPostCounts(orgId: string, filters: { account_id?: string; tag?: string } = {}) {
  let query = db('social_posts').where('social_posts.org_id', orgId);
  if (filters.account_id) {
    query = query.whereExists(
      db('social_post_accounts')
        .whereRaw('social_post_accounts.post_id = social_posts.id')
        .where('social_post_accounts.account_id', filters.account_id),
    );
  }
  if (filters.tag) query = query.whereRaw('social_posts.tags @> ?::jsonb', [JSON.stringify([filters.tag])]);
  const rows = await query.groupBy('social_posts.status').select('social_posts.status').count('* as count');
  const by: Record<string, number> = {};
  for (const r of rows as any[]) by[r.status] = Number(r.count);
  return {
    queue: by.scheduled || 0,
    drafts: by.draft || 0,
    approvals: by.pending_approval || 0,
    sent: SENT_STATUSES.reduce((s, k) => s + (by[k] || 0), 0),
  };
}

export async function getPost(orgId: string, postId: string) {
  const post = await db('social_posts')
    .leftJoin('users', 'users.id', 'social_posts.created_by')
    .where({ 'social_posts.id': postId, 'social_posts.org_id': orgId })
    .select('social_posts.*', 'users.name as created_by_name')
    .first();
  if (!post) throw new AppError(404, 'Social post not found');

  const [withDetails] = await attachDetails([post]);
  const metrics = withDetails.accounts.length
    ? await db('social_post_metrics')
        .whereIn('post_account_id', withDetails.accounts.map((a: any) => a.id))
        .orderBy('fetched_at', 'desc')
    : [];
  return { ...withDetails, metrics };
}

async function legacyMedia(orgId: string, mediaIds: string[] | undefined): Promise<MediaItem[]> {
  if (!mediaIds?.length) return [];
  const rows = await db('social_post_media')
    .whereIn('id', mediaIds)
    .whereNull('post_id')
    .where((q) => q.where('org_id', orgId).orWhereNull('org_id'))
    .orderBy('sort_order', 'asc');
  return rows.map((r: any) => ({ url: r.file_url, type: r.file_type, alt_text: r.alt_text, file_size: r.file_size }));
}

function mediaRows(orgId: string, postId: string, media: MediaItem[]) {
  return media.map((m, i) => ({
    id: uuidv4(),
    org_id: orgId,
    post_id: postId,
    file_url: m.url,
    file_type: m.type,
    file_size: m.file_size ?? null,
    alt_text: m.alt_text ?? null,
    sort_order: i,
    created_at: new Date(),
  }));
}

function postAccountRows(postId: string, accountIds: string[], overrides: Map<string, OverrideItem>) {
  return accountIds.map((accountId) => ({
    id: uuidv4(),
    post_id: postId,
    account_id: accountId,
    status: 'pending',
    content_override: overrides.get(accountId)?.content_override?.trim() || null,
    first_comment: overrides.get(accountId)?.first_comment?.trim() || null,
  }));
}

export async function createPost(orgId: string, actor: SocialActor, input: CreatePostInput) {
  const id = uuidv4();
  const accountIds = [...new Set(input.account_ids || [])];
  const accounts = await loadOrgAccounts(orgId, accountIds);
  const overrides = new Map((input.overrides || []).filter((o) => accountIds.includes(o.account_id)).map((o) => [o.account_id, o]));
  const media: MediaItem[] = input.media ?? await legacyMedia(orgId, input.media_ids);
  const tags = (await filterOrgTags(orgId, input.tags)) || [];

  let ideaId: string | null = null;
  if (input.idea_id) {
    const idea = await db('social_ideas').where({ id: input.idea_id, org_id: orgId }).first();
    ideaId = idea ? idea.id : null;
  }

  const mode: ScheduleMode = input.schedule_mode ?? (input.scheduled_at ? 'custom' : 'draft');
  const sched = await resolveSchedule(orgId, actor, mode, input.scheduled_at, accountIds);
  if (sched.status !== 'draft') assertPublishable(accounts, input.content, overrides, media);
  else if (!input.content.trim() && media.length === 0) throw new AppError(400, 'Write something or add media first');

  await db.transaction(async (trx) => {
    await trx('social_posts').insert({
      id,
      org_id: orgId,
      content: input.content,
      status: sched.status,
      scheduled_at: sched.scheduled_at,
      queued: sched.queued,
      tags: JSON.stringify(tags),
      idea_id: ideaId,
      created_by: actor.id,
      approved_by: sched.status !== 'draft' && sched.status !== 'pending_approval' ? actor.id : null,
      approved_at: sched.status !== 'draft' && sched.status !== 'pending_approval' ? new Date() : null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    if (accountIds.length) await trx('social_post_accounts').insert(postAccountRows(id, accountIds, overrides));
    if (media.length) await trx('social_post_media').insert(mediaRows(orgId, id, media));
  });

  if (sched.publishNow) await enqueuePublish(orgId, id);
  return getPost(orgId, id);
}

export async function updatePost(orgId: string, actor: SocialActor, postId: string, input: UpdatePostInput) {
  const post = await getPost(orgId, postId);
  if (!EDITABLE_STATUSES.includes(post.status)) {
    throw new AppError(400, 'Only drafts, scheduled posts and posts awaiting approval can be edited');
  }

  const accountIds = input.account_ids ? [...new Set(input.account_ids)] : post.accounts.map((a: any) => a.account_id);
  const accounts = await loadOrgAccounts(orgId, accountIds);
  const existingOverrides = new Map<string, OverrideItem>(post.accounts.map((a: any) => [a.account_id, a]));
  const overrides = input.overrides
    ? new Map(input.overrides.filter((o) => accountIds.includes(o.account_id)).map((o) => [o.account_id, o]))
    : existingOverrides;
  const media: MediaItem[] = input.media ?? post.media.map((m: any) => ({ url: m.file_url, type: m.file_type, alt_text: m.alt_text, file_size: m.file_size }));
  const content = input.content ?? post.content;
  const tags = await filterOrgTags(orgId, input.tags);

  let mode: ScheduleMode | undefined = input.schedule_mode;
  if (!mode && input.scheduled_at !== undefined) mode = input.scheduled_at ? 'custom' : 'draft';

  const updates: Record<string, unknown> = { content, updated_at: new Date() };
  if (tags) updates.tags = JSON.stringify(tags);

  let publishNow = false;
  let finalStatus = post.status;
  if (mode) {
    const sched = await resolveSchedule(orgId, actor, mode, input.scheduled_at, accountIds, postId);
    Object.assign(updates, { status: sched.status, scheduled_at: sched.scheduled_at, queued: sched.queued, rejection_note: null });
    if (sched.status === 'scheduled' || sched.status === 'publishing') Object.assign(updates, { approved_by: actor.id, approved_at: new Date() });
    finalStatus = sched.status;
    publishNow = sched.publishNow;
  } else if (post.status === 'scheduled' && !canApprove(actor)) {
    updates.status = 'pending_approval';
    finalStatus = 'pending_approval';
  }
  if (finalStatus !== 'draft') assertPublishable(accounts, content, overrides, media);

  await db.transaction(async (trx) => {
    await trx('social_posts').where({ id: postId, org_id: orgId }).update(updates);
    await trx('social_post_accounts').where('post_id', postId).delete();
    if (accountIds.length) await trx('social_post_accounts').insert(postAccountRows(postId, accountIds, overrides));
    if (input.media) {
      await trx('social_post_media').where('post_id', postId).delete();
      if (media.length) await trx('social_post_media').insert(mediaRows(orgId, postId, media));
    }
  });

  if (publishNow) await enqueuePublish(orgId, postId);
  return getPost(orgId, postId);
}

export async function deletePost(orgId: string, postId: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (post.status === 'publishing') throw new AppError(400, 'This post is publishing right now. Try again in a minute.');
  await db('social_posts').where({ id: postId, org_id: orgId }).delete();
}

export async function publishPost(orgId: string, actor: SocialActor, postId: string) {
  return updatePost(orgId, actor, postId, { schedule_mode: 'now' });
}

export async function schedulePost(orgId: string, actor: SocialActor, postId: string, scheduledAt: string) {
  return updatePost(orgId, actor, postId, { schedule_mode: 'custom', scheduled_at: scheduledAt });
}

export async function approvePost(orgId: string, actor: SocialActor, postId: string) {
  if (!canApprove(actor)) throw new AppError(403, 'Only owners and admins can approve posts');
  const post = await getPost(orgId, postId);
  if (post.status !== 'pending_approval') throw new AppError(400, 'This post is not waiting for approval');

  const accounts = await loadOrgAccounts(orgId, post.accounts.map((a: any) => a.account_id));
  if (accounts.length === 0) throw new AppError(400, 'Select at least one channel');
  assertPublishable(
    accounts, post.content,
    new Map(post.accounts.map((a: any) => [a.account_id, a])),
    post.media.map((m: any) => ({ type: m.file_type })),
  );

  const future = post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now();
  await db('social_posts').where({ id: postId, org_id: orgId }).update({
    status: future ? 'scheduled' : 'publishing',
    approved_by: actor.id,
    approved_at: new Date(),
    rejection_note: null,
    updated_at: new Date(),
  });
  if (!future) await enqueuePublish(orgId, postId);
  return getPost(orgId, postId);
}

export async function rejectPost(orgId: string, actor: SocialActor, postId: string, note: string) {
  if (!canApprove(actor)) throw new AppError(403, 'Only owners and admins can reject posts');
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (post.status !== 'pending_approval') throw new AppError(400, 'This post is not waiting for approval');
  await db('social_posts').where({ id: postId, org_id: orgId }).update({
    status: 'draft',
    rejection_note: note || 'Changes requested',
    scheduled_at: null,
    queued: false,
    updated_at: new Date(),
  });
  return getPost(orgId, postId);
}

export async function retryPost(orgId: string, postId: string) {
  const post = await db('social_posts').where({ id: postId, org_id: orgId }).first();
  if (!post) throw new AppError(404, 'Social post not found');
  if (!['failed', 'partially_failed'].includes(post.status)) throw new AppError(400, 'Only failed posts can be retried');
  const n = await db('social_post_accounts')
    .where({ post_id: postId, status: 'failed' })
    .update({ status: 'pending', error_message: null });
  if (!n) throw new AppError(400, 'Nothing to retry');
  await db('social_posts').where({ id: postId, org_id: orgId }).update({ status: 'publishing', updated_at: new Date() });
  await enqueuePublish(orgId, postId);
  return getPost(orgId, postId);
}

export async function duplicatePost(orgId: string, actor: SocialActor, postId: string) {
  const post = await getPost(orgId, postId);
  const id = uuidv4();
  await db.transaction(async (trx) => {
    await trx('social_posts').insert({
      id,
      org_id: orgId,
      content: post.content,
      status: 'draft',
      tags: JSON.stringify(post.tags || []),
      idea_id: post.idea_id || null,
      created_by: actor.id,
      created_at: new Date(),
      updated_at: new Date(),
    });
    const accountIds = post.accounts.map((a: any) => a.account_id);
    if (accountIds.length) {
      await trx('social_post_accounts').insert(postAccountRows(id, accountIds, new Map(post.accounts.map((a: any) => [a.account_id, a]))));
    }
    if (post.media.length) {
      await trx('social_post_media').insert(mediaRows(orgId, id, post.media.map((m: any) => ({
        url: m.file_url, type: m.file_type, alt_text: m.alt_text, file_size: m.file_size,
      }))));
    }
  });
  return getPost(orgId, id);
}

export async function getCalendarPosts(orgId: string, start: string, end: string) {
  const posts = await db('social_posts')
    .where('org_id', orgId)
    .whereIn('status', ['scheduled', 'pending_approval', ...SENT_STATUSES])
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

  const metrics = postAccounts.length
    ? await db('social_post_metrics')
        .whereIn('post_account_id', postAccounts.map((pa: any) => pa.post_account_id))
        .orderBy('fetched_at', 'desc')
    : [];

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
    org_id: orgId,
    post_id: null, // Will be linked when post is created
    file_url: fileUrl,
    file_type: fileType,
    file_size: fileSize,
    sort_order: 0,
    created_at: new Date(),
  });
  return { id, file_url: fileUrl, file_type: fileType };
}
