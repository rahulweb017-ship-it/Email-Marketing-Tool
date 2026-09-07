import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';

interface CreateNotificationInput {
  title: string;
  body?: string;
  type?: string;
  link?: string;
}

export async function createNotification(orgId: string, data: CreateNotificationInput) {
  const id = uuidv4();
  await db('notifications').insert({
    id,
    org_id: orgId,
    title: data.title,
    body: data.body || null,
    type: data.type || 'info',
    link: data.link || null,
    is_read: false,
  });
  return db('notifications').where({ id }).first();
}

export async function listNotifications(orgId: string, pagination: PaginationParams) {
  const countQuery = db('notifications').where('org_id', orgId);
  const [{ count }] = await countQuery.count('* as count');

  const data = await db('notifications')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function markRead(orgId: string, notificationId: string) {
  const updated = await db('notifications')
    .where({ id: notificationId, org_id: orgId })
    .update({ is_read: true, updated_at: new Date() });
  if (!updated) return null;
  return db('notifications').where({ id: notificationId }).first();
}

export async function markAllRead(orgId: string) {
  const affected = await db('notifications')
    .where({ org_id: orgId, is_read: false })
    .update({ is_read: true, updated_at: new Date() });
  return { affected };
}

export async function getUnreadCount(orgId: string) {
  const [{ count }] = await db('notifications')
    .where({ org_id: orgId, is_read: false })
    .count('* as count');
  return Number(count);
}
