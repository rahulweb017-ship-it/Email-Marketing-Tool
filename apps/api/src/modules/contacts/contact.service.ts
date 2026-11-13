import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { normalizeEmail, validateEmail } from '../../shared/utils/email-validator.js';
import { refreshListCounts } from '../lists/list.service.js';
import { checkContactLimit } from '../usage/usage.service.js';
import { toE164 } from '../../shared/utils/phone.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateContactInput, UpdateContactInput, CreateTagInput, BulkActionInput, ImportRow } from './contact.schema.js';
import { cleanImportRow, dedupeKeys, type CleanContact } from './contact-import.utils.js';
import { getContactCustomFieldValues, setContactCustomFieldValues } from '../custom-fields/custom-fields.service.js';

export async function listContacts(orgId: string, pagination: PaginationParams, filters?: { search?: string; tag_id?: string; list_id?: string }) {
  let query = db('contacts').where('contacts.org_id', orgId);
  let countQuery = db('contacts').where('contacts.org_id', orgId);

  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.where(function () {
      this.whereILike('email', s).orWhereILike('first_name', s).orWhereILike('last_name', s).orWhereILike('company_name', s).orWhereILike('phone', s).orWhereILike('phone_e164', s);
    });
    countQuery = countQuery.where(function () {
      this.whereILike('email', s).orWhereILike('first_name', s).orWhereILike('last_name', s).orWhereILike('company_name', s).orWhereILike('phone', s).orWhereILike('phone_e164', s);
    });
  }

  if (filters?.tag_id) {
    query = query.whereExists(function () {
      this.select('*').from('contact_tags').whereRaw('contact_tags.contact_id = contacts.id').where('contact_tags.tag_id', filters.tag_id!);
    });
    countQuery = countQuery.whereExists(function () {
      this.select('*').from('contact_tags').whereRaw('contact_tags.contact_id = contacts.id').where('contact_tags.tag_id', filters.tag_id!);
    });
  }

  if (filters?.list_id) {
    query = query.whereExists(function () {
      this.select('*').from('subscriptions').whereRaw('subscriptions.contact_id = contacts.id').where('subscriptions.list_id', filters.list_id!).where('subscriptions.opt_out', false);
    });
    countQuery = countQuery.whereExists(function () {
      this.select('*').from('subscriptions').whereRaw('subscriptions.contact_id = contacts.id').where('subscriptions.list_id', filters.list_id!).where('subscriptions.opt_out', false);
    });
  }

  const [{ count }] = await countQuery.count('* as count');
  const data = await query
    .select('contacts.*')
    .orderBy('contacts.created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getContact(orgId: string, contactId: string) {
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');

  const tags = await db('tags')
    .join('contact_tags', 'tags.id', 'contact_tags.tag_id')
    .where('contact_tags.contact_id', contactId)
    .select('tags.*');

  const subscriptions = await db('mailing_lists')
    .join('subscriptions', 'mailing_lists.id', 'subscriptions.list_id')
    .where('subscriptions.contact_id', contactId)
    .select('mailing_lists.id', 'mailing_lists.name', 'subscriptions.opt_out', 'subscriptions.created_at');

  const custom_field_values = await getContactCustomFieldValues(contactId);

  return { ...contact, tags, subscriptions, custom_field_values };
}

export async function createContact(orgId: string, input: CreateContactInput) {
  await checkContactLimit(orgId);

  const email = input.email?.trim() || null;
  const email_normalized = email ? normalizeEmail(email) : null;
  const phone_e164 = toE164(input.phone, input.country_code || 'IN');
  if (!email && !phone_e164) throw new AppError(400, 'Phone number is not valid. Add a valid phone number or an email address.');

  if (email_normalized) {
    const existing = await db('contacts').where({ org_id: orgId, email_normalized }).first();
    if (existing) throw new AppError(409, 'Contact with this email already exists');
  } else if (phone_e164) {
    const existing = await db('contacts').where({ org_id: orgId, phone_e164 }).first();
    if (existing) throw new AppError(409, 'Contact with this phone number already exists');
  }

  const id = uuidv4();
  const preferences_token = crypto.randomBytes(32).toString('hex');
  const contact = {
    id,
    org_id: orgId,
    email,
    email_normalized,
    first_name: input.first_name || null,
    last_name: input.last_name || null,
    company_name: input.company_name || null,
    phone: input.phone || null,
    phone_e164,
    country_code: input.country_code || null,
    custom_fields: JSON.stringify(input.custom_fields || {}),
    preferences_token,
  };
  await db.transaction(async (trx) => {
    await trx('contacts').insert(contact);

    if (input.tag_ids?.length) {
      await trx('contact_tags').insert(
        input.tag_ids.map((tag_id) => ({ contact_id: id, tag_id })),
      );
    }

    if (input.list_ids?.length) {
      await trx('subscriptions').insert(
        input.list_ids.map((list_id) => ({ id: uuidv4(), contact_id: id, list_id })),
      );
    }
  });

  if (input.list_ids?.length) {
    for (const listId of input.list_ids) {
      await refreshListCounts(listId);
    }
  }

  if (input.custom_field_values && Object.keys(input.custom_field_values).length > 0) {
    await setContactCustomFieldValues(id, orgId, input.custom_field_values as Record<string, string>);
  }

  return getContact(orgId, id);
}

export async function updateContact(orgId: string, contactId: string, input: UpdateContactInput) {
  const existing = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Contact not found');

  const updates: Record<string, unknown> = {};
  if (input.email !== undefined) {
    const email = input.email?.trim() || null;
    updates.email = email;
    updates.email_normalized = email ? normalizeEmail(email) : null;
  }
  if (input.first_name !== undefined) updates.first_name = input.first_name || null;
  if (input.last_name !== undefined) updates.last_name = input.last_name || null;
  if (input.company_name !== undefined) updates.company_name = input.company_name || null;
  if (input.country_code !== undefined) updates.country_code = input.country_code || null;
  if (input.phone !== undefined || input.country_code !== undefined) {
    const phone = input.phone !== undefined ? input.phone || null : existing.phone;
    const region = (input.country_code !== undefined ? input.country_code : existing.country_code) || 'IN';
    updates.phone = phone;
    updates.phone_e164 = toE164(phone, region);
  }
  if (input.custom_fields) updates.custom_fields = JSON.stringify(input.custom_fields);

  const finalEmail = 'email' in updates ? updates.email : existing.email;
  const finalPhone = 'phone_e164' in updates ? updates.phone_e164 : existing.phone_e164;
  if (!finalEmail && !finalPhone) throw new AppError(400, 'A contact needs an email address or a valid phone number');
  let oldListIds: string[] = [];
  await db.transaction(async (trx) => {
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      await trx('contacts').where({ id: contactId }).update(updates);
    }

    if (input.tag_ids) {
      await trx('contact_tags').where('contact_id', contactId).del();
      if (input.tag_ids.length > 0) {
        await trx('contact_tags').insert(
          input.tag_ids.map((tag_id) => ({ contact_id: contactId, tag_id })),
        );
      }
    }

    if (input.list_ids) {
      // Get old list IDs before deleting
      const oldSubs = await trx('subscriptions').where('contact_id', contactId).select('list_id');
      oldListIds = oldSubs.map((s: { list_id: string }) => s.list_id);

      await trx('subscriptions').where('contact_id', contactId).del();
      if (input.list_ids.length > 0) {
        await trx('subscriptions').insert(
          input.list_ids.map((list_id) => ({ id: uuidv4(), contact_id: contactId, list_id })),
        );
      }
    }
  });

  if (input.list_ids) {
    const allListIds = new Set([...oldListIds, ...input.list_ids]);
    for (const listId of allListIds) {
      await refreshListCounts(listId);
    }
  }

  if (input.custom_field_values && Object.keys(input.custom_field_values).length > 0) {
    await setContactCustomFieldValues(contactId, orgId, input.custom_field_values as Record<string, string>);
  }

  return getContact(orgId, contactId);
}

export async function deleteContact(orgId: string, contactId: string) {
  const deleted = await db('contacts').where({ id: contactId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Contact not found');
}

export interface ImportIssue { row: number; reason: string }

/**
 * Cleans raw CSV rows (see contact-import.utils), merges duplicates inside the file, and
 * matches existing contacts by email first, then by phone. Existing contacts only get
 * blank fields filled in; nothing they already have is overwritten.
 */
export async function bulkImport(orgId: string, rows: ImportRow[], listId?: string, defaultCountry = 'IN') {
  await checkContactLimit(orgId);

  const issues: ImportIssue[] = [];
  let invalid = 0, duplicates = 0, fixed = 0;

  type Pending = CleanContact & { rowNumber: number };
  const pending: Pending[] = [];
  const byKey = new Map<string, Pending>();

  rows.forEach((row, index) => {
    const rowNumber = typeof row._row === 'number' ? row._row : index + 2;
    const { contact, fixes, warnings, error } = cleanImportRow(row, defaultCountry);
    if (error) {
      invalid++;
      issues.push({ row: rowNumber, reason: error });
      return;
    }
    if (fixes.length) fixed++;
    if (warnings.length) issues.push({ row: rowNumber, reason: `imported, but ${warnings.join(', ')}` });

    const keys = dedupeKeys(contact);
    const match = keys.map((k) => byKey.get(k)).find(Boolean);
    if (match) {
      duplicates++;
      for (const field of MERGE_FIELDS) if (!match[field] && contact[field]) (match as unknown as Record<string, unknown>)[field] = contact[field];
      for (const k of dedupeKeys(match)) if (!byKey.has(k)) byKey.set(k, match);
      return;
    }
    const p = { ...contact, rowNumber };
    pending.push(p);
    for (const k of keys) byKey.set(k, p);
  });

  // Load existing contacts that share an email or phone with the file
  const emails = [...new Set(pending.map((p) => p.email && normalizeEmail(p.email)).filter(Boolean))] as string[];
  const phones = [...new Set(pending.map((p) => p.phone_e164).filter(Boolean))] as string[];
  const existingByEmail = new Map<string, any>();
  const existingByPhone = new Map<string, any>();
  for (let i = 0; i < emails.length; i += 1000) {
    const found = await db('contacts').where('org_id', orgId).whereIn('email_normalized', emails.slice(i, i + 1000));
    for (const c of found) existingByEmail.set(c.email_normalized, c);
  }
  for (let i = 0; i < phones.length; i += 1000) {
    const found = await db('contacts').where('org_id', orgId).whereIn('phone_e164', phones.slice(i, i + 1000));
    for (const c of found) if (!existingByPhone.has(c.phone_e164)) existingByPhone.set(c.phone_e164, c);
  }

  let imported = 0, updated = 0;
  const contactIdsForList: string[] = [];
  const inserts: Record<string, unknown>[] = [];

  for (const p of pending) {
    const emailNorm = p.email ? normalizeEmail(p.email) : null;
    const existing = (emailNorm && existingByEmail.get(emailNorm)) || (p.phone_e164 && existingByPhone.get(p.phone_e164));
    if (existing) {
      const updates: Record<string, unknown> = {};
      if (!existing.email && p.email && !existingByEmail.has(emailNorm!)) {
        updates.email = p.email;
        updates.email_normalized = emailNorm;
      }
      if (!existing.phone_e164 && p.phone_e164 && !existingByPhone.has(p.phone_e164)) {
        updates.phone = p.phone;
        updates.phone_e164 = p.phone_e164;
      }
      for (const field of ['first_name', 'last_name', 'company_name', 'country_code'] as const) {
        if (!existing[field] && p[field]) updates[field] = p[field];
      }
      if (Object.keys(updates).length) {
        updates.updated_at = new Date();
        await db('contacts').where('id', existing.id).update(updates);
        if (updates.email_normalized) existingByEmail.set(updates.email_normalized as string, { ...existing, ...updates });
        if (updates.phone_e164) existingByPhone.set(updates.phone_e164 as string, { ...existing, ...updates });
        updated++;
      } else {
        duplicates++;
      }
      contactIdsForList.push(existing.id);
      continue;
    }
    const id = uuidv4();
    inserts.push({
      id,
      org_id: orgId,
      email: p.email,
      email_normalized: emailNorm,
      first_name: p.first_name,
      last_name: p.last_name,
      company_name: p.company_name,
      phone: p.phone,
      phone_e164: p.phone_e164,
      country_code: p.country_code,
      custom_fields: JSON.stringify({}),
      preferences_token: crypto.randomBytes(32).toString('hex'),
      source: 'csv_import',
    });
    contactIdsForList.push(id);
    imported++;
  }

  for (let i = 0; i < inserts.length; i += 500) {
    await db('contacts').insert(inserts.slice(i, i + 500));
  }

  if (listId && contactIdsForList.length) {
    const alreadySubscribed = new Set<string>();
    for (let i = 0; i < contactIdsForList.length; i += 1000) {
      const subs = await db('subscriptions').where('list_id', listId).whereIn('contact_id', contactIdsForList.slice(i, i + 1000)).pluck('contact_id');
      subs.forEach((id: string) => alreadySubscribed.add(id));
    }
    const toSubscribe = [...new Set(contactIdsForList)].filter((id) => !alreadySubscribed.has(id))
      .map((contact_id) => ({ id: uuidv4(), contact_id, list_id: listId }));
    for (let i = 0; i < toSubscribe.length; i += 500) {
      await db('subscriptions').insert(toSubscribe.slice(i, i + 500));
    }
    await refreshListCounts(listId);
  }

  issues.sort((a, b) => a.row - b.row);
  return {
    total: rows.length,
    imported,
    updated,
    duplicates,
    invalid,
    fixed,
    issues: issues.slice(0, 200),
    issues_truncated: issues.length > 200,
  };
}

const MERGE_FIELDS = ['email', 'phone', 'phone_e164', 'first_name', 'last_name', 'company_name', 'country_code'] as const;
// ---- Bulk Actions ----

export async function bulkAction(orgId: string, input: BulkActionInput) {
  const { action, contact_ids, tag_id, list_id } = input;

  // Verify all contacts belong to this org
  const contacts = await db('contacts')
    .whereIn('id', contact_ids)
    .where('org_id', orgId)
    .select('id', 'email', 'email_normalized');

  if (contacts.length === 0) {
    throw new AppError(404, 'No matching contacts found');
  }

  const validIds = contacts.map((c: { id: string }) => c.id);
  let affected = 0;

  await db.transaction(async (trx) => {
    switch (action) {
      case 'delete': {
        affected = await trx('contacts').whereIn('id', validIds).where('org_id', orgId).del();
        break;
      }

      case 'tag': {
        if (!tag_id) throw new AppError(400, 'tag_id is required for tag action');
        const existing = await trx('contact_tags')
          .whereIn('contact_id', validIds)
          .where('tag_id', tag_id)
          .select('contact_id');
        const existingSet = new Set(existing.map((e: { contact_id: string }) => e.contact_id));
        const toInsert = validIds
          .filter((id: string) => !existingSet.has(id))
          .map((contact_id: string) => ({ contact_id, tag_id }));
        if (toInsert.length > 0) {
          await trx('contact_tags').insert(toInsert);
        }
        affected = toInsert.length;
        break;
      }

      case 'untag': {
        if (!tag_id) throw new AppError(400, 'tag_id is required for untag action');
        affected = await trx('contact_tags')
          .whereIn('contact_id', validIds)
          .where('tag_id', tag_id)
          .del();
        break;
      }

      case 'add_to_list': {
        if (!list_id) throw new AppError(400, 'list_id is required for add_to_list action');
        const existingSubs = await trx('subscriptions')
          .whereIn('contact_id', validIds)
          .where('list_id', list_id)
          .select('contact_id');
        const existingSubSet = new Set(existingSubs.map((e: { contact_id: string }) => e.contact_id));
        const toInsert = validIds
          .filter((id: string) => !existingSubSet.has(id))
          .map((contact_id: string) => ({ id: uuidv4(), contact_id, list_id }));
        if (toInsert.length > 0) {
          await trx('subscriptions').insert(toInsert);
        }
        affected = toInsert.length;
        break;
      }

      case 'remove_from_list': {
        if (!list_id) throw new AppError(400, 'list_id is required for remove_from_list action');
        affected = await trx('subscriptions')
          .whereIn('contact_id', validIds)
          .where('list_id', list_id)
          .del();
        break;
      }

      case 'blacklist': {
        const toInsert = contacts.filter((c: { email_normalized: string | null }) => !!c.email_normalized).map((c: { id: string; email: string; email_normalized: string }) => ({
          id: uuidv4(),
          org_id: orgId,
          email: c.email,
          email_normalized: c.email_normalized,
          is_active: true,
          added_by: 'bulk_action',
        }));
        // Use onConflict to skip existing entries
        affected = toInsert.length;
        for (const entry of toInsert) {
          try {
            await trx('email_blacklist').insert(entry);
          } catch {
            affected--;
          }
        }
        // Also mark contacts as blacklisted
        await trx('contacts').whereIn('id', validIds).update({ is_blacklisted: true });
        break;
      }

      case 'unblacklist': {
        const emails = contacts.map((c: { email_normalized: string | null }) => c.email_normalized).filter(Boolean);
        affected = await trx('email_blacklist')
          .where('org_id', orgId)
          .whereIn('email_normalized', emails)
          .del();
        // Also unmark contacts
        await trx('contacts').whereIn('id', validIds).update({ is_blacklisted: false });
        break;
      }
    }
  });

  if ((action === 'add_to_list' || action === 'remove_from_list') && list_id) {
    await refreshListCounts(list_id);
  }

  return { affected };
}

// ---- Tags ----

export async function listTags(orgId: string) {
  return db('tags').where('org_id', orgId).orderBy('name', 'asc');
}

export async function createTag(orgId: string, input: CreateTagInput) {
  const id = uuidv4();
  await db('tags').insert({ id, org_id: orgId, name: input.name, color: input.color || null });
  return db('tags').where('id', id).first();
}

export async function deleteTag(orgId: string, tagId: string) {
  const deleted = await db('tags').where({ id: tagId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Tag not found');
}

// ---- Email Validation ----

export async function validateContact(orgId: string, contactId: string) {
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');
  if (!contact.email) throw new AppError(400, 'This contact has no email address to validate');

  const result = await validateEmail(contact.email);

  await db('contacts').where({ id: contactId }).update({
    validation_status: result.status,
    validation_checked_at: new Date(),
    updated_at: new Date(),
  });

  return {
    contact_id: contactId,
    email: contact.email,
    validation_status: result.status,
    reason: result.reason,
    validation_checked_at: new Date().toISOString(),
  };
}

export async function bulkValidate(orgId: string, contactIds: string[]) {
  const contacts = await db('contacts')
    .whereIn('id', contactIds)
    .where('org_id', orgId)
    .whereNotNull('email')
    .select('id', 'email');

  if (contacts.length === 0) {
    throw new AppError(404, 'No matching contacts found');
  }

  const results: Array<{ contact_id: string; email: string; validation_status: string; reason: string }> = [];

  for (const contact of contacts) {
    const result = await validateEmail(contact.email);

    await db('contacts').where({ id: contact.id }).update({
      validation_status: result.status,
      validation_checked_at: new Date(),
      updated_at: new Date(),
    });

    results.push({
      contact_id: contact.id,
      email: contact.email,
      validation_status: result.status,
      reason: result.reason,
    });
  }

  return {
    validated: results.length,
    results,
  };
}
