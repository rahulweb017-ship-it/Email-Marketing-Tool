import type { Knex } from 'knex';

/**
 * Contacts may now have only a phone (WhatsApp-only) or only an email, but never neither.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.string('email', 320).nullable().alter();
    t.string('email_normalized', 320).nullable().alter();
  });
  await knex.raw(`
    ALTER TABLE contacts
    ADD CONSTRAINT contacts_email_or_phone CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  const [{ count }] = await knex('contacts').whereNull('email').count('id as count');
  if (Number(count) > 0) {
    throw new Error(`Cannot roll back: ${count} contacts have no email. Add emails or delete them first.`);
  }
  await knex.raw('ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_email_or_phone');
  await knex.schema.alterTable('contacts', (t) => {
    t.string('email', 320).notNullable().alter();
    t.string('email_normalized', 320).notNullable().alter();
  });
}
