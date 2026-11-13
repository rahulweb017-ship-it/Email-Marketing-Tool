/**
 * Repairs contacts so they can receive WhatsApp campaigns.
 *
 *   npm run wa:fix-contacts --workspace=apps/api                      # dry run, report only
 *   npm run wa:fix-contacts --workspace=apps/api -- --apply           # write phone fixes
 *   npm run wa:fix-contacts --workspace=apps/api -- --apply --grant-consent [--list <listId>] [--org <orgId>]
 *
 * Phone fix: fills/corrects contacts.phone_e164 from contacts.phone, or from a phone-like
 * custom field (phone, mobile, whatsapp...) when the phone column is empty.
 *
 * --grant-consent records whatsapp_marketing consent (source 'bulk_backfill'). Only use it for
 * contacts who actually agreed to WhatsApp messages. Contacts who sent STOP, revoked WhatsApp
 * consent, or are blacklisted are never touched.
 */
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { toE164 } from '../shared/utils/phone.js';

const PHONE_FIELD = /^(phone|mobile|whatsapp|cell|contact[_ ]?(no|number)|phone[_ ]?(no|number)|mobile[_ ]?(no|number)|whatsapp[_ ]?(no|number))$/i;

export function resolvePhone(contact: { phone?: string | null; country_code?: string | null; custom_fields?: unknown }): { raw: string; e164: string | null } | null {
  const region = contact.country_code || 'IN';
  if (contact.phone && String(contact.phone).trim()) {
    return { raw: String(contact.phone), e164: toE164(String(contact.phone), region) };
  }
  let fields: Record<string, unknown> = {};
  try {
    fields = typeof contact.custom_fields === 'string' ? JSON.parse(contact.custom_fields) : (contact.custom_fields as Record<string, unknown>) || {};
  } catch { /* malformed JSON: treat as no custom fields */ }
  for (const [key, value] of Object.entries(fields)) {
    if (PHONE_FIELD.test(key.trim()) && value != null && String(value).trim()) {
      return { raw: String(value), e164: toE164(String(value), region) };
    }
  }
  return null;
}

const mask = (p: string) => p.replace(/\d(?=\d{3})/g, 'x');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const grantConsent = process.argv.includes('--grant-consent');
  const orgId = arg('--org');
  const listId = arg('--list');

  console.log(apply ? 'Mode: APPLY (changes will be written)' : 'Mode: DRY RUN (no changes; add --apply to write)');
  if (orgId) console.log(`Org: ${orgId}`);
  if (listId) console.log(`List: ${listId}`);

  const scope = () => {
    const q = db('contacts as ct');
    if (orgId) q.where('ct.org_id', orgId);
    if (listId) q.whereExists(db('subscriptions as s').whereRaw('s.contact_id = ct.id').where('s.list_id', listId));
    return q;
  };

  // ---- 1. Phone numbers ----
  const contacts = await scope().select('ct.id', 'ct.phone', 'ct.phone_e164', 'ct.country_code', 'ct.custom_fields');
  let fixed = 0, alreadyOk = 0, noPhone = 0;
  const invalid: string[] = [];
  const hasValidPhone = new Set<string>();
  for (const c of contacts) {
    const resolved = resolvePhone(c);
    if (!resolved) { if (!c.phone_e164) noPhone++; else { alreadyOk++; hasValidPhone.add(c.id); } continue; }
    if (!resolved.e164) { if (c.phone_e164) { alreadyOk++; hasValidPhone.add(c.id); } else invalid.push(mask(resolved.raw)); continue; }
    hasValidPhone.add(c.id);
    if (resolved.e164 === c.phone_e164) { alreadyOk++; continue; }
    fixed++;
    if (apply) {
      const updates: Record<string, unknown> = { phone_e164: resolved.e164, updated_at: new Date() };
      if (!c.phone) updates.phone = resolved.raw;
      await db('contacts').where('id', c.id).update(updates);
    }
  }
  console.log(`\nPhones: ${contacts.length} contacts checked`);
  console.log(`  ${apply ? 'fixed' : 'would fix'}: ${fixed}`);
  console.log(`  already OK: ${alreadyOk}`);
  console.log(`  no phone anywhere: ${noPhone}`);
  console.log(`  invalid number (fix by hand): ${invalid.length}${invalid.length ? ' -> ' + invalid.slice(0, 20).join(', ') + (invalid.length > 20 ? ' ...' : '') : ''}`);

  // ---- 2. WhatsApp consent ----
  const candidates = (await scope()
    .where('ct.whatsapp_opt_out', false)
    .where('ct.is_blacklisted', false)
    .whereNotExists(
      db('consent_records as cr').whereRaw('cr.contact_id = ct.id').where('cr.consent_type', 'whatsapp_marketing'),
    )
    .select('ct.id', 'ct.org_id')).filter((c: { id: string }) => hasValidPhone.has(c.id));
  const [{ revoked }] = await scope()
    .whereExists(db('consent_records as cr').whereRaw('cr.contact_id = ct.id')
      .where({ 'cr.consent_type': 'whatsapp_marketing', 'cr.status': 'revoked' }))
    .count('ct.id as revoked');
  const [{ optedOut }] = await scope().where('ct.whatsapp_opt_out', true).count('ct.id as optedOut');

  console.log(`\nWhatsApp consent:`);
  console.log(`  contacts with a phone but no WhatsApp consent record: ${candidates.length}`);
  console.log(`  opted out (STOP) - left alone: ${optedOut}`);
  console.log(`  revoked consent - left alone: ${revoked}`);

  if (grantConsent) {
    if (apply && candidates.length) {
      const now = new Date();
      for (let i = 0; i < candidates.length; i += 500) {
        await db('consent_records').insert(candidates.slice(i, i + 500).map((c: { id: string; org_id: string }) => ({
          id: uuidv4(), org_id: c.org_id, contact_id: c.id, consent_type: 'whatsapp_marketing',
          status: 'granted', source: 'bulk_backfill', granted_at: now,
        })));
      }
    }
    console.log(`  ${apply ? 'granted' : 'would grant'}: ${candidates.length}`);
  } else if (candidates.length) {
    console.log('  (add --grant-consent to record consent for them, or untick "Only send to contacts with WhatsApp consent" in the campaign)');
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!);
if (isMain) {
  main()
    .then(() => db.destroy())
    .catch(async (err) => { console.error(err); await db.destroy(); process.exit(1); });
}
