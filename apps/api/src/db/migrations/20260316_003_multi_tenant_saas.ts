import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function up(knex: Knex): Promise<void> {
  // ============================================================
  // PLANS TABLE
  // ============================================================
  await knex.schema.createTable('plans', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 100).unique().notNullable();
    t.string('display_name', 255).notNullable();
    t.integer('max_contacts').notNullable().defaultTo(500);
    t.integer('max_emails_per_month').notNullable().defaultTo(1000);
    t.integer('max_campaigns').nullable();
    t.integer('max_automations').nullable();
    t.integer('max_sending_configs').notNullable().defaultTo(1);
    t.integer('max_users').notNullable().defaultTo(1);
    t.integer('max_lists').notNullable().defaultTo(5);
    t.jsonb('features').defaultTo('{}');
    t.decimal('price_monthly', 10, 2).defaultTo(0);
    t.decimal('price_yearly', 10, 2).defaultTo(0);
    t.boolean('is_default').defaultTo(false);
    t.integer('sort_order').defaultTo(0);
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
  });

  // ============================================================
  // ALTER ORGANIZATIONS - add multi-tenant SaaS columns
  // ============================================================
  await knex.schema.alterTable('organizations', (t) => {
    t.uuid('plan_id').nullable().references('id').inTable('plans').onDelete('SET NULL');
    t.string('status', 20).notNullable().defaultTo('active');
    t.string('billing_email', 320).nullable();
    t.jsonb('billing_info').defaultTo('{}');
    t.jsonb('limits_override').defaultTo('{}');
    t.timestamp('suspended_at').nullable();
    t.text('suspended_reason').nullable();
  });

  // ============================================================
  // ALTER USERS - add super admin support
  // ============================================================
  await knex.schema.alterTable('users', (t) => {
    t.boolean('is_super_admin').defaultTo(false);
  });

  // Make org_id nullable for super admin users
  await knex.raw('ALTER TABLE users ALTER COLUMN org_id DROP NOT NULL');

  // ============================================================
  // USAGE TRACKING TABLE
  // ============================================================
  await knex.schema.createTable('usage_tracking', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE');
    t.string('period', 7).notNullable(); // YYYY-MM
    t.integer('emails_sent').defaultTo(0);
    t.integer('contacts_stored').defaultTo(0);
    t.integer('campaigns_created').defaultTo(0);
    t.integer('automations_created').defaultTo(0);
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.unique(['org_id', 'period']);
    t.index('org_id');
  });

  // ============================================================
  // SUPER ADMIN AUDIT LOGS
  // ============================================================
  await knex.schema.createTable('super_admin_audit_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('admin_user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 100).notNullable();
    t.uuid('target_org_id').nullable().references('id').inTable('organizations').onDelete('SET NULL');
    t.jsonb('details').defaultTo('{}');
    t.string('ip_address', 45).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('created_at');
  });

  // ============================================================
  // SEED DEFAULT PLANS
  // ============================================================
  const freePlanId = uuidv4();
  const starterPlanId = uuidv4();
  const proPlanId = uuidv4();
  const enterprisePlanId = uuidv4();

  await knex('plans').insert([
    {
      id: freePlanId,
      name: 'free',
      display_name: 'Free',
      max_contacts: 500,
      max_emails_per_month: 1000,
      max_campaigns: 5,
      max_automations: 1,
      max_sending_configs: 1,
      max_users: 1,
      max_lists: 5,
      features: JSON.stringify({ ab_testing: false, api_keys: false, webhooks: false }),
      price_monthly: 0,
      price_yearly: 0,
      is_default: true,
      sort_order: 0,
    },
    {
      id: starterPlanId,
      name: 'starter',
      display_name: 'Starter',
      max_contacts: 5000,
      max_emails_per_month: 25000,
      max_campaigns: 50,
      max_automations: 5,
      max_sending_configs: 2,
      max_users: 3,
      max_lists: 20,
      features: JSON.stringify({ ab_testing: true, api_keys: true, webhooks: false }),
      price_monthly: 29,
      price_yearly: 290,
      is_default: false,
      sort_order: 1,
    },
    {
      id: proPlanId,
      name: 'pro',
      display_name: 'Professional',
      max_contacts: 25000,
      max_emails_per_month: 100000,
      max_campaigns: null,
      max_automations: null,
      max_sending_configs: 5,
      max_users: 10,
      max_lists: 100,
      features: JSON.stringify({ ab_testing: true, api_keys: true, webhooks: true }),
      price_monthly: 79,
      price_yearly: 790,
      is_default: false,
      sort_order: 2,
    },
    {
      id: enterprisePlanId,
      name: 'enterprise',
      display_name: 'Enterprise',
      max_contacts: 999999999,
      max_emails_per_month: 999999999,
      max_campaigns: null,
      max_automations: null,
      max_sending_configs: 999,
      max_users: 999,
      max_lists: 999,
      features: JSON.stringify({ ab_testing: true, api_keys: true, webhooks: true }),
      price_monthly: 199,
      price_yearly: 1990,
      is_default: false,
      sort_order: 3,
    },
  ]);

  // ============================================================
  // ASSIGN DEFAULT PLAN TO ALL EXISTING ORGANIZATIONS
  // ============================================================
  await knex('organizations').update({ plan_id: freePlanId, status: 'active' });

  // ============================================================
  // CREATE INITIAL SUPER ADMIN USER
  // ============================================================
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@system.local';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123#';
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  await knex('users').insert({
    id: uuidv4(),
    org_id: null,
    email: superAdminEmail.toLowerCase(),
    email_normalized: superAdminEmail.toLowerCase().replace(/[^a-z0-9@.]/g, ''),
    password_hash: passwordHash,
    name: 'Super Admin',
    role: 'admin',
    is_active: true,
    is_super_admin: true,
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove super admin users
  await knex('users').where('is_super_admin', true).del();

  // Drop new tables
  await knex.schema.dropTableIfExists('super_admin_audit_logs');
  await knex.schema.dropTableIfExists('usage_tracking');

  // Remove columns from organizations
  await knex.schema.alterTable('organizations', (t) => {
    t.dropColumn('plan_id');
    t.dropColumn('status');
    t.dropColumn('billing_email');
    t.dropColumn('billing_info');
    t.dropColumn('limits_override');
    t.dropColumn('suspended_at');
    t.dropColumn('suspended_reason');
  });

  // Remove columns from users
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('is_super_admin');
  });

  // Restore org_id NOT NULL
  await knex.raw('ALTER TABLE users ALTER COLUMN org_id SET NOT NULL');

  // Drop plans table
  await knex.schema.dropTableIfExists('plans');
}
