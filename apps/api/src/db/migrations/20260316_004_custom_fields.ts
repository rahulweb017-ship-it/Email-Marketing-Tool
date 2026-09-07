import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // CUSTOM FIELDS TABLE
  // ============================================================
  await knex.schema.createTable('custom_fields', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 100).notNullable();
    t.string('field_key', 100).notNullable();
    t.string('field_type', 20).notNullable().defaultTo('text');
    t.jsonb('options').nullable();
    t.boolean('is_required').notNullable().defaultTo(false);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamps(true, true);

    t.unique(['org_id', 'field_key']);
  });

  // ============================================================
  // CONTACT CUSTOM FIELD VALUES TABLE
  // ============================================================
  await knex.schema.createTable('contact_custom_field_values', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.uuid('custom_field_id').notNullable().references('id').inTable('custom_fields').onDelete('CASCADE');
    t.text('value').nullable();
    t.timestamps(true, true);

    t.unique(['contact_id', 'custom_field_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contact_custom_field_values');
  await knex.schema.dropTableIfExists('custom_fields');
}
