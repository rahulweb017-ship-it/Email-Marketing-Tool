import { z } from 'zod';

export const createAutomationCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  // Audience: contacts subscribed to any of the lists, narrowed by every segment
  target_filter: z.array(z.object({
    field: z.enum(['list', 'segment']).optional(),
    operator: z.enum(['in_list', 'in_segment']),
    value: z.string().uuid(),
  })).max(10).default([]),
  unique_field: z.string().default('email'),
  email_from: z.string().email().nullable().optional(),
  reply_to: z.string().email().nullable().optional(),
});

export const updateAutomationCampaignSchema = createAutomationCampaignSchema.partial();

export const createActivitySchema = z.object({
  campaign_id: z.string().uuid(),
  parent_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  activity_type: z.enum(['email', 'sms', 'action', 'wait', 'condition']),
  trigger_type: z.enum([
    'begin', 'activity_completed',
    'mail_opened', 'mail_not_opened',
    'mail_replied', 'mail_not_replied',
    'mail_clicked', 'mail_not_clicked',
    'mail_bounced',
    'tag_added', 'field_updated',
    'segment_entered', 'segment_exited',
  ]),
  interval_number: z.number().int().min(0).default(0),
  interval_unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']).default('hours'),
  has_validity: z.boolean().default(false),
  validity_duration_number: z.number().int().min(0).default(0),
  validity_duration_unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months']).default('hours'),
  activity_filter: z.array(z.unknown()).default([]),
  action_config: z.record(z.unknown()).default({}),
  email_template_id: z.string().uuid().optional(),
  position_x: z.number().default(0),
  position_y: z.number().default(0),
  parent_handle: z.string().max(10).nullable().optional(),
});

export const updateActivitySchema = createActivitySchema.partial().omit({ campaign_id: true });

export type CreateAutomationCampaignInput = z.infer<typeof createAutomationCampaignSchema>;
export type UpdateAutomationCampaignInput = z.infer<typeof updateAutomationCampaignSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
