import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { normalizeEmail } from '../../shared/utils/email-validator.js';
import type { RegisterInput, LoginInput, InviteUserInput, UpdateProfileInput } from './auth.schema.js';
import { checkUserLimit } from '../usage/usage.service.js';

const SALT_ROUNDS = 12;

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface JwtPayload {
  sub: string;
  org_id: string | null;
  role: string;
  is_super_admin: boolean;
}

function generateTokens(user: { id: string; org_id: string | null; role: string; is_super_admin?: boolean }): TokenPair {
  const payload: JwtPayload = {
    sub: user.id,
    org_id: user.org_id,
    role: user.role,
    is_super_admin: user.is_super_admin || false,
  };

  const access_token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const refresh_token = jwt.sign({ sub: user.id, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  return { access_token, refresh_token, expires_in: 900 };
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

export async function register(input: RegisterInput) {
  const { org_name, name, email, password } = input;

  const existing = await db('users').where('email', email.toLowerCase()).first();
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const org_id = uuidv4();
  const user_id = uuidv4();

  // Get default plan
  const defaultPlan = await db('plans').where('is_default', true).first();

  await db.transaction(async (trx) => {
    await trx('organizations').insert({
      id: org_id,
      name: org_name,
      slug: slugify(org_name) + '-' + org_id.substring(0, 8),
      settings: JSON.stringify({}),
      plan_id: defaultPlan?.id || null,
      status: 'active',
    });

    await trx('users').insert({
      id: user_id,
      org_id,
      email: email.toLowerCase(),
      email_normalized: normalizeEmail(email),
      name,
      password_hash,
      role: 'admin',
      is_active: true,
      is_super_admin: false,
    });

    // Initialize usage tracking for current period
    await trx('usage_tracking').insert({
      id: uuidv4(),
      org_id,
      period: getCurrentPeriod(),
      emails_sent: 0,
      contacts_stored: 0,
      campaigns_created: 0,
      automations_created: 0,
    });
  });

  const tokens = generateTokens({ id: user_id, org_id, role: 'admin', is_super_admin: false });

  await db('refresh_tokens').insert({
    id: uuidv4(),
    user_id,
    token_hash: await bcrypt.hash(tokens.refresh_token, 10),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    user: { id: user_id, org_id, email: email.toLowerCase(), name, role: 'admin', is_super_admin: false },
    ...tokens,
  };
}

export async function login(input: LoginInput) {
  const { email, password } = input;

  const user = await db('users')
    .where('email', email.toLowerCase())
    .where('is_active', true)
    .first();

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'Invalid email or password');
  }

  // For non-super-admin users, check org status
  if (!user.is_super_admin && user.org_id) {
    const org = await db('organizations').where('id', user.org_id).select('status').first();
    if (org && org.status !== 'active') {
      throw new AppError(403, 'Your organization has been suspended. Contact support.');
    }
  }

  const tokens = generateTokens({
    id: user.id,
    org_id: user.org_id,
    role: user.role,
    is_super_admin: user.is_super_admin || false,
  });

  await db('refresh_tokens').insert({
    id: uuidv4(),
    user_id: user.id,
    token_hash: await bcrypt.hash(tokens.refresh_token, 10),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return {
    user: {
      id: user.id,
      org_id: user.org_id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_super_admin: user.is_super_admin || false,
    },
    ...tokens,
  };
}

export async function refreshToken(token: string) {
  let decoded: { sub: string; type: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as typeof decoded;
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token');
  }

  if (decoded.type !== 'refresh') {
    throw new AppError(401, 'Invalid token type');
  }

  const storedTokens = await db('refresh_tokens')
    .where('user_id', decoded.sub)
    .where('revoked', false)
    .where('expires_at', '>', new Date());

  let matched = false;
  for (const stored of storedTokens) {
    if (await bcrypt.compare(token, stored.token_hash)) {
      await db('refresh_tokens').where('id', stored.id).update({ revoked: true });
      matched = true;
      break;
    }
  }

  if (!matched) {
    throw new AppError(401, 'Refresh token not found or already revoked');
  }

  const user = await db('users').where('id', decoded.sub).where('is_active', true).first();
  if (!user) {
    throw new AppError(401, 'User not found or deactivated');
  }

  const tokens = generateTokens({
    id: user.id,
    org_id: user.org_id,
    role: user.role,
    is_super_admin: user.is_super_admin || false,
  });

  await db('refresh_tokens').insert({
    id: uuidv4(),
    user_id: user.id,
    token_hash: await bcrypt.hash(tokens.refresh_token, 10),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return tokens;
}

export async function logout(userId: string) {
  await db('refresh_tokens').where('user_id', userId).update({ revoked: true });
}

export async function inviteUser(orgId: string, input: InviteUserInput) {
  await checkUserLimit(orgId);

  const existing = await db('users').where('email', input.email.toLowerCase()).first();
  if (existing) {
    throw new AppError(409, 'Email already registered');
  }

  const tempPassword = uuidv4().substring(0, 16);
  const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
  const user_id = uuidv4();

  await db('users').insert({
    id: user_id,
    org_id: orgId,
    email: input.email.toLowerCase(),
    email_normalized: normalizeEmail(input.email),
    name: input.name,
    password_hash,
    role: input.role,
    is_active: true,
    is_super_admin: false,
  });

  return {
    user: { id: user_id, org_id: orgId, email: input.email.toLowerCase(), name: input.name, role: input.role },
    temp_password: tempPassword,
  };
}

export async function getProfile(userId: string) {
  const user = await db('users')
    .select('users.id', 'users.org_id', 'users.email', 'users.name', 'users.role', 'users.is_active', 'users.is_super_admin', 'users.created_at')
    .where('users.id', userId)
    .first();

  if (!user) {
    throw new AppError(404, 'User not found');
  }

  // Include plan info for non-super-admin users
  if (user.org_id && !user.is_super_admin) {
    const org = await db('organizations')
      .leftJoin('plans', 'plans.id', 'organizations.plan_id')
      .where('organizations.id', user.org_id)
      .select('organizations.name as org_name', 'organizations.status as org_status', 'plans.name as plan_name', 'plans.display_name as plan_display_name')
      .first();
    if (org) {
      return { ...user, org_name: org.org_name, org_status: org.org_status, plan_name: org.plan_name, plan_display_name: org.plan_display_name };
    }
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const updates: Record<string, unknown> = {};

  if (input.name) updates.name = input.name;
  if (input.password) updates.password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No fields to update');
  }

  await db('users').where('id', userId).update(updates);
  return getProfile(userId);
}

export async function listOrgUsers(orgId: string) {
  return db('users')
    .select('id', 'email', 'name', 'role', 'is_active', 'created_at')
    .where('org_id', orgId)
    .orderBy('created_at', 'asc');
}

// ============================================================
// IMPERSONATION
// ============================================================
export async function impersonate(superAdminId: string, targetOrgId: string) {
  // Find the admin user for the target org, join to get org name
  const targetUser = await db('users')
    .leftJoin('organizations', 'organizations.id', 'users.org_id')
    .where({ 'users.org_id': targetOrgId, 'users.role': 'admin', 'users.is_active': true })
    .select('users.*', 'organizations.name as org_name')
    .first();

  if (!targetUser) {
    throw new AppError(404, 'No active admin user found for this organization');
  }

  const tokens = generateTokens({
    id: targetUser.id,
    org_id: targetUser.org_id,
    role: targetUser.role,
    is_super_admin: false,
  });

  // Store refresh token
  await db('refresh_tokens').insert({
    id: uuidv4(),
    user_id: targetUser.id,
    token_hash: await bcrypt.hash(tokens.refresh_token, 10),
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hour impersonation session
  });

  return {
    user: {
      id: targetUser.id,
      org_id: targetUser.org_id,
      org_name: targetUser.org_name,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
      is_super_admin: false,
    },
    ...tokens,
  };
}
