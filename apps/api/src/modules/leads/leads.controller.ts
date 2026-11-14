import { Router } from 'express';
import { authenticate, checkTenantStatus, requireRole } from '../auth/auth.middleware.js';
import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import { qualifyLead } from '../ai/leads-ai.service.js';
import { replyToConversation } from '../whatsapp/whatsapp-messages.service.js';
import { convertSchema, createLeadSchema, noteSchema, updateLeadSchema, whatsappReplySchema } from './leads.schema.js';
import * as leads from './leads.service.js';
import { mapWebhookPayload } from './leads.utils.js';

export const leadsRouter = Router();
leadsRouter.use(authenticate, checkTenantStatus);

const org = (req: any) => req.user!.org_id as string;
const webhookUrl = (token: string) => `${env.APP_URL.replace(/\/+$/, '')}/webhooks/leads/${token}`;

leadsRouter.get('/', async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    const q = (k: string) => (typeof req.query[k] === 'string' && req.query[k] ? String(req.query[k]) : undefined);
    const { data, total } = await leads.listLeads(org(req), pagination, {
      status: q('status'), source: q('source'), temperature: q('temperature'), search: q('search'),
    });
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

leadsRouter.get('/stats', async (req, res, next) => {
  try { res.json(await leads.leadStats(org(req))); } catch (err) { next(err); }
});

leadsRouter.get('/webhook', async (req, res, next) => {
  try { res.json({ url: webhookUrl(await leads.getWebhookToken(org(req))) }); } catch (err) { next(err); }
});

leadsRouter.post('/webhook/rotate', requireRole('admin'), async (req, res, next) => {
  try { res.json({ url: webhookUrl(await leads.getWebhookToken(org(req), true)) }); } catch (err) { next(err); }
});

leadsRouter.post('/', async (req, res, next) => {
  try { res.status(201).json(await leads.createManualLead(org(req), req.user!.id, createLeadSchema.parse(req.body))); } catch (err) { next(err); }
});

leadsRouter.get('/:id', async (req, res, next) => {
  try { res.json(await leads.getLead(org(req), String(req.params.id))); } catch (err) { next(err); }
});

leadsRouter.patch('/:id', async (req, res, next) => {
  try { res.json(await leads.updateLead(org(req), req.user!.id, String(req.params.id), updateLeadSchema.parse(req.body))); } catch (err) { next(err); }
});

leadsRouter.delete('/:id', async (req, res, next) => {
  try { await leads.deleteLead(org(req), String(req.params.id)); res.status(204).end(); } catch (err) { next(err); }
});

leadsRouter.post('/:id/notes', async (req, res, next) => {
  try { res.json(await leads.addNote(org(req), req.user!.id, String(req.params.id), noteSchema.parse(req.body).body)); } catch (err) { next(err); }
});

leadsRouter.post('/:id/convert', async (req, res, next) => {
  try { res.json(await leads.convertLead(org(req), req.user!.id, String(req.params.id), convertSchema.parse(req.body ?? {}))); } catch (err) { next(err); }
});

leadsRouter.post('/:id/qualify', async (req, res, next) => {
  try {
    await qualifyLead(String(req.params.id), { orgId: org(req), userId: req.user!.id });
    res.json(await leads.getLead(org(req), String(req.params.id)));
  } catch (err) { next(err); }
});

leadsRouter.post('/:id/whatsapp-reply', async (req, res, next) => {
  try {
    const lead = await leads.getLead(org(req), String(req.params.id));
    if (!lead.conversation_id) throw new AppError(400, 'This lead has no WhatsApp conversation');
    const { body } = whatsappReplySchema.parse(req.body);
    await replyToConversation(org(req), req.user!.id, lead.conversation_id, { body } as any);
    if (lead.status === 'new') await leads.updateLead(org(req), req.user!.id, lead.id, { status: 'contacted' });
    res.json(await leads.getLead(org(req), lead.id));
  } catch (err) { next(err); }
});

/** Public intake for ad platforms, social tools, Zapier/Make and custom website forms. */
export const leadsWebhookRouter = Router();
const WEBHOOK_PER_MINUTE = 120;

leadsWebhookRouter.post('/webhooks/leads/:token', async (req, res, next) => {
  try {
    const orgId = await leads.orgForWebhookToken(String(req.params.token));
    if (!orgId) throw new AppError(404, 'Unknown lead webhook');
    const key = `leads:webhook:${orgId}:${Math.floor(Date.now() / 60_000)}`;
    const hits = await redis.incr(key).catch(() => 0);
    if (hits === 1) await redis.expire(key, 120).catch(() => undefined);
    if (hits > WEBHOOK_PER_MINUTE) throw new AppError(429, 'Too many leads in the last minute. Try again shortly.');
    const fields = mapWebhookPayload(req.body);
    if (!fields.name && !fields.email && !fields.phone) throw new AppError(400, 'Send at least a name, email or phone');
    const { id, created } = await leads.upsertLead(orgId, { ...fields, source: fields.source!, qualify: true });
    res.status(created ? 201 : 200).json({ id, created });
  } catch (err) { next(err); }
});
