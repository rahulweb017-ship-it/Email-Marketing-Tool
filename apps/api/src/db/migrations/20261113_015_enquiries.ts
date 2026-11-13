import type { Knex } from 'knex';

// Sales enquiries from the public website (registration and contact forms). Not tenant data.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('enquiries', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('type', 20).notNullable(); // registration, contact
    t.string('status', 20).notNullable().defaultTo('new'); // new, contacted, converted, closed
    t.string('name', 150).notNullable();
    t.string('email', 255).notNullable();
    t.string('phone', 40).nullable();
    t.string('company', 200).nullable();
    t.string('website', 255).nullable();
    t.string('company_size', 40).nullable();
    t.string('monthly_volume', 40).nullable();
    t.jsonb('interests').notNullable().defaultTo('[]');
    t.string('subject', 200).nullable();
    t.text('message').nullable();
    t.text('admin_notes').nullable();
    t.string('source_page', 255).nullable();
    t.string('ip_address', 64).nullable();
    t.string('user_agent', 500).nullable();
    t.timestamps(true, true);
    t.index(['status', 'created_at']);
    t.index(['email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('enquiries');
}
