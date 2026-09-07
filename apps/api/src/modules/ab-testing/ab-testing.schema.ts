import { z } from 'zod';

export const createAbTestSchema = z.object({
  name: z.string().min(1).max(200),
  test_percentage: z.number().min(5).max(50).default(20),
  winner_criteria: z.enum(['open_rate', 'click_rate']).default('open_rate'),
  evaluation_hours: z.number().min(1).max(168).default(4),
  variants: z.array(z.object({
    name: z.string().min(1),
    subject: z.string().min(1),
    body_html: z.string().min(1),
    preview_text: z.string().optional(),
  })).min(2).max(4),
  list_ids: z.array(z.string().uuid()).min(1),
  email_from: z.string().email(),
  reply_to: z.string().email().optional(),
  sending_config_id: z.string().uuid().optional(),
});

export const updateAbTestSchema = createAbTestSchema.partial().omit({ variants: true });

export type CreateAbTestInput = z.infer<typeof createAbTestSchema>;
export type UpdateAbTestInput = z.infer<typeof updateAbTestSchema>;
