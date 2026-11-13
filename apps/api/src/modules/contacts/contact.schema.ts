import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const contactFields = z.object({
  email: z.preprocess(emptyToUndefined, z.string().trim().email().nullable().optional()),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  company_name: z.string().max(200).optional(),
  phone: z.preprocess(emptyToUndefined, z.string().max(50).nullable().optional()),
  country_code: z.preprocess(emptyToUndefined, z.string().length(2).optional()),
  custom_fields: z.record(z.unknown()).optional(),
  custom_field_values: z.record(z.string()).optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  list_ids: z.array(z.string().uuid()).optional(),
});

export const createContactSchema = contactFields.refine((c) => !!c.email || !!c.phone, {
  message: 'Add an email address or a phone number',
  path: ['email'],
});

export const updateContactSchema = contactFields.partial();

/** CSV rows are cleaned server-side (contact-import.utils), so accept loose string values here. */
const importRowSchema = z.record(z.union([z.string(), z.number(), z.null()]).optional());

export const bulkImportSchema = z.object({
  contacts: z.array(importRowSchema).min(1).max(10000),
  list_id: z.string().uuid().optional(),
  default_country: z.string().length(2).optional(),
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
export type ImportRow = z.infer<typeof importRowSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type BulkActionInput = z.infer<typeof bulkActionSchema>;
