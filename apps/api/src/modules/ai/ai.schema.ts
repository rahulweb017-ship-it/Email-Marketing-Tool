import { z } from 'zod';

const opt = (max: number) => z.string().max(max).optional().nullable();

export const brandProfileSchema = z.object({
  business_name: opt(200),
  website: opt(255),
  industry: opt(120),
  description: opt(3000),
  products: opt(5000),
  audience: opt(2000),
  tone: opt(200),
  language: opt(80),
  words_to_use: opt(1000),
  words_to_avoid: opt(1000),
  sample_copy: opt(3000),
});
export type BrandProfileInput = z.infer<typeof brandProfileSchema>;

export const writeEmailSchema = z.object({
  brief: z.string().min(5).max(2000),
  tone: z.string().max(100).optional(),
  language: z.string().max(60).optional(),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  cta_url: z.string().max(500).optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const rewriteSchema = z.object({
  text: z.string().min(1).max(5000),
  instruction: z.string().min(2).max(300),
});

export const subjectLinesSchema = z.object({
  topic: z.string().max(1000).optional(),
  content_html: z.string().max(200_000).optional(),
  current_subject: z.string().max(200).optional(),
  language: z.string().max(60).optional(),
}).refine((v) => !!(v.topic?.trim() || v.content_html?.trim() || v.current_subject?.trim()), {
  message: 'Describe the email, or add some content first',
});

export const segmentBuildSchema = z.object({ description: z.string().min(5).max(1000) });

export const automationBuildSchema = z.object({
  description: z.string().min(10).max(2000),
  cta_url: z.string().url().max(500).optional(),
});

export const copilotChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
  })).min(1).max(30),
});

export const copilotDraftSchema = z.object({
  kind: z.enum(['segment', 'automation', 'email_campaign']),
  title: z.string().trim().max(200).default(''),
  brief: z.string().trim().min(10).max(2000),
});

export const socialWriteSchema = z.object({
  brief: z.string().min(5).max(2000),
  platforms: z.array(z.enum(['twitter', 'facebook', 'linkedin', 'instagram'])).min(1).max(4),
  tone: z.string().max(100).optional(),
  language: z.string().max(60).optional(),
  include_hashtags: z.boolean().default(true),
});
