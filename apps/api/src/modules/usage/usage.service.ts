import { db } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { AppError } from '../../shared/middleware/error-handler.js';

interface OrgLimits {
  max_contacts: number;
  max_emails_per_month: number;
  max_campaigns: number | null;
  max_automations: number | null;
  max_sending_configs: number;
  max_users: number;
  max_lists: number;
  max_whatsapp_messages_per_month: number;
  max_whatsapp_accounts: number;
  features: Record<string, boolean>;
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function getOrgLimits(orgId: string): Promise<OrgLimits> {
  const cacheKey = `org:limits:${orgId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const org = await db('organizations')
    .leftJoin('plans', 'plans.id', 'organizations.plan_id')
    .where('organizations.id', orgId)
    .select(
      'plans.max_contacts',
      'plans.max_emails_per_month',
      'plans.max_campaigns',
      'plans.max_automations',
      'plans.max_sending_configs',
      'plans.max_users',
      'plans.max_lists',
      'plans.max_whatsapp_messages_per_month',
      'plans.max_whatsapp_accounts',
      'plans.features',
      'organizations.limits_override',
    )
    .first();

  if (!org) {
    throw new AppError(404, 'Organization not found');
  }

  const planFeatures = typeof org.features === 'string' ? JSON.parse(org.features) : (org.features || {});
  const overrides = typeof org.limits_override === 'string' ? JSON.parse(org.limits_override) : (org.limits_override || {});

  const limits: OrgLimits = {
    max_contacts: overrides.max_contacts ?? org.max_contacts ?? 500,
    max_emails_per_month: overrides.max_emails_per_month ?? org.max_emails_per_month ?? 1000,
    max_campaigns: overrides.max_campaigns ?? org.max_campaigns,
    max_automations: overrides.max_automations ?? org.max_automations,
    max_sending_configs: overrides.max_sending_configs ?? org.max_sending_configs ?? 1,
    max_users: overrides.max_users ?? org.max_users ?? 1,
    max_lists: overrides.max_lists ?? org.max_lists ?? 5,
    max_whatsapp_messages_per_month: overrides.max_whatsapp_messages_per_month ?? org.max_whatsapp_messages_per_month ?? 0,
    max_whatsapp_accounts: overrides.max_whatsapp_accounts ?? org.max_whatsapp_accounts ?? 0,
    features: { ...planFeatures, ...(overrides.features || {}) },
  };

  await redis.set(cacheKey, JSON.stringify(limits), 'EX', 300); // 5 min cache
  return limits;
}

export async function getOrgUsage(orgId: string) {
  const period = getCurrentPeriod();

  // Get email count from Redis (fast path)
  const redisEmailKey = `org:emails:${orgId}:${period}`;
  const emailsSentRedis = parseInt(await redis.get(redisEmailKey) || '0');

  // Get DB usage record
  const usage = await db('usage_tracking')
    .where({ org_id: orgId, period })
    .first();

  // Get live counts
  const [contactCount] = await db('contacts').where('org_id', orgId).count('id as count');
  const [userCount] = await db('users').where('org_id', orgId).where('is_active', true).count('id as count');

  return {
    period,
    emails_sent: Math.max(emailsSentRedis, usage?.emails_sent || 0),
    contacts_stored: parseInt(String(contactCount?.count || '0')),
    campaigns_created: usage?.campaigns_created || 0,
    automations_created: usage?.automations_created || 0,
    active_users: parseInt(String(userCount?.count || '0')),
  };
}

export async function checkContactLimit(orgId: string): Promise<void> {
  const limits = await getOrgLimits(orgId);
  const [result] = await db('contacts').where('org_id', orgId).count('id as count');
  const currentCount = parseInt(String(result?.count || '0'));

  if (currentCount >= limits.max_contacts) {
    throw new AppError(402, `Contact limit reached (${limits.max_contacts}). Upgrade your plan to add more contacts.`);
  }
}

export async function checkEmailLimit(orgId: string, additionalCount: number = 0): Promise<void> {
  const limits = await getOrgLimits(orgId);
  const period = getCurrentPeriod();
  const redisKey = `org:emails:${orgId}:${period}`;
  const currentCount = parseInt(await redis.get(redisKey) || '0');

  if (currentCount + additionalCount > limits.max_emails_per_month) {
    throw new AppError(402, `Monthly email limit reached (${limits.max_emails_per_month}). Upgrade your plan to send more emails.`);
  }
}

export async function checkUserLimit(orgId: string): Promise<void> {
  const limits = await getOrgLimits(orgId);
  const [result] = await db('users').where('org_id', orgId).where('is_active', true).count('id as count');
  const currentCount = parseInt(String(result?.count || '0'));

  if (currentCount >= limits.max_users) {
    throw new AppError(402, `User limit reached (${limits.max_users}). Upgrade your plan to add more users.`);
  }
}

export async function incrementEmailCounter(orgId: string, count: number = 1): Promise<void> {
  const period = getCurrentPeriod();
  const redisKey = `org:emails:${orgId}:${period}`;
  await redis.incrby(redisKey, count);
  // Set TTL of 40 days if not already set
  const ttl = await redis.ttl(redisKey);
  if (ttl === -1) {
    await redis.expire(redisKey, 40 * 24 * 60 * 60);
  }
}

export async function getWhatsAppUsage(orgId: string): Promise<number> {
  return parseInt(await redis.get(`org:wa:${orgId}:${getCurrentPeriod()}`) || '0');
}

export async function checkWhatsAppLimit(orgId: string, additionalCount: number = 0): Promise<void> {
  const limits = await getOrgLimits(orgId);
  const currentCount = await getWhatsAppUsage(orgId);
  if (currentCount + additionalCount > limits.max_whatsapp_messages_per_month) {
    throw new AppError(402, `Monthly WhatsApp message limit reached (${limits.max_whatsapp_messages_per_month}). Upgrade your plan to send more messages.`);
  }
}

export async function incrementWhatsAppCounter(orgId: string, count: number = 1): Promise<void> {
  const redisKey = `org:wa:${orgId}:${getCurrentPeriod()}`;
  await redis.incrby(redisKey, count);
  const ttl = await redis.ttl(redisKey);
  if (ttl === -1) {
    await redis.expire(redisKey, 40 * 24 * 60 * 60);
  }
}

export async function syncUsageToDB(): Promise<void> {
  const period = getCurrentPeriod();

  // Get all active orgs
  const orgs = await db('organizations').where('status', 'active').select('id');

  for (const org of orgs) {
    const redisKey = `org:emails:${org.id}:${period}`;
    const emailsSent = parseInt(await redis.get(redisKey) || '0');

    // Count contacts
    const [contactResult] = await db('contacts').where('org_id', org.id).count('id as count');
    const contactsStored = parseInt(String(contactResult?.count || '0'));

    // Upsert usage_tracking
    const existing = await db('usage_tracking').where({ org_id: org.id, period }).first();
    if (existing) {
      await db('usage_tracking').where('id', existing.id).update({
        emails_sent: Math.max(emailsSent, existing.emails_sent),
        contacts_stored: contactsStored,
        updated_at: new Date(),
      });
    } else {
      await db('usage_tracking').insert({
        org_id: org.id,
        period,
        emails_sent: emailsSent,
        contacts_stored: contactsStored,
      });
    }
  }
}

/** Invalidate cached limits (call after super admin updates plan/limits) */
export async function invalidateLimitsCache(orgId: string): Promise<void> {
  await redis.del(`org:limits:${orgId}`);
}

/** Invalidate cached status (call after super admin changes org status) */
export async function invalidateStatusCache(orgId: string): Promise<void> {
  await redis.del(`org:status:${orgId}`);
}
