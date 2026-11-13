import { z } from 'zod';

export const ENQUIRY_INTERESTS = [
  'email_campaigns',
  'automation',
  'whatsapp',
  'ai_assistant',
  'social_media',
  'transactional',
  'analytics',
  'templates',
] as const;

export const ENQUIRY_STATUSES = ['new', 'contacted', 'converted', 'closed'] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const createEnquirySchema = z.object({
  type: z.enum(['registration', 'contact']),
  name: z.string().trim().min(2, 'Please enter your name').max(150),
  email: z.string().trim().toLowerCase().email('Please enter a valid email').max(255),
  phone: optionalText(40),
  company: optionalText(200),
  website: optionalText(255),
  company_size: optionalText(40),
  monthly_volume: optionalText(40),
  interests: z.array(z.enum(ENQUIRY_INTERESTS)).max(ENQUIRY_INTERESTS.length).optional().default([]),
  subject: optionalText(200),
  message: optionalText(5000),
  source_page: optionalText(255),
  /** Honeypot: hidden on the form, so only bots fill it in. */
  fax_number: z.string().optional(),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

export const updateEnquirySchema = z.object({
  status: z.enum(ENQUIRY_STATUSES).optional(),
  admin_notes: z.string().max(5000).optional().nullable(),
});

export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>;
