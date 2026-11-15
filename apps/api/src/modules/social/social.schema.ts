import { z } from 'zod';
import { TIME_OF_DAY_RE } from './social.utils.js';

export const PLATFORMS = ['twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'threads', 'pinterest'] as const;
export const SCHEDULE_MODES = ['draft', 'now', 'queue', 'queue_top', 'custom'] as const;
export const IDEA_STAGES = ['unassigned', 'todo', 'in_progress', 'done'] as const;

export const connectAccountSchema = z.object({
  platform: z.enum(PLATFORMS),
});

const mediaItemSchema = z.object({
  url: z.string().url().max(2000),
  type: z.enum(['image', 'video', 'gif']),
  alt_text: z.string().max(500).nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
});

const overrideSchema = z.object({
  account_id: z.string().uuid(),
  content_override: z.string().max(63206).nullable().optional(),
  first_comment: z.string().max(8000).nullable().optional(),
});

const postBody = {
  content: z.string().max(63206).default(''),
  account_ids: z.array(z.string().uuid()).max(50).default([]),
  overrides: z.array(overrideSchema).max(50).optional(),
  media: z.array(mediaItemSchema).max(20).optional(),
  media_ids: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string().uuid()).max(30).optional(),
  idea_id: z.string().uuid().nullable().optional(),
  schedule_mode: z.enum(SCHEDULE_MODES).optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
};

export const createPostSchema = z.object(postBody);

export const updatePostSchema = z.object({
  content: postBody.content.optional(),
  account_ids: postBody.account_ids.optional(),
  overrides: postBody.overrides,
  media: postBody.media,
  tags: postBody.tags,
  schedule_mode: postBody.schedule_mode,
  scheduled_at: postBody.scheduled_at,
});

export const listPostsQuerySchema = z.object({
  tab: z.enum(['queue', 'drafts', 'approvals', 'sent']).optional(),
  status: z.string().max(30).optional(),
  account_id: z.string().uuid().optional(),
  tag: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const countsQuerySchema = z.object({
  account_id: z.string().uuid().optional(),
  tag: z.string().uuid().optional(),
});

export const schedulePostSchema = z.object({
  scheduled_at: z.string().datetime(),
});

export const rejectPostSchema = z.object({
  note: z.string().max(2000).optional().default(''),
});

export const calendarQuerySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

// ─── Queue ───

export const slotsQuerySchema = z.object({ account_id: z.string().uuid().optional() });

export const putSlotsSchema = z.object({
  account_id: z.string().uuid(),
  slots: z.array(z.object({
    day_of_week: z.number().int().min(0).max(6),
    time_of_day: z.string().regex(TIME_OF_DAY_RE, 'Use HH:MM (24 hour)'),
  })).max(200),
});

export const queueSettingsSchema = z.object({
  timezone: z.string().min(1).max(64),
});

export const nextSlotQuerySchema = z.object({
  account_ids: z.string().min(1),
  mode: z.enum(['queue', 'queue_top']).default('queue'),
});

// ─── Tags / templates / ideas ───

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const templateSchema = z.object({
  name: z.string().trim().min(1).max(255),
  content: z.string().max(63206).default(''),
  tags: z.array(z.string().uuid()).max(30).optional(),
});

const ideaMediaSchema = z.object({
  url: z.string().url().max(2000),
  type: z.enum(['image', 'video', 'gif']),
});

export const createIdeaSchema = z.object({
  title: z.string().max(255).default(''),
  body: z.string().max(63206).nullable().optional(),
  media: z.array(ideaMediaSchema).max(20).optional(),
  tags: z.array(z.string().uuid()).max(30).optional(),
  stage: z.enum(IDEA_STAGES).default('unassigned'),
});

export const updateIdeaSchema = z.object({
  title: z.string().max(255).optional(),
  body: z.string().max(63206).nullable().optional(),
  media: z.array(ideaMediaSchema).max(20).optional(),
  tags: z.array(z.string().uuid()).max(30).optional(),
});

export const moveIdeaSchema = z.object({
  stage: z.enum(IDEA_STAGES),
  position: z.number().int().min(0),
});

export type ConnectAccountInput = z.infer<typeof connectAccountSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;
export type ScheduleMode = typeof SCHEDULE_MODES[number];
export type TemplateInput = z.infer<typeof templateSchema>;
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;
