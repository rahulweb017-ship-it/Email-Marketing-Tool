import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('contacts', (t) => {
    t.integer('engagement_score').notNullable().defaultTo(0);
    t.timestamp('engagement_updated_at').nullable();
  });

  // Index for efficient segment queries on engagement_score
  await knex.raw('CREATE INDEX idx_contacts_engagement_score ON contacts (engagement_score)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_contacts_engagement_score');
  await knex.schema.alterTable('contacts', (t) => {
    t.dropColumn('engagement_score');
    t.dropColumn('engagement_updated_at');
  });
}
