import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('signup_forms', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description').nullable();
    t.jsonb('list_ids').notNullable().defaultTo('[]');
    t.jsonb('custom_field_ids').defaultTo('[]');
    t.text('success_message').defaultTo('Thank you for subscribing!');
    t.string('redirect_url', 500).nullable();
    t.jsonb('style').defaultTo('{}');
    t.boolean('honeypot_enabled').defaultTo(true);
    t.boolean('double_optin').defaultTo(true);
    t.string('status', 20).defaultTo('active');
    t.integer('submit_count').defaultTo(0);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('signup_forms');
}
