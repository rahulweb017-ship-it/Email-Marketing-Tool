import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateEnquiryInput, UpdateEnquiryInput } from './enquiry.schema.js';

export interface EnquiryMeta {
  ip: string | null;
  userAgent: string | null;
}

export async function createEnquiry(input: CreateEnquiryInput, meta: EnquiryMeta) {
  const { fax_number: _honeypot, ...data } = input;
  const [row] = await db('enquiries')
    .insert({
      ...data,
      interests: JSON.stringify(data.interests ?? []),
      ip_address: meta.ip,
      user_agent: meta.userAgent ? meta.userAgent.slice(0, 500) : null,
    })
    .returning(['id', 'created_at']);
  return row;
}

export async function listEnquiries(
  filters: { status?: string; type?: string; search?: string },
  pagination: PaginationParams,
) {
  const query = db('enquiries');
  if (filters.status) query.where('status', filters.status);
  if (filters.type) query.where('type', filters.type);
  if (filters.search) {
    const term = `%${filters.search}%`;
    query.where((q) => {
      q.whereILike('name', term).orWhereILike('email', term).orWhereILike('company', term).orWhereILike('phone', term);
    });
  }

  const [{ count }] = await query.clone().count<{ count: string }[]>('* as count');
  const data = await query
    .clone()
    .select('*')
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getEnquiryCounts() {
  const rows = await db('enquiries').select('status').count<{ status: string; count: string }[]>('* as count').groupBy('status');
  const counts: Record<string, number> = { new: 0, contacted: 0, converted: 0, closed: 0 };
  for (const r of rows) counts[r.status] = Number(r.count);
  return counts;
}

export async function updateEnquiry(id: string, input: UpdateEnquiryInput) {
  const [row] = await db('enquiries')
    .where({ id })
    .update({ ...input, updated_at: db.fn.now() })
    .returning('*');
  if (!row) throw new AppError(404, 'Enquiry not found');
  return row;
}

export async function deleteEnquiry(id: string) {
  const deleted = await db('enquiries').where({ id }).delete();
  if (!deleted) throw new AppError(404, 'Enquiry not found');
}
