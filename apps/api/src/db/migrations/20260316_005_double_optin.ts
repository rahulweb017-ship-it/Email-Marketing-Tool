import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscriptions', (t) => {
    t.string('confirmation_token', 100).nullable();
    t.timestamp('confirmed_at').nullable();
    t.string('status', 20).notNullable().defaultTo('active');

    t.index('confirmation_token', 'idx_subscriptions_confirmation_token');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscriptions', (t) => {
    t.dropIndex('confirmation_token', 'idx_subscriptions_confirmation_token');
    t.dropColumn('confirmation_token');
    t.dropColumn('confirmed_at');
    t.dropColumn('status');
  });
}
