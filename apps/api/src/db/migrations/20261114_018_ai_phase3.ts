import type { Knex } from 'knex';

// Phase 3: unified leads inbox, predictive contact scores.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('leads', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('source', 30).notNullable(); // whatsapp, email, website, social, ads, manual, api
    t.string('source_detail', 200).nullable(); // e.g. form name, ad campaign, platform
    t.string('external_ref', 255).nullable(); // id in the source system (conversation, form submission, ad lead)
    t.string('name', 255).nullable();
    t.string('email', 255).nullable();
    t.string('phone', 40).nullable();
    t.string('phone_e164', 20).nullable();
    t.string('company', 255).nullable();
    t.text('message').nullable();
    t.string('status', 20).notNullable().defaultTo('new'); // new, contacted, qualified, unqualified, converted
    t.smallint('score').nullable();
    t.string('temperature', 10).nullable(); // hot, warm, cold
    t.text('ai_summary').nullable();
    t.jsonb('ai_qualification').nullable();
    t.timestamp('ai_qualified_at').nullable();
    t.uuid('contact_id').nullable().references('id').inTable('contacts').onDelete('SET NULL');
    t.uuid('conversation_id').nullable().references('id').inTable('whatsapp_conversations').onDelete('SET NULL');
    t.uuid('assigned_to').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.text('notes').nullable();
    t.timestamp('last_activity_at').notNullable().defaultTo(knex.fn.now());
    t.timestamps(true, true);
    t.unique(['org_id', 'source', 'external_ref']);
    t.index(['org_id', 'status', 'last_activity_at']);
  });

  await knex.schema.createTable('lead_events', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('type', 30).notNullable(); // created, message, status, qualified, note, converted
    t.text('body').nullable();
    t.uuid('user_id').nullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['lead_id', 'created_at']);
  });

  await knex.schema.alterTable('organizations', (t) => {
    t.string('lead_webhook_token', 64).nullable().unique();
  });

  await knex.schema.alterTable('contacts', (t) => {
    t.smallint('churn_risk').nullable();
    t.smallint('predicted_engagement').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('churn_risk');
    t.dropColumn('predicted_engagement');
  });
  await knex.schema.alterTable('organizations', (t) => {
    t.dropColumn('lead_webhook_token');
  });
  await knex.schema.dropTableIfExists('lead_events');
  await knex.schema.dropTableIfExists('leads');
}
