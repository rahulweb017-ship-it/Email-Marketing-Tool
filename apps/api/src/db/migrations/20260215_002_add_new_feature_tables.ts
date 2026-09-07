import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // TEMPLATE VERSIONS (Phase 5 – C4)
  // ============================================================
  await knex.schema.createTable('template_versions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('template_id').notNullable().references('id').inTable('email_templates').onDelete('CASCADE');
    t.integer('version_number').notNullable();
    t.string('name', 255);
    t.string('subject', 998);
    t.text('body_html');
    t.jsonb('body_design');
    t.timestamp('created_at').defaultTo(knex.raw('now()'));
    t.index('template_id');
    t.index(['template_id', 'version_number']);
  });

  // ============================================================
  // API KEYS (Phase 4 – B3)
  // ============================================================
  await knex.schema.createTable('api_keys', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('key_prefix', 20).notNullable();
    t.string('key_hash', 255).notNullable();
    t.jsonb('scopes').defaultTo('[]');
    t.timestamp('expires_at');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('last_used_at');
    t.timestamps(true, true);
    t.index('org_id');
    t.index('key_hash');
  });

  // ============================================================
  // OUTGOING WEBHOOKS (Phase 4 – B3)
  // ============================================================
  await knex.schema.createTable('outgoing_webhooks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('url', 2048).notNullable();
    t.string('secret', 255);
    t.jsonb('events').defaultTo('[]');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
    t.index('org_id');
  });

  // ============================================================
  // OUTGOING WEBHOOK LOGS (Phase 4 – B3)
  // ============================================================
  await knex.schema.createTable('outgoing_webhook_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('webhook_id').notNullable().references('id').inTable('outgoing_webhooks').onDelete('CASCADE');
    t.string('event_type', 100).notNullable();
    t.jsonb('payload');
    t.integer('response_status');
    t.text('response_body');
    t.integer('duration_ms');
    t.boolean('success').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.raw('now()'));
    t.index('webhook_id');
    t.index('created_at');
  });

  // ============================================================
  // AUDIT LOGS (Phase 6 – C3)
  // ============================================================
  await knex.schema.createTable('audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 100).notNullable();
    t.string('entity_type', 100).notNullable();
    t.uuid('entity_id');
    t.jsonb('changes');
    t.string('ip_address', 45);
    t.text('user_agent');
    t.timestamp('created_at').defaultTo(knex.raw('now()'));
    t.index('org_id');
    t.index(['org_id', 'entity_type']);
    t.index(['org_id', 'created_at']);
  });

  // ============================================================
  // NOTIFICATIONS (Phase 5 – C6)
  // ============================================================
  await knex.schema.createTable('notifications', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('title', 500).notNullable();
    t.text('body');
    t.string('type', 50).defaultTo('info');
    t.string('link', 2048);
    t.boolean('is_read').defaultTo(false);
    t.timestamps(true, true);
    t.index('org_id');
    t.index(['org_id', 'is_read']);
  });

  // ============================================================
  // ADDITIONAL INDEXES (Phase 1 – A4)
  // ============================================================
  // Partial index for scheduled campaigns (campaign scheduler worker)
  await knex.raw(`
    CREATE INDEX idx_campaigns_scheduled
    ON campaigns(schedule_date)
    WHERE state = 'scheduled'
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop index first
  await knex.raw('DROP INDEX IF EXISTS idx_campaigns_scheduled');

  // Drop tables in reverse dependency order
  const tables = [
    'notifications',
    'audit_logs',
    'outgoing_webhook_logs',
    'outgoing_webhooks',
    'api_keys',
    'template_versions',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
