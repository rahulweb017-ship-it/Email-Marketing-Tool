import { Router } from 'express';
import { authenticate, checkTenantStatus, requireFeature, requireRole } from '../auth/auth.middleware.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import {
  aiTestSchema, campaignSchema, composeSchema, createAccountSchema, createTemplateSchema, knowledgeSchema,
  replySchema, saveContactSchema, scheduleCampaignSchema, sendMessageSchema, teachSchema, testCampaignSchema,
  updateAccountSchema, updateCampaignSchema, updateConversationSchema,
} from './whatsapp.schema.js';
import * as accounts from './whatsapp-accounts.service.js';
import * as messages from './whatsapp-messages.service.js';
import * as campaigns from './whatsapp-campaigns.service.js';
import * as stats from './whatsapp-stats.service.js';
import * as aiService from './whatsapp-ai.service.js';

export const whatsappRouter = Router();

whatsappRouter.use(authenticate, checkTenantStatus, requireFeature('whatsapp'));

const org = (req: any): string => req.user!.org_id!;

// ─── Accounts ───

whatsappRouter.get('/accounts', async (req, res, next) => {
  try { res.json({ data: await accounts.listAccounts(org(req)) }); } catch (err) { next(err); }
});

whatsappRouter.post('/accounts', requireRole('admin'), async (req, res, next) => {
  try {
    const input = createAccountSchema.parse(req.body);
    res.status(201).json(await accounts.createAccount(org(req), req.user!.id, input));
  } catch (err) { next(err); }
});

whatsappRouter.get('/accounts/:id', async (req, res, next) => {
  try { res.json(await accounts.getAccount(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.patch('/accounts/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const input = updateAccountSchema.parse(req.body);
    res.json(await accounts.updateAccount(org(req), String(req.params.id), input));
  } catch (err) { next(err); }
});

whatsappRouter.delete('/accounts/:id', requireRole('admin'), async (req, res, next) => {
  try { await accounts.deleteAccount(org(req), String(req.params.id)); res.status(204).end(); } catch (err) { next(err); }
});

whatsappRouter.get('/accounts/:id/qr', async (req, res, next) => {
  try { res.json(await accounts.getQr(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.post('/accounts/:id/connect', requireRole('admin'), async (req, res, next) => {
  try { res.json(await accounts.connectAccount(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.post('/accounts/:id/logout', requireRole('admin'), async (req, res, next) => {
  try { res.json(await accounts.logoutAccount(org(req), String(req.params.id))); } catch (err) { next(err); }
});

// ─── Templates ───

whatsappRouter.get('/templates', async (req, res, next) => {
  try { res.json({ data: await accounts.listTemplates(org(req), req.query.account_id as string | undefined) }); } catch (err) { next(err); }
});

whatsappRouter.post('/templates', async (req, res, next) => {
  try {
    const input = createTemplateSchema.parse(req.body);
    res.status(201).json(await accounts.createTemplate(org(req), input));
  } catch (err) { next(err); }
});

whatsappRouter.post('/accounts/:id/templates/sync', async (req, res, next) => {
  try { res.json(await accounts.syncTemplates(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.delete('/templates/:id', async (req, res, next) => {
  try { await accounts.deleteTemplate(org(req), String(req.params.id)); res.status(204).end(); } catch (err) { next(err); }
});

// ─── Single send ───

whatsappRouter.post('/messages', async (req, res, next) => {
  try {
    const input = sendMessageSchema.parse(req.body);
    res.status(202).json(await messages.sendSingle(org(req), req.user!.id, input));
  } catch (err) { next(err); }
});

whatsappRouter.get('/contacts/:contactId/activity', async (req, res, next) => {
  try { res.json({ data: await messages.getContactWhatsAppActivity(org(req), String(req.params.contactId)) }); } catch (err) { next(err); }
});

// ─── Inbox ───

whatsappRouter.get('/conversations', async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await messages.listConversations(org(req), pagination, {
      account_id: req.query.account_id as string | undefined,
      status: req.query.status as string | undefined,
      unread: req.query.unread === 'true',
      search: req.query.search as string | undefined,
      intent: typeof req.query.intent === 'string' ? req.query.intent : undefined,
      hot: req.query.hot === 'true',
    });
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

whatsappRouter.get('/conversations/:id', async (req, res, next) => {
  try { res.json(await messages.getConversation(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const data = await messages.getConversationMessages(org(req), String(req.params.id), {
      before: req.query.before as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

whatsappRouter.post('/conversations/:id/reply', async (req, res, next) => {
  try {
    const input = replySchema.parse(req.body);
    res.status(202).json(await messages.replyToConversation(org(req), req.user!.id, String(req.params.id), input));
  } catch (err) { next(err); }
});

whatsappRouter.patch('/conversations/:id', async (req, res, next) => {
  try {
    const input = updateConversationSchema.parse(req.body);
    res.json(await messages.updateConversation(org(req), String(req.params.id), input));
  } catch (err) { next(err); }
});

whatsappRouter.post('/conversations/:id/save-contact', async (req, res, next) => {
  try {
    const input = saveContactSchema.parse(req.body);
    res.json(await messages.saveConversationContact(org(req), String(req.params.id), input));
  } catch (err) { next(err); }
});

whatsappRouter.post('/conversations/:id/suggest', requireFeature('whatsapp_ai'), async (req, res, next) => {
  try { res.json(await aiService.suggestReplies(org(req), String(req.params.id))); } catch (err) { next(err); }
});

// ─── Campaigns ───

whatsappRouter.get('/campaigns', async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await campaigns.listCampaigns(org(req), pagination, {
      state: req.query.state as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns', async (req, res, next) => {
  try {
    const input = campaignSchema.parse(req.body);
    res.status(201).json(await campaigns.createCampaign(org(req), req.user!.id, input));
  } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns/preview-message', async (req, res, next) => {
  try { res.json(await campaigns.previewMessage(org(req), req.body)); } catch (err) { next(err); }
});

whatsappRouter.get('/campaigns/:id', async (req, res, next) => {
  try { res.json(await campaigns.getCampaign(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.patch('/campaigns/:id', async (req, res, next) => {
  try {
    const input = updateCampaignSchema.parse(req.body);
    res.json(await campaigns.updateCampaign(org(req), String(req.params.id), input));
  } catch (err) { next(err); }
});

whatsappRouter.delete('/campaigns/:id', async (req, res, next) => {
  try { await campaigns.deleteCampaign(org(req), String(req.params.id)); res.status(204).end(); } catch (err) { next(err); }
});

whatsappRouter.get('/campaigns/:id/audience', async (req, res, next) => {
  try { res.json(await campaigns.previewAudience(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns/:id/schedule', async (req, res, next) => {
  try {
    const input = scheduleCampaignSchema.parse(req.body);
    res.json(await campaigns.scheduleCampaign(org(req), String(req.params.id), input.schedule_at));
  } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns/:id/pause', async (req, res, next) => {
  try { res.json(await campaigns.pauseCampaign(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns/:id/resume', async (req, res, next) => {
  try { res.json(await campaigns.resumeCampaign(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns/:id/cancel', async (req, res, next) => {
  try { res.json(await campaigns.cancelCampaign(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.post('/campaigns/:id/test', async (req, res, next) => {
  try {
    const input = testCampaignSchema.parse(req.body);
    res.json(await campaigns.testCampaign(org(req), req.user!.id, String(req.params.id), input.phones));
  } catch (err) { next(err); }
});

whatsappRouter.get('/campaigns/:id/stats', async (req, res, next) => {
  try { res.json(await stats.getCampaignStats(org(req), String(req.params.id))); } catch (err) { next(err); }
});

whatsappRouter.get('/campaigns/:id/messages', async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await campaigns.getCampaignMessages(org(req), String(req.params.id), pagination, req.query.status as string | undefined);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

// ─── Dashboard stats ───

const days = (req: any) => Math.min(365, Math.max(1, Number(req.query.days) || 30));

whatsappRouter.get('/stats/overview', async (req, res, next) => {
  try { res.json(await stats.getOverview(org(req), days(req))); } catch (err) { next(err); }
});

whatsappRouter.get('/stats/daily', async (req, res, next) => {
  try { res.json({ data: await stats.getDaily(org(req), days(req)) }); } catch (err) { next(err); }
});

whatsappRouter.get('/stats/accounts', async (req, res, next) => {
  try { res.json({ data: await stats.getAccountHealth(org(req)) }); } catch (err) { next(err); }
});

// ─── AI ───

whatsappRouter.post('/ai/compose', requireFeature('whatsapp_ai'), async (req, res, next) => {
  try {
    const input = composeSchema.parse(req.body);
    res.json(await aiService.composeMessage(org(req), input));
  } catch (err) { next(err); }
});

whatsappRouter.post('/ai/test', requireFeature('whatsapp_ai'), async (req, res, next) => {
  try {
    const input = aiTestSchema.parse(req.body);
    res.json(await aiService.testBot(org(req), input.account_id, input.messages));
  } catch (err) { next(err); }
});

whatsappRouter.post('/ai/teach', requireFeature('whatsapp_ai'), async (req, res, next) => {
  try {
    const input = teachSchema.parse(req.body);
    res.status(201).json(await aiService.teachFromMessage(org(req), input.message_id, input.question));
  } catch (err) { next(err); }
});

whatsappRouter.get('/ai/knowledge', async (req, res, next) => {
  try { res.json({ data: await aiService.listKnowledge(org(req)) }); } catch (err) { next(err); }
});

whatsappRouter.post('/ai/knowledge', async (req, res, next) => {
  try {
    const input = knowledgeSchema.parse(req.body);
    res.status(201).json(await aiService.createKnowledge(org(req), input));
  } catch (err) { next(err); }
});

whatsappRouter.patch('/ai/knowledge/:id', async (req, res, next) => {
  try {
    const input = knowledgeSchema.partial().parse(req.body);
    res.json(await aiService.updateKnowledge(org(req), String(req.params.id), input));
  } catch (err) { next(err); }
});

whatsappRouter.delete('/ai/knowledge/:id', async (req, res, next) => {
  try { await aiService.deleteKnowledge(org(req), String(req.params.id)); res.status(204).end(); } catch (err) { next(err); }
});
