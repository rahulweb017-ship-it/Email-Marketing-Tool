import { z } from 'zod';

const quietHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  tz: z.string().max(64).optional(),
}).nullable();

export const createMetaAccountSchema = z.object({
  provider: z.literal('meta_cloud'),
  name: z.string().min(1).max(255),
  access_token: z.string().min(20),
  phone_number_id: z.string().regex(/^\d+$/, 'Phone number ID is numeric'),
  waba_id: z.string().regex(/^\d+$/, 'WhatsApp Business Account ID is numeric'),
});

export const createQrAccountSchema = z.object({
  provider: z.literal('web_qr'),
  name: z.string().min(1).max(255),
  accept_risk: z.literal(true, { errorMap: () => ({ message: 'You must accept the QR-linking risk notice' }) }),
});

export const createAccountSchema = z.discriminatedUnion('provider', [createMetaAccountSchema, createQrAccountSchema]);

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  daily_limit: z.number().int().min(1).max(100000).nullable().optional(),
  min_interval_sec: z.number().min(0.1).max(600).nullable().optional(),
  max_interval_sec: z.number().min(0.1).max(900).nullable().optional(),
  quiet_hours: quietHoursSchema.optional(),
  ai_enabled: z.boolean().optional(),
  ai_settings: z.object({
    business_name: z.string().max(255).optional(),
    business_profile: z.string().max(4000).optional(),
    tone: z.string().max(100).optional(),
    language: z.string().max(50).optional(),
    handoff_keywords: z.array(z.string().max(50)).max(30).optional(),
    stop_keywords: z.array(z.string().max(50)).max(30).optional(),
  }).optional(),
});

const mediaSchema = z.object({
  type: z.enum(['image', 'document', 'video']),
  url: z.string().url(),
  filename: z.string().max(255).optional(),
});

export const sendMessageSchema = z.object({
  account_id: z.string().uuid(),
  contact_id: z.string().uuid().optional(),
  phone: z.string().max(30).optional(),
  body: z.string().max(4096).optional(),
  media: mediaSchema.optional(),
  template_id: z.string().uuid().optional(),
  variable_mapping: z.record(z.string()).optional(),
}).refine((v) => v.contact_id || v.phone, { message: 'contact_id or phone is required' })
  .refine((v) => v.body || v.media || v.template_id, { message: 'A message body, media or template is required' });

export const replySchema = z.object({
  body: z.string().max(4096).optional(),
  media: mediaSchema.optional(),
  template_id: z.string().uuid().optional(),
  variable_mapping: z.record(z.string()).optional(),
}).refine((v) => v.body || v.media || v.template_id, { message: 'A message body, media or template is required' });

export const updateConversationSchema = z.object({
  status: z.enum(['open', 'closed', 'needs_human']).optional(),
  ai_paused: z.boolean().optional(),
});

export const saveContactSchema = z.object({
  email: z.string().email(),
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  list_ids: z.array(z.string().uuid()).optional(),
  whatsapp_consent: z.boolean().optional(),
});

export const createTemplateSchema = z.object({
  account_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  body: z.string().min(1).max(1024),
  language: z.string().max(20).default('en'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional(),
  /** Submit to Meta for approval (Meta accounts only); otherwise it's a local template for QR numbers */
  submit_to_meta: z.boolean().default(false),
  examples: z.array(z.string()).optional(),
});

export const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  account_id: z.string().uuid(),
  template_id: z.string().uuid().nullable().optional(),
  message_body: z.string().max(4096).nullable().optional(),
  media: mediaSchema.nullable().optional(),
  variable_mapping: z.record(z.string()).optional(),
  list_ids: z.array(z.string().uuid()).min(1, 'Pick at least one list'),
  require_consent: z.boolean().optional(),
});

export const updateCampaignSchema = campaignSchema.partial();

export const scheduleCampaignSchema = z.object({
  schedule_at: z.string().datetime().optional(),
});

export const testCampaignSchema = z.object({
  phones: z.array(z.string().max(30)).min(1).max(3),
});

export const knowledgeSchema = z.object({
  account_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(8000),
  is_active: z.boolean().optional(),
});

export const teachSchema = z.object({
  message_id: z.string().uuid(),
  question: z.string().max(2000).optional(),
});

export const composeSchema = z.object({
  goal: z.string().min(3).max(1000),
  tone: z.string().max(100).optional(),
  language: z.string().max(50).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  for_template: z.boolean().optional(),
});

export const aiTestSchema = z.object({
  account_id: z.string().uuid(),
  messages: z.array(z.object({ role: z.enum(['customer', 'business']), text: z.string().max(2000) })).min(1).max(20),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
