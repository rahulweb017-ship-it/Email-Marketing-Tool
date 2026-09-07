import { z } from 'zod';

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  secret: z.string().min(16).optional(),
  events: z.array(z.enum([
    'campaign.sent', 'campaign.opened', 'campaign.clicked',
    'campaign.bounced', 'campaign.completed',
    'contact.created', 'contact.updated', 'contact.unsubscribed',
  ])).min(1),
});

export const updateWebhookSchema = createWebhookSchema.partial();

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
