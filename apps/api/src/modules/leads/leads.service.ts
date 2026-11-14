// Unified leads inbox: every enquiry from WhatsApp, email, website forms, social and ads lands here.
import crypto from 'crypto';
import { db } from '../../config/database.js';
import { leadQualifyQueue } from '../../config/queue.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import { toE164 } from '../../shared/utils/phone.js';
import { createContact } from '../contacts/contact.service.js';
import { addSubscribers } from '../lists/list.service.js';
import { CLOSED_STATUSES, isValidEmail, splitName, type LeadFields } from './leads.utils.js';

export interface UpsertLeadInput extends LeadFields {
  source: string;
  contact_id?: string | null;
  conversation_id?: string | null;
  /** Queue an AI qualification once the lead settles. */
  qualify?: boolean;
  userId?: string | null;
}

async function addEvent(orgId: string, leadId: string, type: string, body: string | null, userId: string | null = null) {
  await db('lead_events').insert({ lead_id: leadId, org_id: orgId, type, body, user_id: userId });
}

export async function queueQualification(leadId: string) {
  // One qualification per lead per 10 minutes, delayed so a burst of messages is judged together.
  const bucket = Math.floor(Date.now() / 600_000);
  await leadQualifyQueue.add('qualify', { lead_id: leadId }, {
    jobId: `lead-${leadId}-${bucket}`, delay: 60_000, removeOnComplete: true, removeOnFail: 100,
  }).catch((err) => console.error('[leads] could not queue qualification', err.message));
}

/**
 * Creates a lead or adds to the matching open one. Matches on the source's own id first,
 * then on email or phone among the person's open leads, so repeat enquiries don't pile up.
 */
export async function upsertLead(orgId: string, input: UpsertLeadInput) {
  const email = isValidEmail(input.email) ? input.email!.trim().toLowerCase() : null;
  const phoneE164 = toE164(input.phone ?? null) ?? null;
  const message = input.message?.trim() || null;

  let existing = input.external_ref
    ? await db('leads').where({ org_id: orgId, source: input.source, external_ref: input.external_ref }).first()
    : null;
  if (!existing && (email || phoneE164)) {
    existing = await db('leads').where('org_id', orgId).whereNotIn('status', CLOSED_STATUSES)
      .where((q) => {
        if (email) q.orWhere('email', email);
        if (phoneE164) q.orWhere('phone_e164', phoneE164);
      })
      .orderBy('last_activity_at', 'desc').first();
  }

  if (existing) {
    const updates: Record<string, unknown> = { last_activity_at: new Date(), updated_at: new Date() };
    if (!existing.name && input.name) updates.name = input.name;
    if (!existing.email && email) updates.email = email;
    if (!existing.phone && input.phone) { updates.phone = input.phone; updates.phone_e164 = phoneE164; }
    if (!existing.company && input.company) updates.company = input.company;
    if (!existing.contact_id && input.contact_id) updates.contact_id = input.contact_id;
    if (!existing.conversation_id && input.conversation_id) updates.conversation_id = input.conversation_id;
    // A closed lead that gets a new enquiry (e.g. its WhatsApp thread comes back to life) is re-opened.
    if (CLOSED_STATUSES.includes(existing.status) && message && message !== existing.message) updates.status = 'new';
    if (message && message !== existing.message) updates.message = message;
    await db('leads').where('id', existing.id).update(updates);
    if (message && message !== existing.message) await addEvent(orgId, existing.id, 'message', message);
    if (input.qualify && message !== existing.message) await queueQualification(existing.id);
    return { id: existing.id as string, created: false };
  }

  const [row] = await db('leads').insert({
    org_id: orgId,
    source: input.source,
    source_detail: input.source_detail || null,
    external_ref: input.external_ref || null,
    name: input.name || null,
    email,
    phone: input.phone || null,
    phone_e164: phoneE164,
    company: input.company || null,
    message,
    contact_id: input.contact_id || null,
    conversation_id: input.conversation_id || null,
  }).onConflict(['org_id', 'source', 'external_ref']).ignore().returning('id');
  // Lost a race with a parallel insert of the same source record: merge into it instead.
  if (!row) return upsertLead(orgId, input);
  await addEvent(orgId, row.id, 'created', message, input.userId ?? null);
  if (input.qualify) await queueQualification(row.id);
  return { id: row.id as string, created: true };
}

export async function listLeads(orgId: string, pagination: PaginationParams, filters: {
  status?: string; source?: string; temperature?: string; search?: string;
}) {
  const base = db('leads').where('org_id', orgId);
  if (filters.status) base.where('status', filters.status);
  if (filters.source) base.where('source', filters.source);
  if (filters.temperature) base.where('temperature', filters.temperature);
  if (filters.search) {
    const s = `%${filters.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    base.where((q) => q.whereILike('name', s).orWhereILike('email', s).orWhereILike('phone', s).orWhereILike('company', s));
  }
  const [{ count }] = await base.clone().count('id as count');
  const rows = await base.clone()
    .orderBy('last_activity_at', 'desc')
    .limit(pagination.per_page).offset(pagination.offset)
    .select('id', 'source', 'source_detail', 'name', 'email', 'phone', 'company', 'message', 'status',
      'score', 'temperature', 'ai_summary', 'contact_id', 'conversation_id', 'last_activity_at', 'created_at');
  return { data: rows, total: Number(count) };
}

export async function leadStats(orgId: string) {
  const [byStatus, bySource, hot] = await Promise.all([
    db('leads').where('org_id', orgId).groupBy('status').select('status', db.raw('COUNT(*)::int as n')),
    db('leads').where('org_id', orgId).groupBy('source').select('source', db.raw('COUNT(*)::int as n')),
    db('leads').where({ org_id: orgId, temperature: 'hot' }).whereNotIn('status', CLOSED_STATUSES).count('id as n').first(),
  ]);
  return {
    by_status: Object.fromEntries(byStatus.map((r: any) => [r.status, r.n])),
    by_source: Object.fromEntries(bySource.map((r: any) => [r.source, r.n])),
    hot_open: Number(hot?.n || 0),
  };
}

export async function getLead(orgId: string, id: string) {
  const lead = await db('leads').where({ org_id: orgId, id }).first();
  if (!lead) throw new AppError(404, 'Lead not found');
  const events = await db('lead_events as e').leftJoin('users as u', 'u.id', 'e.user_id')
    .where('e.lead_id', id).orderBy('e.created_at', 'desc').limit(100)
    .select('e.id', 'e.type', 'e.body', 'e.created_at', 'u.name as user_name');
  return { ...lead, events };
}

export async function createManualLead(orgId: string, userId: string, input: LeadFields) {
  if (!input.name && !input.email && !input.phone) throw new AppError(400, 'Add a name, email or phone number');
  const { id } = await upsertLead(orgId, { ...input, source: 'manual', qualify: !!input.message, userId });
  return getLead(orgId, id);
}

export async function updateLead(orgId: string, userId: string, id: string, input: {
  status?: string; notes?: string | null; assigned_to?: string | null; name?: string; email?: string; phone?: string; company?: string;
}) {
  const lead = await db('leads').where({ org_id: orgId, id }).first();
  if (!lead) throw new AppError(404, 'Lead not found');
  if (input.assigned_to) {
    const user = await db('users').where({ id: input.assigned_to, org_id: orgId }).first();
    if (!user) throw new AppError(400, 'That team member was not found');
  }
  const updates: Record<string, unknown> = { ...input, updated_at: new Date() };
  if (input.phone !== undefined) updates.phone_e164 = toE164(input.phone) ?? null;
  if (input.email !== undefined) updates.email = isValidEmail(input.email) ? input.email.toLowerCase() : null;
  await db('leads').where('id', id).update(updates);
  if (input.status && input.status !== lead.status) await addEvent(orgId, id, 'status', input.status, userId);
  return getLead(orgId, id);
}

export async function addNote(orgId: string, userId: string, id: string, body: string) {
  const lead = await db('leads').where({ org_id: orgId, id }).first();
  if (!lead) throw new AppError(404, 'Lead not found');
  await addEvent(orgId, id, 'note', body, userId);
  await db('leads').where('id', id).update({ last_activity_at: new Date(), updated_at: new Date() });
  return getLead(orgId, id);
}

export async function deleteLead(orgId: string, id: string) {
  const n = await db('leads').where({ org_id: orgId, id }).delete();
  if (!n) throw new AppError(404, 'Lead not found');
}

/** Turns a lead into a contact (or links the existing one) so it can receive campaigns. */
export async function convertLead(orgId: string, userId: string, id: string, input: { list_ids?: string[] }) {
  const lead = await db('leads').where({ org_id: orgId, id }).first();
  if (!lead) throw new AppError(404, 'Lead not found');

  let contactId: string | null = lead.contact_id;
  let created = false;
  if (!contactId) {
    const existing = await db('contacts').where('org_id', orgId).where((q) => {
      if (lead.email) q.orWhere('email_normalized', lead.email.toLowerCase());
      if (lead.phone_e164) q.orWhere('phone_e164', lead.phone_e164);
    }).first();
    if (!lead.email && !lead.phone_e164) throw new AppError(400, 'Add an email or a valid phone number before converting');
    if (existing) contactId = existing.id;
    else {
      const contact = await createContact(orgId, {
        email: lead.email || undefined,
        phone: lead.phone_e164 || lead.phone || undefined,
        ...splitName(lead.name),
        company_name: lead.company || undefined,
        list_ids: input.list_ids,
      } as any);
      contactId = contact.id;
      created = true;
      await db('contacts').where('id', contactId).update({ source: `lead:${lead.source}` });
    }
  }
  if (input.list_ids?.length && contactId && !created) {
    for (const listId of input.list_ids) {
      await addSubscribers(orgId, listId, [contactId]).catch(() => undefined);
    }
  }
  await db('leads').where('id', id).update({ contact_id: contactId, status: 'converted', updated_at: new Date(), last_activity_at: new Date() });
  await addEvent(orgId, id, 'converted', null, userId);
  return getLead(orgId, id);
}

// ---------- Webhook (ads, social tools, Zapier/Make, custom forms) ----------

export async function getWebhookToken(orgId: string, rotate = false) {
  const org = await db('organizations').where('id', orgId).first('lead_webhook_token');
  if (org?.lead_webhook_token && !rotate) return org.lead_webhook_token as string;
  const token = crypto.randomBytes(24).toString('hex');
  await db('organizations').where('id', orgId).update({ lead_webhook_token: token });
  return token;
}

export async function orgForWebhookToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  const org = await db('organizations').where({ lead_webhook_token: token, status: 'active' }).first('id');
  return org?.id ?? null;
}
