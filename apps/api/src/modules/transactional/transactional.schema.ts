import { z } from 'zod';

export const createTransactionalTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1),
  body_design: z.record(z.unknown()).nullable().optional(),
  variables: z.array(z.string()).optional(),
});

export const updateTransactionalTemplateSchema = createTransactionalTemplateSchema.partial();

export const sendTransactionalSchema = z.object({
  to: z.string().email(),
  to_name: z.string().max(200).optional(),
  subject: z.string().min(1).max(500).optional(),
  template_name: z.string().optional(),
  body_html: z.string().optional(),
  variables: z.record(z.string()).optional(),
  sending_config_id: z.string().uuid().optional(),
});

export const sendBatchTransactionalSchema = z.object({
  messages: z.array(sendTransactionalSchema).min(1).max(100),
});
