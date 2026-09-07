import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // SOCIAL ACCOUNTS — Connected platform accounts (OAuth tokens)
  // ============================================================
  await knex.schema.createTable('social_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('platform', 20).notNullable(); // twitter, facebook, instagram, linkedin
    t.string('platform_account_id', 255).notNullable();
    t.string('account_name', 255).notNullable();
    t.text('account_avatar_url').nullable();
    t.string('account_type', 50).nullable(); // personal, page, business
    t.text('access_token_encrypted').notNullable();
    t.text('refresh_token_encrypted').nullable();
    t.timestamp('token_expires_at').nullable();
    t.text('scopes').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.text('last_error').nullable();
    t.timestamp('last_verified_at').nullable();
    t.timestamps(true, true);

    t.unique(['org_id', 'platform', 'platform_account_id']);
    t.index('org_id');
  });

  // ============================================================
  // SOCIAL POSTS — Post content and status
  // ============================================================
  await knex.schema.createTable('social_posts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.text('content').notNullable();
    t.string('status', 20).notNullable().defaultTo('draft'); // draft, scheduled, publishing, published, partially_failed, failed
    t.timestamp('scheduled_at').nullable();
    t.timestamp('published_at').nullable();
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);

    t.index(['org_id', 'status']);
    t.index(['org_id', 'scheduled_at']);
  });

  // ============================================================
  // SOCIAL POST ACCOUNTS — Junction: which accounts a post targets
  // ============================================================
  await knex.schema.createTable('social_post_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('post_id').notNullable().references('id').inTable('social_posts').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('social_accounts').onDelete('CASCADE');
    t.string('platform_post_id', 255).nullable();
    t.text('platform_post_url').nullable();
    t.string('status', 20).notNullable().defaultTo('pending'); // pending, published, failed
    t.text('error_message').nullable();
    t.timestamp('published_at').nullable();

    t.unique(['post_id', 'account_id']);
  });

  // ============================================================
  // SOCIAL POST MEDIA — Media attachments for posts
  // ============================================================
  await knex.schema.createTable('social_post_media', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('post_id').nullable().references('id').inTable('social_posts').onDelete('CASCADE');
    t.text('file_url').notNullable();
    t.string('file_type', 20).notNullable(); // image, video, gif
    t.integer('file_size').nullable();
    t.string('alt_text', 500).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // ============================================================
  // SOCIAL POST METRICS — Per-account engagement metrics
  // ============================================================
  await knex.schema.createTable('social_post_metrics', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('post_account_id').notNullable().references('id').inTable('social_post_accounts').onDelete('CASCADE');
    t.integer('likes').notNullable().defaultTo(0);
    t.integer('comments').notNullable().defaultTo(0);
    t.integer('shares').notNullable().defaultTo(0);
    t.integer('reach').notNullable().defaultTo(0);
    t.integer('impressions').notNullable().defaultTo(0);
    t.integer('clicks').notNullable().defaultTo(0);
    t.timestamp('fetched_at').notNullable().defaultTo(knex.fn.now());

    t.index('post_account_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('social_post_metrics');
  await knex.schema.dropTableIfExists('social_post_media');
  await knex.schema.dropTableIfExists('social_post_accounts');
  await knex.schema.dropTableIfExists('social_posts');
  await knex.schema.dropTableIfExists('social_accounts');
}
