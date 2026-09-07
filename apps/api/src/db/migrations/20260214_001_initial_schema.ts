import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enable UUID extension
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  // ============================================================
  // ORGANIZATIONS & USERS
  // ============================================================
  await knex.schema.createTable('organizations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 255).notNullable();
    t.string('slug', 100).unique().notNullable();
    t.jsonb('settings').defaultTo('{}');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('email', 320).unique().notNullable();
    t.string('email_normalized', 320).notNullable();
    t.string('password_hash', 255).notNullable();
    t.string('name', 255).notNullable();
    t.string('role', 50).defaultTo('user');
    t.boolean('is_active').defaultTo(true);
    t.timestamp('last_login_at');
    t.timestamps(true, true);
    t.index('org_id');
  });

  // ============================================================
  // CONTACTS & TAGS
  // ============================================================
  await knex.schema.createTable('contacts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('email', 320).notNullable();
    t.string('email_normalized', 320).notNullable();
    t.string('first_name', 255);
    t.string('last_name', 255);
    t.string('company_name', 255);
    t.string('phone', 50);
    t.string('country_code', 2);
    t.string('timezone', 50);
    t.jsonb('custom_fields').defaultTo('{}');
    t.integer('message_bounce').defaultTo(0);
    t.boolean('is_blacklisted').defaultTo(false);
    t.timestamp('last_open_at');
    t.timestamp('last_click_at');
    t.string('source', 100);
    t.timestamps(true, true);
    t.index(['org_id', 'email_normalized']);
    t.index('org_id');
  });

  await knex.schema.createTable('tags', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('color', 7);
    t.unique(['org_id', 'name']);
  });

  await knex.schema.createTable('contact_tags', (t) => {
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.uuid('tag_id').notNullable().references('id').inTable('tags').onDelete('CASCADE');
    t.primary(['contact_id', 'tag_id']);
  });

  // ============================================================
  // MAILING LISTS & SUBSCRIPTIONS
  // ============================================================
  await knex.schema.createTable('unsubscribe_reasons', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.integer('sequence').defaultTo(10);
    t.boolean('requires_feedback').defaultTo(false);
  });

  await knex.schema.createTable('mailing_lists', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.boolean('is_public').defaultTo(false);
    t.boolean('is_double_optin').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    t.integer('contact_count').defaultTo(0);
    t.integer('contact_count_active').defaultTo(0);
    t.integer('contact_count_opt_out').defaultTo(0);
    t.integer('contact_count_blacklisted').defaultTo(0);
    t.integer('contact_count_bounced').defaultTo(0);
    t.timestamps(true, true);
    t.index('org_id');
  });

  await knex.schema.createTable('subscriptions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.uuid('list_id').notNullable().references('id').inTable('mailing_lists').onDelete('CASCADE');
    t.boolean('opt_out').defaultTo(false);
    t.timestamp('opt_out_at');
    t.uuid('opt_out_reason_id').references('id').inTable('unsubscribe_reasons');
    t.timestamps(true, true);
    t.unique(['contact_id', 'list_id']);
    t.index('list_id');
    t.index('contact_id');
  });

  // ============================================================
  // SEGMENTS
  // ============================================================
  await knex.schema.createTable('segments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.jsonb('filter_rules').defaultTo('[]');
    t.integer('cached_count').defaultTo(0);
    t.timestamp('last_computed_at');
    t.timestamps(true, true);
  });

  // ============================================================
  // BLACKLIST
  // ============================================================
  await knex.schema.createTable('email_blacklist', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('email', 320).notNullable();
    t.string('email_normalized', 320).notNullable();
    t.boolean('is_active').defaultTo(true);
    t.text('reason');
    t.uuid('opt_out_reason_id').references('id').inTable('unsubscribe_reasons');
    t.string('added_by', 100);
    t.timestamps(true, true);
    t.unique(['org_id', 'email_normalized']);
  });

  // ============================================================
  // EMAIL TEMPLATES
  // ============================================================
  await knex.schema.createTable('email_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('subject', 998);
    t.string('preview_text', 500);
    t.text('body_html');
    t.jsonb('body_design');
    t.string('thumbnail_url', 1024);
    t.string('category', 100);
    t.boolean('is_favorite').defaultTo(false);
    t.uuid('created_by').references('id').inTable('users');
    t.timestamps(true, true);
  });

  // ============================================================
  // SENDING CONFIGS
  // ============================================================
  await knex.schema.createTable('sending_configs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.string('provider', 50).notNullable(); // smtp, sendgrid, ses
    t.boolean('is_default').defaultTo(false);
    t.jsonb('config').defaultTo('{}');
    t.text('settings_encrypted'); // AES-256-CBC encrypted provider credentials
    t.string('from_filter', 255);
    t.integer('daily_limit').defaultTo(0);
    t.integer('hourly_limit').defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ============================================================
  // A/B TEST GROUPS
  // ============================================================
  await knex.schema.createTable('ab_test_groups', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255);
    t.string('winner_criteria', 50).defaultTo('open_rate'); // open_rate, click_rate, reply_rate, manual
    t.uuid('winner_campaign_id'); // set later via FK
    t.timestamp('evaluation_date');
    t.boolean('is_completed').defaultTo(false);
    t.timestamps(true, true);
  });

  // ============================================================
  // CAMPAIGNS
  // ============================================================
  await knex.schema.createTable('campaigns', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    // Content
    t.string('name', 255);
    t.string('subject', 998).notNullable();
    t.string('preview_text', 500);
    t.string('email_from', 320).notNullable();
    t.string('reply_to', 320);
    t.string('reply_to_mode', 20).defaultTo('sender');
    t.text('body_html');
    t.jsonb('body_design');
    // State
    t.string('state', 20).defaultTo('draft').notNullable();
    t.string('campaign_type', 10).defaultTo('email').notNullable();
    // Scheduling
    t.string('schedule_type', 20).defaultTo('now');
    t.timestamp('schedule_date');
    t.timestamp('sent_date');
    // Recipients
    t.string('recipient_type', 50).defaultTo('list');
    t.jsonb('recipient_filter').defaultTo('{}');
    t.boolean('use_blacklist').defaultTo(true);
    // UTM
    t.string('utm_campaign', 255);
    t.string('utm_medium', 100).defaultTo('email');
    t.string('utm_source', 255);
    // Sending
    t.string('sending_provider', 50);
    t.uuid('sending_config_id').references('id').inTable('sending_configs');
    // A/B Testing
    t.boolean('ab_test_enabled').defaultTo(false);
    t.uuid('ab_test_group_id').references('id').inTable('ab_test_groups');
    t.integer('ab_test_percentage').defaultTo(10);
    // Attachments
    t.jsonb('attachments').defaultTo('[]');
    // Ownership
    t.uuid('created_by').references('id').inTable('users');
    // Denormalized stats
    t.integer('stat_total').defaultTo(0);
    t.integer('stat_sent').defaultTo(0);
    t.integer('stat_delivered').defaultTo(0);
    t.integer('stat_opened').defaultTo(0);
    t.integer('stat_clicked').defaultTo(0);
    t.integer('stat_replied').defaultTo(0);
    t.integer('stat_bounced').defaultTo(0);
    t.integer('stat_failed').defaultTo(0);
    t.integer('stat_unsubscribed').defaultTo(0);
    t.timestamps(true, true);
    t.index(['org_id', 'state']);
  });

  // Add FK for ab_test_groups.winner_campaign_id
  await knex.schema.alterTable('ab_test_groups', (t) => {
    t.foreign('winner_campaign_id').references('id').inTable('campaigns');
  });

  // Campaign-to-list M2M
  await knex.schema.createTable('campaign_lists', (t) => {
    t.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE');
    t.uuid('list_id').notNullable().references('id').inTable('mailing_lists').onDelete('CASCADE');
    t.primary(['campaign_id', 'list_id']);
  });

  // ============================================================
  // MAILING TRACES
  // ============================================================
  await knex.schema.createTable('mailing_traces', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE');
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.string('email', 320).notNullable();
    t.string('message_id', 500);
    // Status
    t.string('trace_status', 20).defaultTo('outgoing').notNullable();
    t.string('failure_type', 30);
    t.text('failure_reason');
    // Timestamps
    t.timestamp('sent_at');
    t.timestamp('delivered_at');
    t.timestamp('first_open_at');
    t.timestamp('last_open_at');
    t.timestamp('first_click_at');
    t.timestamp('last_click_at');
    t.timestamp('replied_at');
    t.timestamp('bounced_at');
    t.timestamp('unsubscribed_at');
    // Counters
    t.integer('open_count').defaultTo(0);
    t.integer('click_count').defaultTo(0);
    // Automation link (set later via FK)
    t.uuid('automation_trace_id');
    // Metadata
    t.specificType('ip_address', 'inet');
    t.text('user_agent');
    t.timestamps(true, true);
    // Indexes
    t.index('campaign_id');
    t.index('contact_id');
    t.index(['campaign_id', 'trace_status']);
    t.index('message_id');
  });

  // Partial index for outgoing traces (queue processing)
  await knex.raw(`
    CREATE INDEX idx_traces_outgoing ON mailing_traces(campaign_id, created_at)
    WHERE trace_status = 'outgoing'
  `);

  // ============================================================
  // LINK TRACKING
  // ============================================================
  await knex.schema.createTable('tracked_links', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('campaign_id').references('id').inTable('campaigns').onDelete('CASCADE');
    t.text('original_url').notNullable();
    t.string('short_code', 20).unique().notNullable();
    t.string('utm_campaign', 255);
    t.string('utm_medium', 100);
    t.string('utm_source', 255);
    t.string('label', 255);
    t.integer('click_count').defaultTo(0);
    t.integer('unique_click_count').defaultTo(0);
    t.timestamps(true, true);
    t.index('short_code');
    t.index('campaign_id');
  });

  await knex.schema.createTable('link_clicks', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('tracked_link_id').notNullable().references('id').inTable('tracked_links').onDelete('CASCADE');
    t.uuid('mailing_trace_id').references('id').inTable('mailing_traces').onDelete('SET NULL');
    t.specificType('ip_address', 'inet');
    t.text('user_agent');
    t.string('country_code', 2);
    t.timestamp('clicked_at').defaultTo(knex.raw('now()'));
    t.index('mailing_trace_id');
    t.index('tracked_link_id');
  });

  // ============================================================
  // MARKETING AUTOMATION
  // ============================================================
  await knex.schema.createTable('automation_campaigns', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.text('description');
    t.string('state', 20).defaultTo('draft').notNullable();
    // Target audience
    t.string('target_type', 50).defaultTo('list');
    t.specificType('target_list_ids', 'uuid[]');
    t.uuid('target_segment_id').references('id').inTable('segments');
    t.jsonb('target_filter').defaultTo('[]');
    // Deduplication
    t.string('unique_field', 50).defaultTo('email');
    // UTM
    t.string('utm_campaign', 255);
    t.string('utm_source', 255);
    // Stats
    t.integer('running_participant_count').defaultTo(0);
    t.integer('completed_participant_count').defaultTo(0);
    // Sync
    t.timestamp('last_sync_at');
    t.uuid('created_by').references('id').inTable('users');
    t.timestamps(true, true);
    t.index(['org_id', 'state']);
  });

  await knex.schema.createTable('automation_activities', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('campaign_id').notNullable().references('id').inTable('automation_campaigns').onDelete('CASCADE');
    t.uuid('parent_id').references('id').inTable('automation_activities').onDelete('CASCADE');
    // Definition
    t.string('name', 255).notNullable();
    t.string('activity_type', 20).notNullable().defaultTo('email');
    t.string('trigger_type', 30).notNullable().defaultTo('begin');
    // Timing
    t.integer('interval_number').defaultTo(0);
    t.string('interval_unit', 10).defaultTo('hours');
    // Validity
    t.boolean('has_validity').defaultTo(false);
    t.integer('validity_duration_number').defaultTo(0);
    t.string('validity_duration_unit', 10).defaultTo('hours');
    // Content
    t.uuid('email_template_id').references('id').inTable('email_templates');
    t.uuid('campaign_ref_id').references('id').inTable('campaigns');
    // Action config
    t.string('action_type', 50);
    t.jsonb('action_config').defaultTo('{}');
    // Filters
    t.jsonb('activity_filter').defaultTo('[]');
    t.jsonb('computed_filter').defaultTo('[]');
    // Workflow editor position
    t.float('position_x').defaultTo(0);
    t.float('position_y').defaultTo(0);
    // Stats
    t.integer('stat_processed').defaultTo(0);
    t.integer('stat_rejected').defaultTo(0);
    t.integer('stat_error').defaultTo(0);
    // Sync
    t.boolean('requires_sync').defaultTo(false);
    t.timestamps(true, true);
    t.index('campaign_id');
    t.index('parent_id');
  });

  await knex.schema.createTable('automation_participants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('campaign_id').notNullable().references('id').inTable('automation_campaigns').onDelete('CASCADE');
    t.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    t.string('state', 20).defaultTo('running').notNullable();
    t.boolean('is_test').defaultTo(false);
    t.timestamp('entered_at').defaultTo(knex.raw('now()'));
    t.timestamp('completed_at');
    t.timestamps(true, true);
    t.index(['campaign_id', 'state']);
  });
  // Unique constraint: one running participant per contact per campaign
  await knex.raw(`
    CREATE UNIQUE INDEX idx_auto_participants_unique
    ON automation_participants(campaign_id, contact_id)
    WHERE state = 'running'
  `);

  await knex.schema.createTable('automation_traces', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('participant_id').notNullable().references('id').inTable('automation_participants').onDelete('CASCADE');
    t.uuid('activity_id').notNullable().references('id').inTable('automation_activities').onDelete('CASCADE');
    t.uuid('parent_id').references('id').inTable('automation_traces').onDelete('CASCADE');
    // State
    t.string('state', 20).defaultTo('scheduled').notNullable();
    t.text('state_message');
    t.timestamp('schedule_date');
    t.timestamp('processed_at');
    // Link to mailing trace
    t.uuid('mailing_trace_id').references('id').inTable('mailing_traces');
    // Test flag
    t.boolean('is_test').defaultTo(false);
    t.timestamps(true, true);
    t.index('participant_id');
    t.index('activity_id');
    t.index('parent_id');
  });
  // Partial index for scheduled traces
  await knex.raw(`
    CREATE INDEX idx_auto_traces_scheduled
    ON automation_traces(state, schedule_date)
    WHERE state = 'scheduled'
  `);

  // Add FK from mailing_traces to automation_traces
  await knex.schema.alterTable('mailing_traces', (t) => {
    t.foreign('automation_trace_id').references('id').inTable('automation_traces');
  });

  // ============================================================
  // WEBHOOK EVENTS (audit log)
  // ============================================================
  await knex.schema.createTable('webhook_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('provider', 50).notNullable();
    t.string('event_type', 100).notNullable();
    t.jsonb('payload').notNullable();
    t.boolean('processed').defaultTo(false);
    t.text('error_message');
    t.timestamp('received_at').defaultTo(knex.raw('now()'));
  });

  // ============================================================
  // REFRESH TOKENS
  // ============================================================
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 500).notNullable();
    t.boolean('revoked').defaultTo(false);
    t.timestamp('expires_at').notNullable();
    t.timestamps(true, true);
    t.index('user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'refresh_tokens', 'webhook_events',
    'automation_traces', 'automation_participants', 'automation_activities', 'automation_campaigns',
    'link_clicks', 'tracked_links', 'mailing_traces',
    'campaign_lists', 'campaigns', 'ab_test_groups',
    'sending_configs', 'email_templates',
    'email_blacklist', 'segments',
    'subscriptions', 'mailing_lists', 'unsubscribe_reasons',
    'contact_tags', 'tags', 'contacts',
    'users', 'organizations',
  ];

  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
