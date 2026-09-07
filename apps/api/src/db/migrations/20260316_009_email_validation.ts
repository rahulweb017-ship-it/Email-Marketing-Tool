import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add validation columns to contacts
  await knex.schema.alterTable('contacts', (t) => {
    t.string('validation_status', 20).notNullable().defaultTo('unknown');
    t.timestamp('validation_checked_at').nullable();
  });

  // Create email_validation_cache table
  await knex.schema.createTable('email_validation_cache', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('email_domain', 255).notNullable().unique();
    t.boolean('has_mx').nullable();
    t.boolean('is_disposable').nullable();
    t.timestamp('checked_at').defaultTo(knex.fn.now());
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_validation_cache');
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('validation_status');
    t.dropColumn('validation_checked_at');
  });
}
