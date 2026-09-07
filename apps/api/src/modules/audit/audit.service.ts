import { db } from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';

interface AuditLogEntry {
  org_id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  changes?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Fire-and-forget audit log helper.
 * Call from any service/controller to record an action.
 *
 * @example
 *   logAction({
 *     org_id: req.user!.org_id,
 *     user_id: req.user!.id,
 *     action: 'create',
 *     entity_type: 'campaign',
 *     entity_id: campaign.id,
 *     changes: { name: { old: null, new: campaign.name } },
 *     ip_address: req.ip,
 *     user_agent: req.headers['user-agent'],
 *   });
 */
export async function logAction(entry: AuditLogEntry): Promise<void> {
  try {
    await db('audit_logs').insert({
      id: uuidv4(),
      org_id: entry.org_id,
      user_id: entry.user_id || null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || null,
      changes: entry.changes ? JSON.stringify(entry.changes) : null,
      ip_address: entry.ip_address || null,
      user_agent: entry.user_agent || null,
      created_at: new Date(),
    });
  } catch (err) {
    // Audit logging should never break the main flow.
    // Log the error but do not propagate it.
    console.error('[audit] Failed to write audit log:', err);
  }
}

export async function listAuditLogs(
  orgId: string,
  filters: {
    entity_type?: string;
    user_id?: string;
    action?: string;
    date_from?: string;
    date_to?: string;
    page: number;
    per_page: number;
  },
) {
  let query = db('audit_logs').where('org_id', orgId);
  let countQuery = db('audit_logs').where('org_id', orgId);

  if (filters.entity_type) {
    query = query.where('entity_type', filters.entity_type);
    countQuery = countQuery.where('entity_type', filters.entity_type);
  }
  if (filters.user_id) {
    query = query.where('user_id', filters.user_id);
    countQuery = countQuery.where('user_id', filters.user_id);
  }
  if (filters.action) {
    query = query.where('action', filters.action);
    countQuery = countQuery.where('action', filters.action);
  }
  if (filters.date_from) {
    query = query.where('created_at', '>=', filters.date_from);
    countQuery = countQuery.where('created_at', '>=', filters.date_from);
  }
  if (filters.date_to) {
    query = query.where('created_at', '<=', filters.date_to);
    countQuery = countQuery.where('created_at', '<=', filters.date_to);
  }

  const [{ count }] = await countQuery.count('* as count');
  const data = await query
    .orderBy('created_at', 'desc')
    .limit(filters.per_page)
    .offset((filters.page - 1) * filters.per_page);

  return {
    data,
    total: Number(count),
    page: filters.page,
    per_page: filters.per_page,
    total_pages: Math.ceil(Number(count) / filters.per_page),
  };
}
