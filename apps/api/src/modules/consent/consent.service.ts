import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export async function getContactConsent(orgId: string, contactId: string) {
  // Verify contact belongs to org
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');

  return db('consent_records')
    .where({ org_id: orgId, contact_id: contactId })
    .orderBy('consent_type', 'asc')
    .orderBy('updated_at', 'desc');
}

export async function grantConsent(
  orgId: string,
  contactId: string,
  consentType: string,
  source: string,
  ipAddress?: string,
) {
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');

  // Check if a record for this consent type already exists
  const existing = await db('consent_records')
    .where({ org_id: orgId, contact_id: contactId, consent_type: consentType })
    .first();

  if (existing) {
    // Update existing record
    await db('consent_records').where('id', existing.id).update({
      status: 'granted',
      source,
      ip_address: ipAddress || null,
      granted_at: new Date(),
      revoked_at: null,
      updated_at: new Date(),
    });
    return db('consent_records').where('id', existing.id).first();
  }

  const id = uuidv4();
  await db('consent_records').insert({
    id,
    org_id: orgId,
    contact_id: contactId,
    consent_type: consentType,
    status: 'granted',
    source,
    ip_address: ipAddress || null,
    granted_at: new Date(),
  });

  return db('consent_records').where('id', id).first();
}

export async function revokeConsent(orgId: string, contactId: string, consentType: string) {
  const record = await db('consent_records')
    .where({ org_id: orgId, contact_id: contactId, consent_type: consentType, status: 'granted' })
    .first();

  if (!record) throw new AppError(404, 'Active consent record not found');

  await db('consent_records').where('id', record.id).update({
    status: 'revoked',
    revoked_at: new Date(),
    updated_at: new Date(),
  });

  return db('consent_records').where('id', record.id).first();
}

export async function bulkGrantConsent(
  orgId: string,
  contactIds: string[],
  consentType: string,
  source: string,
) {
  const now = new Date();
  let granted = 0;

  for (const contactId of contactIds) {
    const existing = await db('consent_records')
      .where({ org_id: orgId, contact_id: contactId, consent_type: consentType })
      .first();

    if (existing) {
      if (existing.status === 'revoked') {
        await db('consent_records').where('id', existing.id).update({
          status: 'granted',
          source,
          granted_at: now,
          revoked_at: null,
          updated_at: now,
        });
        granted++;
      }
    } else {
      await db('consent_records').insert({
        id: uuidv4(),
        org_id: orgId,
        contact_id: contactId,
        consent_type: consentType,
        status: 'granted',
        source,
        granted_at: now,
      });
      granted++;
    }
  }

  return { granted, total: contactIds.length };
}

export async function exportConsentRecords(orgId: string) {
  return db('consent_records')
    .join('contacts', 'consent_records.contact_id', 'contacts.id')
    .where('consent_records.org_id', orgId)
    .select(
      'consent_records.id',
      'contacts.email',
      'contacts.first_name',
      'contacts.last_name',
      'consent_records.consent_type',
      'consent_records.status',
      'consent_records.source',
      'consent_records.ip_address',
      'consent_records.granted_at',
      'consent_records.revoked_at',
      'consent_records.created_at',
    )
    .orderBy('consent_records.created_at', 'desc');
}

export async function hasValidConsent(orgId: string, contactId: string, consentType: string): Promise<boolean> {
  const record = await db('consent_records')
    .where({ org_id: orgId, contact_id: contactId, consent_type: consentType, status: 'granted' })
    .first();
  return !!record;
}

export async function getConsentOverview(orgId: string) {
  // Count contacts with and without email_marketing consent
  const totalContacts = await db('contacts').where('org_id', orgId).count('* as count').first();
  const withConsent = await db('consent_records')
    .where({ org_id: orgId, consent_type: 'email_marketing', status: 'granted' })
    .countDistinct('contact_id as count')
    .first();

  const total = Number(totalContacts?.count || 0);
  const consented = Number(withConsent?.count || 0);

  return {
    total_contacts: total,
    with_consent: consented,
    without_consent: total - consented,
  };
}

export async function getRecentConsentChanges(orgId: string, limit = 20) {
  return db('consent_records')
    .join('contacts', 'consent_records.contact_id', 'contacts.id')
    .where('consent_records.org_id', orgId)
    .select(
      'consent_records.id',
      'contacts.email',
      'consent_records.consent_type',
      'consent_records.status',
      'consent_records.source',
      'consent_records.updated_at',
    )
    .orderBy('consent_records.updated_at', 'desc')
    .limit(limit);
}
