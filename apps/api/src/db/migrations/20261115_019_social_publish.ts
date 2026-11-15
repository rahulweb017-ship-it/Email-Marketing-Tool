import type { Knex } from 'knex';

// social_posts.status is a plain varchar(20) (no CHECK constraint), so the new
// 'pending_approval' value needs no constraint change.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('social_tags', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 60).notNullable();
    t.string('color', 20).notNullable().defaultTo('#cc0000');
    t.timestamps(true, true);
    t.unique(['org_id', 'name']);
  });

  await knex.schema.createTable('social_ideas', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('title', 255).notNullable().defaultTo('');
    t.text('body').nullable();
    t.jsonb('media').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    t.jsonb('tags').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    // Board column: unassigned | todo | in_progress | done
    t.string('stage', 20).notNullable().defaultTo('unassigned');
    t.integer('position').notNullable().defaultTo(0);
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index(['org_id', 'stage', 'position']);
  });

  await knex.schema.createTable('social_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('content').notNullable().defaultTo('');
    t.jsonb('tags').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
    t.index('org_id');
  });

  await knex.schema.createTable('social_queue_slots', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('social_accounts').onDelete('CASCADE');
    t.smallint('day_of_week').notNullable(); // 0 = Sunday … 6 = Saturday
    t.string('time_of_day', 5).notNullable(); // HH:MM in the org's queue timezone
    t.timestamps(true, true);
    t.index(['org_id', 'account_id']);
  });

  await knex.schema.createTable('social_queue_settings', (t) => {
    t.uuid('org_id').primary().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('timezone', 64).notNullable().defaultTo('Asia/Kolkata');
    t.timestamps(true, true);
  });

  await knex.schema.alterTable('social_posts', (t) => {
    t.uuid('approved_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at').nullable();
    t.text('rejection_note').nullable();
    t.jsonb('tags').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    t.uuid('idea_id').nullable().references('id').inTable('social_ideas').onDelete('SET NULL');
    t.boolean('queued').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('social_post_accounts', (t) => {
    t.text('content_override').nullable();
    t.text('first_comment').nullable();
  });

  await knex.schema.alterTable('social_post_media', (t) => {
    t.uuid('org_id').nullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.index('org_id');
    t.index('post_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('social_post_media', (t) => {
    t.dropIndex('post_id');
    t.dropIndex('org_id');
    t.dropColumn('org_id');
  });
  await knex.schema.alterTable('social_post_accounts', (t) => {
    t.dropColumn('first_comment');
    t.dropColumn('content_override');
  });
  await knex.schema.alterTable('social_posts', (t) => {
    t.dropColumn('queued');
    t.dropColumn('idea_id');
    t.dropColumn('tags');
    t.dropColumn('rejection_note');
    t.dropColumn('approved_at');
    t.dropColumn('approved_by');
  });
  await knex('social_posts').where('status', 'pending_approval').update({ status: 'draft' });
  await knex.schema.dropTableIfExists('social_queue_settings');
  await knex.schema.dropTableIfExists('social_queue_slots');
  await knex.schema.dropTableIfExists('social_templates');
  await knex.schema.dropTableIfExists('social_ideas');
  await knex.schema.dropTableIfExists('social_tags');
}
