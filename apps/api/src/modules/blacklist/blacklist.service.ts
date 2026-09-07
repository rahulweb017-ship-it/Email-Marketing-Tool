import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { normalizeEmail } from '../../shared/utils/email-validator.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { AddBlacklistInput } from './blacklist.schema.js';

export async function listBlacklist(orgId: string, pagination: PaginationParams, search?: string) {
  let query = db('email_blacklist').where('org_id', orgId);
  let countQuery = db('email_blacklist').where('org_id', orgId);

  if (search) {
    query = query.whereILike('email', `%${search}%`);
    countQuery = countQuery.whereILike('email', `%${search}%`);
  }

  const [{ count }] = await countQuery.count('* as count');
  const data = await query
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function addToBlacklist(orgId: string, userId: string, input: AddBlacklistInput) {
  const email_normalized = normalizeEmail(input.email);

  const existing = await db('email_blacklist').where({ org_id: orgId, email_normalized }).first();
  if (existing) {
    if (!existing.is_active) {
      await db('email_blacklist').where('id', existing.id).update({
        is_active: true,
        reason: input.reason || existing.reason,
        added_by: userId,
      });
      return db('email_blacklist').where('id', existing.id).first();
    }
    throw new AppError(409, 'Email already blacklisted');
  }

  const id = uuidv4();
  await db('email_blacklist').insert({
    id,
    org_id: orgId,
    email: input.email.trim(),
    email_normalized,
    is_active: true,
    reason: input.reason || null,
    added_by: userId,
  });

  // Mark contact as blacklisted
  await db('contacts')
    .where({ org_id: orgId, email_normalized })
    .update({ is_blacklisted: true, updated_at: new Date() });

  return db('email_blacklist').where('id', id).first();
}

export async function removeFromBlacklist(orgId: string, blacklistId: string) {
  const entry = await db('email_blacklist').where({ id: blacklistId, org_id: orgId }).first();
  if (!entry) throw new AppError(404, 'Blacklist entry not found');

  await db('email_blacklist').where('id', blacklistId).update({ is_active: false });

  // Unmark contact
  await db('contacts')
    .where({ org_id: orgId, email_normalized: entry.email_normalized })
    .update({ is_blacklisted: false, updated_at: new Date() });
}

export async function bulkBlacklist(orgId: string, userId: string, emails: string[], reason?: string) {
  let added = 0;
  let skipped = 0;

  for (const email of emails) {
    const email_normalized = normalizeEmail(email);
    const existing = await db('email_blacklist').where({ org_id: orgId, email_normalized }).first();

    if (existing?.is_active) {
      skipped++;
      continue;
    }

    if (existing) {
      await db('email_blacklist').where('id', existing.id).update({ is_active: true, reason, added_by: userId });
    } else {
      await db('email_blacklist').insert({
        id: uuidv4(),
        org_id: orgId,
        email: email.trim(),
        email_normalized,
        is_active: true,
        reason: reason || null,
        added_by: userId,
      });
    }

    await db('contacts')
      .where({ org_id: orgId, email_normalized })
      .update({ is_blacklisted: true, updated_at: new Date() });

    added++;
  }

  return { added, skipped, total: emails.length };
}

export async function isBlacklisted(orgId: string, email: string): Promise<boolean> {
  const email_normalized = normalizeEmail(email);
  const entry = await db('email_blacklist').where({ org_id: orgId, email_normalized, is_active: true }).first();
  return !!entry;
}
