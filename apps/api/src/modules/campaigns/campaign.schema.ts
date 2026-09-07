import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(500),
  preview_text: z.string().max(200).optional(),
  email_from: z.string().email(),
  reply_to: z.string().email().optional(),
  body_html: z.string().optional(),
  body_design: z.record(z.unknown()).optional(),
  campaign_type: z.enum(['email', 'sms']).default('email'),
  schedule_type: z.enum(['now', 'scheduled']).default('now'),
  schedule_date: z.string().datetime().optional(),
  ab_test_enabled: z.boolean().default(false),
  ab_test_percentage: z.number().min(1).max(50).default(10),
  use_blacklist: z.boolean().default(true),
  sending_config_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_source: z.string().max(100).optional(),
  list_ids: z.array(z.string().uuid()).optional(),
  segment_ids: z.array(z.string().uuid()).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const sendTestSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(5),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type SendTestInput = z.infer<typeof sendTestSchema>;
