import { z } from 'zod';
import { LEAD_STATUSES } from './leads.utils.js';

const opt = (max: number) => z.string().trim().max(max).optional();

export const createLeadSchema = z.object({
  name: opt(255),
  email: z.string().trim().email().max(255).optional().or(z.literal('').transform(() => undefined)),
  phone: opt(40),
  company: opt(255),
  message: opt(5000),
  source_detail: opt(200),
});

export const updateLeadSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  notes: z.string().max(10000).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  name: opt(255),
  email: opt(255),
  phone: opt(40),
  company: opt(255),
});

export const noteSchema = z.object({ body: z.string().trim().min(1).max(5000) });
export const convertSchema = z.object({ list_ids: z.array(z.string().uuid()).max(20).optional() });
export const whatsappReplySchema = z.object({ body: z.string().trim().min(1).max(4096) });
