import { z } from 'zod';

export const createListSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  is_public: z.boolean().default(false),
  is_double_optin: z.boolean().default(false),
});

export const updateListSchema = createListSchema.partial();

export const addSubscribersSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(10000),
});

export const unsubscribeSchema = z.object({
  contact_id: z.string().uuid(),
  reason_id: z.string().uuid().optional(),
  reason_text: z.string().max(500).optional(),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type AddSubscribersInput = z.infer<typeof addSubscribersSchema>;
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
