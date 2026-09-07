import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('transactional_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 100).notNullable();
    t.string('subject', 500).notNullable();
    t.text('body_html').notNullable();
    t.jsonb('body_design').nullable();
    t.jsonb('variables').notNullable().defaultTo('[]');
    t.timestamps(true, true);

    t.unique(['org_id', 'name']);
  });

  await knex.schema.createTable('transactional_messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('template_id').nullable().references('id').inTable('transactional_templates').onDelete('SET NULL');
    t.string('to_email', 320).notNullable();
    t.string('to_name', 200).nullable();
    t.string('subject', 500).notNullable();
    t.string('status', 20).notNullable().defaultTo('queued');
    t.uuid('sending_config_id').nullable().references('id').inTable('sending_configs').onDelete('SET NULL');
    t.jsonb('variables').notNullable().defaultTo('{}');
    t.text('error_message').nullable();
    t.timestamp('sent_at').nullable();
    t.timestamps(true, true);

    t.index(['org_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('transactional_messages');
  await knex.schema.dropTableIfExists('transactional_templates');
}
