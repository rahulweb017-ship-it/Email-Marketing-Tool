import { Router } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import {
  connectAccountSchema, createPostSchema, updatePostSchema,
  schedulePostSchema, calendarQuerySchema,
} from './social.schema.js';
import * as socialService from './social.service.js';
import { env } from '../../config/env.js';

export const socialRouter = Router();

// ─── OAuth callback (no JWT auth — uses state param) ───
socialRouter.get('/accounts/callback', async (req, res, next) => {
  try {
    const { state, code } = req.query as { state: string; code: string };
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

// ─── Post Routes ───

socialRouter.get('/posts', async (req, res, next) => {
  try {
    const pagination = parsePagination(req);
    const filters = {
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    };
    const { data, total } = await socialService.listPosts(req.user!.org_id!, pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
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
    const post = await socialService.createPost(req.user!.org_id!, req.user!.id, input);
    res.status(201).json(post);
  } catch (err) { next(err); }
});

socialRouter.get('/posts/:id', async (req, res, next) => {
  try {
    const post = await socialService.getPost(req.user!.org_id!, req.params.id);
    res.json(post);
  } catch (err) { next(err); }
});

socialRouter.patch('/posts/:id', async (req, res, next) => {
  try {
    const input = updatePostSchema.parse(req.body);
    const post = await socialService.updatePost(req.user!.org_id!, req.params.id, input);
    res.json(post);
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
    const post = await socialService.publishPost(req.user!.org_id!, req.params.id);
    res.json(post);
  } catch (err) { next(err); }
});

socialRouter.post('/posts/:id/schedule', async (req, res, next) => {
  try {
    const input = schedulePostSchema.parse(req.body);
    const post = await socialService.schedulePost(req.user!.org_id!, req.params.id, input.scheduled_at);
    res.json(post);
  } catch (err) { next(err); }
});

// ─── Metrics Routes ───

socialRouter.get('/posts/:id/metrics', async (req, res, next) => {
  try {
    const metrics = await socialService.getPostMetrics(req.user!.org_id!, req.params.id);
    res.json({ data: metrics });
  } catch (err) { next(err); }
});
