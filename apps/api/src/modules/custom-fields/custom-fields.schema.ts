import { z } from 'zod';

export const createCustomFieldSchema = z.object({
  name: z.string().min(2).max(100),
  field_key: z.string().min(2).max(100).regex(/^[a-z][a-z0-9_]*$/, 'field_key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores'),
  field_type: z.enum(['text', 'number', 'date', 'boolean', 'dropdown']),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const updateCustomFieldSchema = createCustomFieldSchema.partial();

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>;
