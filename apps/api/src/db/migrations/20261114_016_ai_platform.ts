import type { Knex } from 'knex';

// Platform-wide AI: monthly AI credits per plan, a usage ledger, and one brand voice per organisation.
const PLAN_CREDITS: Record<string, number> = { free: 50, starter: 300, pro: 2000, enterprise: 20000 };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('plans', (t) => {
    t.integer('max_ai_credits_per_month').notNullable().defaultTo(0);
  });
  const plans = await knex('plans').select('id', 'name');
  for (const plan of plans) {
    const credits = PLAN_CREDITS[String(plan.name).toLowerCase()];
    if (credits !== undefined) await knex('plans').where('id', plan.id).update({ max_ai_credits_per_month: credits });
  }

  await knex.schema.createTable('brand_profiles', (t) => {
    t.uuid('org_id').primary().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('business_name', 200).nullable();
    t.string('website', 255).nullable();
    t.string('industry', 120).nullable();
    t.text('description').nullable();
    t.text('products').nullable();
    t.text('audience').nullable();
    t.string('tone', 200).nullable();
    t.string('language', 80).nullable();
    t.text('words_to_use').nullable();
    t.text('words_to_avoid').nullable();
    t.text('sample_copy').nullable();
    t.uuid('updated_by').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('ai_usage_events', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('user_id').nullable();
    t.string('feature', 60).notNullable();
    t.integer('credits').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['org_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ai_usage_events');
  await knex.schema.dropTableIfExists('brand_profiles');
  await knex.schema.alterTable('plans', (t) => {
    t.dropColumn('max_ai_credits_per_month');
  });
}
