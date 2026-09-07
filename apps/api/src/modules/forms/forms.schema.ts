import { z } from 'zod';

export const createFormSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  list_ids: z.array(z.string().uuid()).min(1, 'At least one list is required'),
  custom_field_ids: z.array(z.string().uuid()).optional().default([]),
  success_message: z.string().optional().default('Thank you for subscribing!'),
  redirect_url: z.string().url().max(500).optional().or(z.literal('')),
  style: z.object({
    primary_color: z.string().optional(),
    background_color: z.string().optional(),
  }).optional().default({}),
  honeypot_enabled: z.boolean().optional().default(true),
  double_optin: z.boolean().optional().default(true),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateFormSchema = createFormSchema.partial();

export const submitFormSchema = z.object({
  email: z.string().email(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  custom_fields: z.record(z.string()).optional().default({}),
  hp_field: z.string().optional(), // honeypot
});

export type CreateFormInput = z.infer<typeof createFormSchema>;
export type UpdateFormInput = z.infer<typeof updateFormSchema>;
export type SubmitFormInput = z.infer<typeof submitFormSchema>;
