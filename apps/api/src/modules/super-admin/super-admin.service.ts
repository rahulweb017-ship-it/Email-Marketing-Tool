import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { normalizeEmail } from '../../shared/utils/email-validator.js';
import { invalidateLimitsCache, invalidateStatusCache } from '../usage/usage.service.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type {
  CreateTenantInput,
  UpdateTenantInput,
  UpdateTenantStatusInput,
  CreatePlanInput,
  UpdatePlanInput,
  ResetUserPasswordInput,
  UpdateUserStatusInput,
} from './super-admin.schema.js';

const SALT_ROUNDS = 12;

function parseJsonField(value: unknown): unknown {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================================
// DASHBOARD
// ============================================================
export async function getDashboardStats() {
  const [orgCount] = await db('organizations').count('id as count');
  const [userCount] = await db('users').where('is_super_admin', false).count('id as count');
  const [activeOrgCount] = await db('organizations').where('status', 'active').count('id as count');
  const [suspendedOrgCount] = await db('organizations').where('status', 'suspended').count('id as count');

  const period = getCurrentPeriod();
  const periodStart = `${period}-01`;

  // Get actual emails sent from mailing_traces (source of truth)
  const emailsThisMonth = await db('mailing_traces')
    .whereNotNull('sent_at')
    .where('sent_at', '>=', periodStart)
    .count('id as total')
    .first();

  const orgsByPlan = await db('organizations')
    .leftJoin('plans', 'plans.id', 'organizations.plan_id')
    .select('plans.display_name as plan_name')
    .count('organizations.id as count')
    .groupBy('plans.display_name');

  return {
    total_organizations: parseInt(String(orgCount?.count || '0')),
    total_users: parseInt(String(userCount?.count || '0')),
    active_organizations: parseInt(String(activeOrgCount?.count || '0')),
    suspended_organizations: parseInt(String(suspendedOrgCount?.count || '0')),
    emails_sent_this_month: parseInt(String(emailsThisMonth?.total || '0')),
    organizations_by_plan: orgsByPlan.map((r) => ({
      plan: r.plan_name || 'No Plan',
      count: parseInt(String(r.count)),
    })),
  };
}

// ============================================================
// TENANT MANAGEMENT
// ============================================================
export async function listTenants(pagination: PaginationParams, filters?: { status?: string; plan_id?: string; search?: string }) {
  let query = db('organizations')
    .leftJoin('plans', 'plans.id', 'organizations.plan_id')
    .select(
      'organizations.id',
      'organizations.name',
      'organizations.slug',
      'organizations.status',
      'organizations.created_at',
      'organizations.billing_email',
      'plans.display_name as plan_name',
      'plans.name as plan_slug',
    );

  let countQuery = db('organizations');

  if (filters?.status) {
    query = query.where('organizations.status', filters.status);
    countQuery = countQuery.where('status', filters.status);
  }
  if (filters?.plan_id) {
    query = query.where('organizations.plan_id', filters.plan_id);
    countQuery = countQuery.where('plan_id', filters.plan_id);
  }
  if (filters?.search) {
    const search = `%${filters.search}%`;
    query = query.where((qb) => {
      qb.whereILike('organizations.name', search).orWhereILike('organizations.slug', search);
    });
    countQuery = countQuery.where((qb) => {
      qb.whereILike('name', search).orWhereILike('slug', search);
    });
  }

  const [{ count: total }] = await countQuery.count('id as count');

  const data = await query
    .orderBy('organizations.created_at', 'desc')
    .limit(pagination.per_page)
    .offset((pagination.page - 1) * pagination.per_page);

  // Enrich with user count and contact count
  const orgIds = data.map((d: any) => d.id);
  if (orgIds.length > 0) {
    const userCounts = await db('users')
      .whereIn('org_id', orgIds)
      .where('is_active', true)
      .select('org_id')
      .count('id as count')
      .groupBy('org_id');

    const contactCounts = await db('contacts')
      .whereIn('org_id', orgIds)
      .select('org_id')
      .count('id as count')
      .groupBy('org_id');

    const userMap = Object.fromEntries(userCounts.map((r: any) => [r.org_id, parseInt(String(r.count))]));
    const contactMap = Object.fromEntries(contactCounts.map((r: any) => [r.org_id, parseInt(String(r.count))]));

    for (const org of data) {
      (org as any).user_count = userMap[(org as any).id] || 0;
      (org as any).contact_count = contactMap[(org as any).id] || 0;
    }
  }

  return { data, total: parseInt(String(total)) };
}

export async function getTenant(orgId: string) {
  const org = await db('organizations')
    .leftJoin('plans', 'plans.id', 'organizations.plan_id')
    .where('organizations.id', orgId)
    .select(
      'organizations.*',
      'plans.display_name as plan_name',
      'plans.name as plan_slug',
      'plans.max_contacts as plan_max_contacts',
      'plans.max_emails_per_month as plan_max_emails_per_month',
      'plans.max_users as plan_max_users',
    )
    .first();

  if (!org) throw new AppError(404, 'Organization not found');

  // Parse JSON fields that may come as strings from DB
  org.limits_override = parseJsonField(org.limits_override);
  org.billing_info = parseJsonField(org.billing_info);

  // Get usage stats from real data, not the stale usage_tracking table
  const period = getCurrentPeriod();
  const periodStart = `${period}-01`;

  // Emails sent: count traces with sent_at in this period (source of truth)
  const [emailsSent] = await db('mailing_traces')
    .join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
    .where('campaigns.org_id', orgId)
    .whereNotNull('mailing_traces.sent_at')
    .where('mailing_traces.sent_at', '>=', periodStart)
    .count('mailing_traces.id as total');

  // Also check Redis counter (may have more recent data)
  let redisEmailCount = 0;
  try {
    const { redis } = await import('../../config/redis.js');
    const redisKey = `org:emails:${orgId}:${period}`;
    redisEmailCount = parseInt(await redis.get(redisKey) || '0');
  } catch {}

  const [contactCount] = await db('contacts').where('org_id', orgId).count('id as count');
  const [userCount] = await db('users').where('org_id', orgId).where('is_active', true).count('id as count');
  const [campaignCount] = await db('campaigns').where('org_id', orgId).count('id as count');

  const actualEmailsSent = Math.max(parseInt(String(emailsSent?.total || '0')), redisEmailCount);

  return {
    ...org,
    usage: {
      period,
      emails_sent: actualEmailsSent,
      contacts_stored: parseInt(String(contactCount?.count || '0')),
      active_users: parseInt(String(userCount?.count || '0')),
      campaigns_total: parseInt(String(campaignCount?.count || '0')),
    },
  };
}

export async function createTenant(input: CreateTenantInput) {
  const existing = await db('users').where('email', input.admin_email.toLowerCase()).first();
  if (existing) throw new AppError(409, 'Admin email already registered');

  const orgId = uuidv4();
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash(input.admin_password, SALT_ROUNDS);

  // Validate plan_id if provided
  let planId = input.plan_id;
  if (planId) {
    const plan = await db('plans').where('id', planId).where('is_active', true).first();
    if (!plan) throw new AppError(400, 'Invalid plan_id: plan not found');
  } else {
    const defaultPlan = await db('plans').where('is_default', true).first();
    planId = defaultPlan?.id;
  }

  await db.transaction(async (trx) => {
    await trx('organizations').insert({
      id: orgId,
      name: input.org_name,
      slug: slugify(input.org_name) + '-' + orgId.substring(0, 8),
      settings: JSON.stringify({}),
      plan_id: planId || null,
      status: 'active',
    });

    await trx('users').insert({
      id: userId,
      org_id: orgId,
      email: input.admin_email.toLowerCase(),
      email_normalized: normalizeEmail(input.admin_email),
      name: input.admin_name,
      password_hash: passwordHash,
      role: 'admin',
      is_active: true,
      is_super_admin: false,
    });

    await trx('usage_tracking').insert({
      org_id: orgId,
      period: getCurrentPeriod(),
      emails_sent: 0,
      contacts_stored: 0,
    });
  });

  return { id: orgId, name: input.org_name, admin_email: input.admin_email.toLowerCase() };
}

export async function updateTenant(orgId: string, input: UpdateTenantInput) {
  const org = await db('organizations').where('id', orgId).first();
  if (!org) throw new AppError(404, 'Organization not found');

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.plan_id !== undefined) updates.plan_id = input.plan_id;
  if (input.billing_email !== undefined) updates.billing_email = input.billing_email;
  if (input.limits_override !== undefined) updates.limits_override = JSON.stringify(input.limits_override);

  await db('organizations').where('id', orgId).update(updates);

  // Invalidate caches
  await invalidateLimitsCache(orgId);

  return getTenant(orgId);
}

export async function updateTenantStatus(orgId: string, input: UpdateTenantStatusInput) {
  const org = await db('organizations').where('id', orgId).first();
  if (!org) throw new AppError(404, 'Organization not found');

  const updates: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date(),
  };

  if (input.status === 'suspended') {
    updates.suspended_at = new Date();
    updates.suspended_reason = input.reason || null;
  } else if (input.status === 'active') {
    updates.suspended_at = null;
    updates.suspended_reason = null;
  }

  await db('organizations').where('id', orgId).update(updates);

  // Invalidate status cache immediately
  await invalidateStatusCache(orgId);

  return getTenant(orgId);
}

export async function listTenantUsers(orgId: string) {
  return db('users')
    .select('id', 'email', 'name', 'role', 'is_active', 'created_at', 'last_login_at')
    .where('org_id', orgId)
    .orderBy('created_at', 'asc');
}

export async function getTenantUsageHistory(orgId: string) {
  return db('usage_tracking')
    .where('org_id', orgId)
    .orderBy('period', 'desc')
    .limit(12);
}

// ============================================================
// PLAN MANAGEMENT
// ============================================================
export async function listPlans() {
  const plans = await db('plans').where('is_active', true).orderBy('sort_order', 'asc');

  // Get org count per plan
  const orgCounts = await db('organizations')
    .select('plan_id')
    .count('id as count')
    .groupBy('plan_id');
  const countMap = Object.fromEntries(orgCounts.map((r: any) => [r.plan_id, parseInt(String(r.count))]));

  return plans.map((p: any) => ({ ...p, features: parseJsonField(p.features), org_count: countMap[p.id] || 0 }));
}

export async function createPlan(input: CreatePlanInput) {
  const existing = await db('plans').where('name', input.name).first();
  if (existing) throw new AppError(409, 'Plan name already exists');

  const id = uuidv4();

  // If this is set as default, unset other defaults
  if (input.is_default) {
    await db('plans').where('is_default', true).update({ is_default: false });
  }

  await db('plans').insert({
    id,
    ...input,
    features: JSON.stringify(input.features),
  });

  const created = await db('plans').where('id', id).first();
  if (created) created.features = parseJsonField(created.features);
  return created;
}

export async function updatePlan(planId: string, input: UpdatePlanInput) {
  const plan = await db('plans').where('id', planId).first();
  if (!plan) throw new AppError(404, 'Plan not found');

  const updates: Record<string, unknown> = { updated_at: new Date() };
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      updates[key] = key === 'features' ? JSON.stringify(value) : value;
    }
  }

  // If setting as default, unset other defaults
  if (input.is_default) {
    await db('plans').where('is_default', true).whereNot('id', planId).update({ is_default: false });
  }

  await db('plans').where('id', planId).update(updates);

  // Invalidate limits cache for all orgs on this plan
  const orgs = await db('organizations').where('plan_id', planId).select('id');
  for (const org of orgs) {
    await invalidateLimitsCache(org.id);
  }

  const updated = await db('plans').where('id', planId).first();
  if (updated) updated.features = parseJsonField(updated.features);
  return updated;
}

export async function deletePlan(planId: string) {
  const plan = await db('plans').where('id', planId).first();
  if (!plan) throw new AppError(404, 'Plan not found');

  // Check if any orgs are using this plan
  const [{ count }] = await db('organizations').where('plan_id', planId).count('id as count');
  if (parseInt(String(count)) > 0) {
    throw new AppError(400, `Cannot delete plan: ${count} organization(s) are using it. Reassign them first.`);
  }

  await db('plans').where('id', planId).update({ is_active: false, updated_at: new Date() });
}

// ============================================================
// TENANT USER MANAGEMENT
// ============================================================
export async function resetTenantUserPassword(orgId: string, userId: string, input: ResetUserPasswordInput) {
  const user = await db('users').where({ id: userId, org_id: orgId }).first();
  if (!user) throw new AppError(404, 'User not found in this organization');

  const tempPassword = input.new_password || uuidv4().substring(0, 16);
  const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

  await db('users').where('id', userId).update({ password_hash: passwordHash, updated_at: new Date() });

  return { temp_password: tempPassword };
}

export async function updateTenantUserStatus(orgId: string, userId: string, input: UpdateUserStatusInput) {
  const user = await db('users').where({ id: userId, org_id: orgId }).first();
  if (!user) throw new AppError(404, 'User not found in this organization');

  await db('users').where('id', userId).update({ is_active: input.is_active, updated_at: new Date() });

  return db('users')
    .select('id', 'email', 'name', 'role', 'is_active', 'created_at', 'last_login_at')
    .where('id', userId)
    .first();
}

// ============================================================
// TENANT DELETION
// ============================================================
export async function deleteTenant(orgId: string) {
  const org = await db('organizations').where('id', orgId).first();
  if (!org) throw new AppError(404, 'Organization not found');

  await db.transaction(async (trx) => {
    // Delete in order respecting foreign keys
    await trx('usage_tracking').where('org_id', orgId).del();
    await trx('refresh_tokens').whereIn('user_id', db('users').select('id').where('org_id', orgId)).del();
    await trx('users').where('org_id', orgId).del();
    await trx('organizations').where('id', orgId).del();
  });

  // Invalidate caches
  await invalidateStatusCache(orgId);
  await invalidateLimitsCache(orgId);
}

// ============================================================
// AUDIT LOGGING
// ============================================================
export async function logAudit(adminUserId: string, action: string, targetOrgId: string | null, details: Record<string, unknown>, ipAddress?: string) {
  await db('super_admin_audit_logs').insert({
    admin_user_id: adminUserId,
    action,
    target_org_id: targetOrgId,
    details: JSON.stringify(details),
    ip_address: ipAddress || null,
  });
}

export async function listAuditLogs(pagination: PaginationParams) {
  const [{ count: total }] = await db('super_admin_audit_logs').count('id as count');

  const data = await db('super_admin_audit_logs')
    .leftJoin('users', 'users.id', 'super_admin_audit_logs.admin_user_id')
    .leftJoin('organizations', 'organizations.id', 'super_admin_audit_logs.target_org_id')
    .select(
      'super_admin_audit_logs.*',
      'users.name as admin_name',
      'users.email as admin_email',
      'organizations.name as target_org_name',
    )
    .orderBy('super_admin_audit_logs.created_at', 'desc')
    .limit(pagination.per_page)
    .offset((pagination.page - 1) * pagination.per_page);

  return { data, total: parseInt(String(total)) };
}
