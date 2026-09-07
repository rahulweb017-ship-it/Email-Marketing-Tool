import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create consent_records table
  await knex.schema.createTable('consent_records', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.string('consent_type', 50).notNullable(); // email_marketing, data_processing, third_party_sharing
    t.string('status', 20).notNullable().defaultTo('granted'); // granted, revoked
    t.string('source', 100).notNullable(); // signup_form, import, api, manual
    t.string('ip_address', 45).nullable();
    t.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('revoked_at').nullable();
    t.timestamps(true, true);

    t.index(['contact_id', 'consent_type'], 'idx_consent_contact_type');
  });

  // Add preferences_token to contacts
  await knex.schema.alterTable('contacts', (t) => {
    t.string('preferences_token', 64).nullable().unique();
  });

  // Generate preferences_token for all existing contacts
  await knex.raw(`UPDATE contacts SET preferences_token = encode(gen_random_bytes(32), 'hex') WHERE preferences_token IS NULL`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consent_records');
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('preferences_token');
  });
}
