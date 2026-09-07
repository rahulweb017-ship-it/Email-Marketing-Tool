import { z } from 'zod';

export const createTenantSchema = z.object({
  org_name: z.string().min(2).max(100),
  admin_email: z.string().email(),
  admin_name: z.string().min(2).max(100),
  admin_password: z.string().min(8).max(128),
  plan_id: z.string().uuid().optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  plan_id: z.string().uuid().optional(),
  billing_email: z.string().email().optional(),
  limits_override: z.record(z.unknown()).optional(),
});

export const updateTenantStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'pending']),
  reason: z.string().max(500).optional(),
});

export const createPlanSchema = z.object({
  name: z.string().min(2).max(100),
  display_name: z.string().min(2).max(255),
  max_contacts: z.number().int().min(0).default(500),
  max_emails_per_month: z.number().int().min(0).default(1000),
  max_campaigns: z.number().int().min(0).nullable().default(null),
  max_automations: z.number().int().min(0).nullable().default(null),
  max_sending_configs: z.number().int().min(1).default(1),
  max_users: z.number().int().min(1).default(1),
  max_lists: z.number().int().min(1).default(5),
  features: z.record(z.boolean()).default({}),
  price_monthly: z.number().min(0).default(0),
  price_yearly: z.number().min(0).default(0),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

export const updatePlanSchema = createPlanSchema.partial();

export const resetUserPasswordSchema = z.object({
  new_password: z.string().min(8).max(128).optional(),
});

export const updateUserStatusSchema = z.object({
  is_active: z.boolean(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateTenantStatusInput = z.infer<typeof updateTenantStatusSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
