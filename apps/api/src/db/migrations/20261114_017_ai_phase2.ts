import type { Knex } from 'knex';

// Phase 2 AI: send-time optimisation, campaign insights, working automation emails and smart inbox.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.smallint('best_send_hour').nullable(); // UTC hour 0-23 when this contact usually opens
  });

  await knex.schema.alterTable('campaigns', (t) => {
    t.boolean('send_time_optimized').notNullable().defaultTo(false);
    // Optional segment that narrows the campaign's list recipients
    t.uuid('segment_id').nullable().references('id').inTable('segments').onDelete('SET NULL');
    t.jsonb('ai_insights').nullable();
    t.timestamp('ai_insights_at').nullable();
    // Hidden per-step campaigns that carry automation emails through the normal sender and tracking
    t.boolean('is_automation').notNullable().defaultTo(false);
    t.uuid('automation_activity_id').nullable().references('id').inTable('automation_activities').onDelete('SET NULL');
    t.index(['automation_activity_id']);
  });

  await knex.schema.alterTable('automation_campaigns', (t) => {
    t.string('email_from', 320).nullable();
    t.string('reply_to', 320).nullable();
  });

  await knex.schema.alterTable('whatsapp_conversations', (t) => {
    t.string('ai_intent', 30).nullable();
    t.string('ai_sentiment', 20).nullable();
    t.text('ai_summary').nullable();
    t.boolean('ai_hot_lead').notNullable().defaultTo(false);
    t.timestamp('ai_classified_at').nullable();
    t.index(['org_id', 'ai_intent']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('whatsapp_conversations', (t) => {
    t.dropIndex(['org_id', 'ai_intent']);
    t.dropColumns('ai_intent', 'ai_sentiment', 'ai_summary', 'ai_hot_lead', 'ai_classified_at');
  });
  await knex.schema.alterTable('automation_campaigns', (t) => {
    t.dropColumns('email_from', 'reply_to');
  });
  await knex.schema.alterTable('campaigns', (t) => {
    t.dropIndex(['automation_activity_id']);
    t.dropColumns('send_time_optimized', 'segment_id', 'ai_insights', 'ai_insights_at', 'is_automation', 'automation_activity_id');
  });
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('best_send_hour');
  });
}
