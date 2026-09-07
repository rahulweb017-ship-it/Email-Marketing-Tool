import { z } from 'zod';

export const addBlacklistSchema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

export const bulkBlacklistSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(10000),
  reason: z.string().max(500).optional(),
});

export type AddBlacklistInput = z.infer<typeof addBlacklistSchema>;
export type BulkBlacklistInput = z.infer<typeof bulkBlacklistSchema>;
