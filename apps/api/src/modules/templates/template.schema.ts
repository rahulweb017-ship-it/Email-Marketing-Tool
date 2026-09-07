import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  subject: z.string().max(500).optional(),
  body_html: z.string().optional(),
  body_design: z.record(z.unknown()).optional(),
  thumbnail_url: z.string().url().optional(),
  is_favorite: z.boolean().default(false),
  category: z.string().max(50).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
