import { z } from 'zod';

export const connectAccountSchema = z.object({
  platform: z.enum(['twitter', 'facebook', 'instagram', 'linkedin']),
});

export const createPostSchema = z.object({
  content: z.string().min(1).max(63206),
  account_ids: z.array(z.string().uuid()).min(1, 'Select at least one account'),
  scheduled_at: z.string().datetime().optional(),
  media_ids: z.array(z.string().uuid()).optional(),
});

export const updatePostSchema = z.object({
  content: z.string().min(1).max(63206).optional(),
  account_ids: z.array(z.string().uuid()).min(1).optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
});

export const schedulePostSchema = z.object({
  scheduled_at: z.string().datetime(),
});

export const calendarQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;
