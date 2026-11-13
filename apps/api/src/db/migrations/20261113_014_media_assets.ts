import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('media_assets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('original_name', 255).notNullable();
    t.string('stored_name', 100).notNullable();
    t.string('mime_type', 100).notNullable();
    t.string('kind', 20).notNullable(); // image, video, document
    t.integer('size_bytes').notNullable();
    t.integer('width').nullable();
    t.integer('height').nullable();
    t.timestamps(true, true);
    t.index(['org_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('media_assets');
}
