import type { Knex } from 'knex';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // WHATSAPP ACCOUNTS — Connected numbers (Meta Cloud API or QR-linked device)
  // ============================================================
  await knex.schema.createTable('whatsapp_accounts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('provider', 20).notNullable(); // meta_cloud, web_qr
    t.string('name', 255).notNullable();
    t.string('phone_e164', 20).nullable();
    t.string('display_name', 255).nullable();
    t.string('status', 20).notNullable().defaultTo('disconnected'); // pending_qr, connected, disconnected, logged_out, banned, paused, error
    t.text('credentials_encrypted').nullable(); // meta_cloud: {access_token, phone_number_id, waba_id}
    t.string('meta_phone_number_id', 64).nullable(); // plain copy for webhook routing
    t.integer('daily_limit').nullable(); // null = provider default / warm-up ramp
    t.integer('min_interval_sec').nullable();
    t.integer('max_interval_sec').nullable();
    t.jsonb('quiet_hours').nullable(); // {start: "21:00", end: "09:00", tz: "Asia/Kolkata"}
    t.timestamp('warmup_started_at').nullable();
    t.timestamp('last_seen_at').nullable();
    t.text('last_error').nullable();
    t.boolean('ai_enabled').notNullable().defaultTo(false);
    t.jsonb('ai_settings').notNullable().defaultTo('{}'); // {business_name, business_profile, handoff_keywords[], tone}
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);

    t.index('org_id');
    t.index('meta_phone_number_id');
  });

  // ============================================================
  // WHATSAPP SESSION KEYS — Encrypted auth state for QR-linked sessions
  // ============================================================
  await knex.schema.createTable('whatsapp_session_keys', (t) => {
    t.uuid('account_id').notNullable().references('id').inTable('whatsapp_accounts').onDelete('CASCADE');
    t.string('category', 64).notNullable(); // creds, pre-key, session, sender-key, app-state-sync-key, ...
    t.string('key_id', 255).notNullable();
    t.text('value_encrypted').notNullable();
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.primary(['account_id', 'category', 'key_id']);
  });

  // ============================================================
  // WHATSAPP TEMPLATES — Meta-approved templates (synced) or local message templates
  // ============================================================
  await knex.schema.createTable('whatsapp_templates', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('account_id').nullable().references('id').inTable('whatsapp_accounts').onDelete('CASCADE');
    t.string('source', 10).notNullable().defaultTo('local'); // meta, local
    t.string('name', 255).notNullable();
    t.string('language', 20).notNullable().defaultTo('en');
    t.string('category', 30).nullable(); // MARKETING, UTILITY, AUTHENTICATION
    t.string('status', 20).notNullable().defaultTo('APPROVED'); // APPROVED, PENDING, REJECTED, PAUSED, DISABLED
    t.text('body').notNullable().defaultTo('');
    t.jsonb('components').nullable(); // raw Meta components
    t.jsonb('variables').notNullable().defaultTo('[]'); // ["1","2"] for Meta, ["first_name"] for local
    t.string('meta_template_id', 64).nullable();
    t.text('rejection_reason').nullable();
    t.timestamps(true, true);

    t.index(['org_id', 'account_id']);
    t.unique(['account_id', 'name', 'language']);
  });

  // ============================================================
  // WHATSAPP CAMPAIGNS
  // ============================================================
  await knex.schema.createTable('whatsapp_campaigns', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('whatsapp_accounts').onDelete('CASCADE');
    t.string('name', 255).notNullable();
    t.uuid('template_id').nullable().references('id').inTable('whatsapp_templates').onDelete('SET NULL');
    t.text('message_body').nullable(); // free text (QR mode) or rendered template preview
    t.jsonb('media').nullable(); // {type: image|document|video, url, filename}
    t.jsonb('variable_mapping').notNullable().defaultTo('{}'); // {"1": "first_name", "2": "custom.city"}
    t.string('state', 20).notNullable().defaultTo('draft'); // draft, scheduled, queued, sending, paused, done, cancelled, failed
    t.boolean('require_consent').notNullable().defaultTo(true);
    t.timestamp('schedule_at').nullable();
    t.timestamp('started_at').nullable();
    t.timestamp('completed_at').nullable();
    t.text('failure_reason').nullable();
    t.integer('stat_total').notNullable().defaultTo(0);
    t.integer('stat_sent').notNullable().defaultTo(0);
    t.integer('stat_delivered').notNullable().defaultTo(0);
    t.integer('stat_read').notNullable().defaultTo(0);
    t.integer('stat_failed').notNullable().defaultTo(0);
    t.integer('stat_replied').notNullable().defaultTo(0);
    t.integer('stat_opted_out').notNullable().defaultTo(0);
    t.integer('stat_skipped').notNullable().defaultTo(0);
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);

    t.index(['org_id', 'state']);
  });

  await knex.schema.createTable('whatsapp_campaign_lists', (t) => {
    t.uuid('campaign_id').notNullable().references('id').inTable('whatsapp_campaigns').onDelete('CASCADE');
    t.uuid('list_id').notNullable().references('id').inTable('mailing_lists').onDelete('CASCADE');
    t.primary(['campaign_id', 'list_id']);
  });

  // ============================================================
  // WHATSAPP CONVERSATIONS — One thread per (account, phone)
  // ============================================================
  await knex.schema.createTable('whatsapp_conversations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('whatsapp_accounts').onDelete('CASCADE');
    t.uuid('contact_id').nullable().references('id').inTable('contacts').onDelete('SET NULL');
    t.string('phone_e164', 20).notNullable();
    t.string('profile_name', 255).nullable();
    t.text('last_message_preview').nullable();
    t.timestamp('last_message_at').nullable();
    t.timestamp('last_inbound_at').nullable(); // Meta 24h customer-service window
    t.integer('unread_count').notNullable().defaultTo(0);
    t.string('status', 20).notNullable().defaultTo('open'); // open, closed, needs_human
    t.boolean('ai_paused').notNullable().defaultTo(false);
    t.timestamps(true, true);

    t.unique(['account_id', 'phone_e164']);
    t.index(['org_id', 'last_message_at']);
    t.index('contact_id');
  });

  // ============================================================
  // WHATSAPP MESSAGES — Every inbound and outbound message
  // ============================================================
  await knex.schema.createTable('whatsapp_messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('account_id').notNullable().references('id').inTable('whatsapp_accounts').onDelete('CASCADE');
    t.uuid('conversation_id').nullable().references('id').inTable('whatsapp_conversations').onDelete('CASCADE');
    t.uuid('campaign_id').nullable().references('id').inTable('whatsapp_campaigns').onDelete('SET NULL');
    t.uuid('contact_id').nullable().references('id').inTable('contacts').onDelete('SET NULL');
    t.string('phone_e164', 20).notNullable();
    t.string('direction', 3).notNullable(); // in, out
    t.string('type', 20).notNullable().defaultTo('text'); // text, image, document, video, audio, template, other
    t.text('body').nullable();
    t.jsonb('media').nullable();
    t.jsonb('template').nullable(); // {name, language, components}
    t.string('provider_message_id', 255).nullable();
    t.string('status', 20).notNullable(); // queued, sending, sent, delivered, read, failed, received, skipped, cancelled
    t.text('error').nullable();
    t.string('sent_by', 20).nullable(); // user, campaign, ai, api, system
    t.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('scheduled_for').nullable();
    t.timestamp('sent_at').nullable();
    t.timestamp('delivered_at').nullable();
    t.timestamp('read_at').nullable();
    t.timestamp('failed_at').nullable();
    t.timestamps(true, true);

    t.index('provider_message_id');
    t.index(['conversation_id', 'created_at']);
    t.index(['org_id', 'created_at']);
    t.index(['campaign_id', 'status']);
    t.index(['contact_id', 'created_at']);
  });
  await knex.raw(`CREATE INDEX idx_whatsapp_messages_queued ON whatsapp_messages (account_id, created_at) WHERE status = 'queued'`);

  // ============================================================
  // WHATSAPP AI KNOWLEDGE — What the auto-reply bot is allowed to answer from
  // ============================================================
  await knex.schema.createTable('whatsapp_ai_knowledge', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('account_id').nullable().references('id').inTable('whatsapp_accounts').onDelete('CASCADE'); // null = all accounts
    t.string('title', 255).notNullable();
    t.text('content').notNullable();
    t.string('source', 30).notNullable().defaultTo('manual'); // manual, taught_from_reply
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);

    t.index(['org_id', 'is_active']);
  });

  // ============================================================
  // CONTACTS — normalized phone + WhatsApp opt-out
  // ============================================================
  await knex.schema.alterTable('contacts', (t) => {
    t.string('phone_e164', 20).nullable();
    t.boolean('whatsapp_opt_out').notNullable().defaultTo(false);
    t.timestamp('whatsapp_opt_out_at').nullable();
    t.index(['org_id', 'phone_e164']);
  });

  // Backfill phone_e164 from existing free-text phone numbers (default region India)
  const rows = await knex('contacts').whereNotNull('phone').andWhere('phone', '<>', '').select('id', 'phone', 'country_code');
  for (const row of rows) {
    const region = (row.country_code || 'IN').toUpperCase();
    const parsed = parsePhoneNumberFromString(String(row.phone), region as any);
    if (parsed?.isValid()) {
      await knex('contacts').where('id', row.id).update({ phone_e164: parsed.number });
    }
  }

  // ============================================================
  // PLANS — WhatsApp limits + feature flags
  // ============================================================
  await knex.schema.alterTable('plans', (t) => {
    t.integer('max_whatsapp_messages_per_month').notNullable().defaultTo(0);
    t.integer('max_whatsapp_accounts').notNullable().defaultTo(0);
  });

  const waPlanDefaults: Record<string, { messages: number; accounts: number; ai: boolean }> = {
    pro: { messages: 10000, accounts: 2, ai: true },
    enterprise: { messages: 100000, accounts: 10, ai: true },
  };
  const plans = await knex('plans').select('id', 'name', 'features');
  for (const plan of plans) {
    const defaults = waPlanDefaults[plan.name];
    if (!defaults) continue;
    const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {});
    await knex('plans').where('id', plan.id).update({
      max_whatsapp_messages_per_month: defaults.messages,
      max_whatsapp_accounts: defaults.accounts,
      features: JSON.stringify({ ...features, whatsapp: true, whatsapp_ai: defaults.ai }),
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const plans = await knex('plans').select('id', 'features');
  for (const plan of plans) {
    const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || {});
    delete features.whatsapp;
    delete features.whatsapp_ai;
    await knex('plans').where('id', plan.id).update({ features: JSON.stringify(features) });
  }
  await knex.schema.alterTable('plans', (t) => {
    t.dropColumn('max_whatsapp_messages_per_month');
    t.dropColumn('max_whatsapp_accounts');
  });
  await knex.schema.alterTable('contacts', (t) => {
    t.dropIndex(['org_id', 'phone_e164']);
    t.dropColumn('phone_e164');
    t.dropColumn('whatsapp_opt_out');
    t.dropColumn('whatsapp_opt_out_at');
  });
  await knex.schema.dropTableIfExists('whatsapp_ai_knowledge');
  await knex.schema.dropTableIfExists('whatsapp_messages');
  await knex.schema.dropTableIfExists('whatsapp_conversations');
  await knex.schema.dropTableIfExists('whatsapp_campaign_lists');
  await knex.schema.dropTableIfExists('whatsapp_campaigns');
  await knex.schema.dropTableIfExists('whatsapp_templates');
  await knex.schema.dropTableIfExists('whatsapp_session_keys');
  await knex.schema.dropTableIfExists('whatsapp_accounts');
}
