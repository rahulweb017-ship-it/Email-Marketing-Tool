import { z } from 'zod';

export const createContactSchema = z.object({
  email: z.string().email(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  company_name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  country_code: z.string().length(2).optional(),
  custom_fields: z.record(z.unknown()).optional(),
  custom_field_values: z.record(z.string()).optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  list_ids: z.array(z.string().uuid()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

export const bulkImportSchema = z.object({
  contacts: z.array(createContactSchema).min(1).max(10000),
  list_id: z.string().uuid().optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(7).optional(),
});

export const bulkActionSchema = z.object({
  action: z.enum(['delete', 'tag', 'untag', 'add_to_list', 'remove_from_list', 'blacklist', 'unblacklist']),
  contact_ids: z.array(z.string().uuid()).min(1).max(1000),
  tag_id: z.string().uuid().optional(),
  list_id: z.string().uuid().optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
