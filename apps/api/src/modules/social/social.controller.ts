import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import {
  connectAccountSchema, createPostSchema, updatePostSchema,
  schedulePostSchema, calendarQuerySchema, listPostsQuerySchema, countsQuerySchema,
  rejectPostSchema, slotsQuerySchema, putSlotsSchema, queueSettingsSchema, nextSlotQuerySchema,
  tagSchema, templateSchema, createIdeaSchema, updateIdeaSchema, moveIdeaSchema,
} from './social.schema.js';
import * as socialService from './social.service.js';
import * as contentService from './social-content.service.js';
import { listPlatforms } from './providers/index.js';
import { env } from '../../config/env.js';

export const socialRouter = Router();

// ─── OAuth callback (no JWT auth — uses state param) ───
socialRouter.get('/accounts/callback', async (req, res, next) => {
  try {
    // LinkedIn/X send error + error_description; Facebook sends error_code + error_message
    const { state, code, error, error_description, error_code, error_message } = req.query as {
      state: string; code: string; error?: string; error_description?: string;
      error_code?: string; error_message?: string;
    };
    if (error || error_code) {
      const message = error_description || error_message || error || `Error ${error_code}`;
      const params = new URLSearchParams({ error: 'oauth_failed', message });
      return res.redirect(`${env.FRONTEND_URL}/social/accounts?${params.toString()}`);
    }
    if (!state || !code) {
      return res.redirect(`${env.FRONTEND_URL}/social/accounts?error=missing_params`);
    }

    const result = await socialService.handleOAuthCallback(state, code);
    const params = new URLSearchParams({
      connected: 'true',
      platform: result.platform,
      reconnected: result.reconnected ? 'true' : 'false',
    });
    res.redirect(`${env.FRONTEND_URL}/social/accounts?${params.toString()}`);
  } catch (err: any) {
    console.error('OAuth callback error:', err.message);
    const params = new URLSearchParams({
      error: 'oauth_failed',
      message: err.message || 'Connection failed',
    });
    res.redirect(`${env.FRONTEND_URL}/social/accounts?${params.toString()}`);
  }
});

// All routes below require auth
socialRouter.use(authenticate, checkTenantStatus);

// ─── Account Routes ───

socialRouter.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await socialService.listAccounts(req.user!.org_id!);
    res.json({ data: accounts });
  } catch (err) { next(err); }
});

socialRouter.post('/accounts/connect', async (req, res, next) => {
  try {
    const input = connectAccountSchema.parse(req.body);
    const result = await socialService.initiateOAuth(req.user!.org_id!, req.user!.id, input.platform);
    res.json(result);
  } catch (err) { next(err); }
});

socialRouter.delete('/accounts/:id', async (req, res, next) => {
  try {
    await socialService.disconnectAccount(req.user!.org_id!, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

socialRouter.post('/accounts/:id/verify', async (req, res, next) => {
  try {
    const result = await socialService.verifyAccount(req.user!.org_id!, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

socialRouter.get('/platforms', (_req, res) => {
  res.json({ data: listPlatforms() });
});

// ─── Post Routes ───

const actorOf = (req: Request): socialService.SocialActor => ({
  id: req.user!.id, role: req.user!.role, is_super_admin: req.user!.is_super_admin,
});

socialRouter.get('/posts', async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    const filters = listPostsQuerySchema.parse(req.query);
    const { data, total } = await socialService.listPosts(req.user!.org_id!, pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

socialRouter.get('/posts/counts', async (req, res, next) => {
  try {
    const filters = countsQuerySchema.parse(req.query);
    res.json(await socialService.getPostCounts(req.user!.org_id!, filters));
  } catch (err) { next(err); }
});

socialRouter.get('/posts/calendar', async (req, res, next) => {
  try {
    const query = calendarQuerySchema.parse(req.query);
    const posts = await socialService.getCalendarPosts(req.user!.org_id!, query.start, query.end);
    res.json({ data: posts });
  } catch (err) { next(err); }
});

socialRouter.post('/posts', async (req, res, next) => {
  try {
    const input = createPostSchema.parse(req.body);
    const post = await socialService.createPost(req.user!.org_id!, actorOf(req), input);
    res.status(201).json(post);
  } catch (err) { next(err); }
});

socialRouter.get('/posts/:id', async (req, res, next) => {
  try {
    res.json(await socialService.getPost(req.user!.org_id!, req.params.id));
  } catch (err) { next(err); }
});

socialRouter.patch('/posts/:id', async (req, res, next) => {
  try {
    const input = updatePostSchema.parse(req.body);
    res.json(await socialService.updatePost(req.user!.org_id!, actorOf(req), req.params.id, input));
  } catch (err) { next(err); }
});

socialRouter.delete('/posts/:id', async (req, res, next) => {
  try {
    await socialService.deletePost(req.user!.org_id!, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/publish', async (req, res, next) => {
  try {
    res.json(await socialService.publishPost(req.user!.org_id!, actorOf(req), req.params.id));
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/schedule', async (req, res, next) => {
  try {
    const input = schedulePostSchema.parse(req.body);
    res.json(await socialService.schedulePost(req.user!.org_id!, actorOf(req), req.params.id, input.scheduled_at));
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/approve', async (req, res, next) => {
  try {
    res.json(await socialService.approvePost(req.user!.org_id!, actorOf(req), req.params.id));
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/reject', async (req, res, next) => {
  try {
    const input = rejectPostSchema.parse(req.body || {});
    res.json(await socialService.rejectPost(req.user!.org_id!, actorOf(req), req.params.id, input.note));
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/retry', async (req, res, next) => {
  try {
    res.json(await socialService.retryPost(req.user!.org_id!, req.params.id));
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/duplicate', async (req, res, next) => {
  try {
    res.status(201).json(await socialService.duplicatePost(req.user!.org_id!, actorOf(req), req.params.id));
  } catch (err) { next(err); }
});

// ─── Metrics Routes ───

socialRouter.get('/posts/:id/metrics', async (req, res, next) => {
  try {
    const metrics = await socialService.getPostMetrics(req.user!.org_id!, req.params.id);
    res.json({ data: metrics });
  } catch (err) { next(err); }
});

// ─── Queue ───

socialRouter.get('/queue/slots', async (req, res, next) => {
  try {
    const q = slotsQuerySchema.parse(req.query);
    res.json(await contentService.getQueueSlots(req.user!.org_id!, q.account_id));
  } catch (err) { next(err); }
});

socialRouter.put('/queue/slots', async (req, res, next) => {
  try {
    const input = putSlotsSchema.parse(req.body);
    res.json(await contentService.replaceQueueSlots(req.user!.org_id!, input.account_id, input.slots));
  } catch (err) { next(err); }
});

socialRouter.get('/queue/settings', async (req, res, next) => {
  try {
    res.json({ timezone: await socialService.getQueueTimezone(req.user!.org_id!) });
  } catch (err) { next(err); }
});

socialRouter.put('/queue/settings', async (req, res, next) => {
  try {
    const input = queueSettingsSchema.parse(req.body);
    res.json(await contentService.setQueueTimezone(req.user!.org_id!, input.timezone));
  } catch (err) { next(err); }
});

socialRouter.get('/queue/next', async (req, res, next) => {
  try {
    const q = nextSlotQuerySchema.parse(req.query);
    const ids = z.array(z.string().uuid()).min(1).parse(q.account_ids.split(',').filter(Boolean));
    res.json(await contentService.previewNextSlot(req.user!.org_id!, ids, q.mode));
  } catch (err) { next(err); }
});

// ─── Tags ───

socialRouter.get('/tags', async (req, res, next) => {
  try { res.json({ data: await contentService.listTags(req.user!.org_id!) }); } catch (err) { next(err); }
});
socialRouter.post('/tags', async (req, res, next) => {
  try { res.status(201).json(await contentService.createTag(req.user!.org_id!, tagSchema.parse(req.body))); } catch (err) { next(err); }
});
socialRouter.patch('/tags/:id', async (req, res, next) => {
  try { res.json(await contentService.updateTag(req.user!.org_id!, req.params.id, tagSchema.parse(req.body))); } catch (err) { next(err); }
});
socialRouter.delete('/tags/:id', async (req, res, next) => {
  try { await contentService.deleteTag(req.user!.org_id!, req.params.id); res.status(204).end(); } catch (err) { next(err); }
});

// ─── Templates ───

socialRouter.get('/templates', async (req, res, next) => {
  try { res.json({ data: await contentService.listTemplates(req.user!.org_id!) }); } catch (err) { next(err); }
});
socialRouter.post('/templates', async (req, res, next) => {
  try { res.status(201).json(await contentService.createTemplate(req.user!.org_id!, req.user!.id, templateSchema.parse(req.body))); } catch (err) { next(err); }
});
socialRouter.patch('/templates/:id', async (req, res, next) => {
  try { res.json(await contentService.updateTemplate(req.user!.org_id!, req.params.id, templateSchema.parse(req.body))); } catch (err) { next(err); }
});
socialRouter.delete('/templates/:id', async (req, res, next) => {
  try { await contentService.deleteTemplate(req.user!.org_id!, req.params.id); res.status(204).end(); } catch (err) { next(err); }
});

// ─── Ideas ───

socialRouter.get('/ideas', async (req, res, next) => {
  try { res.json({ data: await contentService.listIdeas(req.user!.org_id!) }); } catch (err) { next(err); }
});
socialRouter.post('/ideas', async (req, res, next) => {
  try { res.status(201).json(await contentService.createIdea(req.user!.org_id!, req.user!.id, createIdeaSchema.parse(req.body))); } catch (err) { next(err); }
});
socialRouter.patch('/ideas/:id', async (req, res, next) => {
  try { res.json(await contentService.updateIdea(req.user!.org_id!, req.params.id, updateIdeaSchema.parse(req.body))); } catch (err) { next(err); }
});
socialRouter.post('/ideas/:id/move', async (req, res, next) => {
  try {
    const input = moveIdeaSchema.parse(req.body);
    res.json(await contentService.moveIdea(req.user!.org_id!, req.params.id, input.stage, input.position));
  } catch (err) { next(err); }
});
socialRouter.post('/ideas/:id/convert', async (req, res, next) => {
  try { res.status(201).json(await contentService.convertIdea(req.user!.org_id!, actorOf(req), req.params.id)); } catch (err) { next(err); }
});
socialRouter.delete('/ideas/:id', async (req, res, next) => {
  try { await contentService.deleteIdea(req.user!.org_id!, req.params.id); res.status(204).end(); } catch (err) { next(err); }
});
