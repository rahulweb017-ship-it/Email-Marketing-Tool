import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createWebhookSchema, updateWebhookSchema } from './outgoing-webhook.schema.js';
import * as webhookService from './outgoing-webhook.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const outgoingWebhookRouter = Router();
outgoingWebhookRouter.use(authenticate, checkTenantStatus);

/** POST /api/v1/outgoing-webhooks — create a webhook */
outgoingWebhookRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWebhookSchema.parse(req.body);
    const result = await webhookService.createWebhook(req.user!.org_id, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/outgoing-webhooks — list webhooks */
outgoingWebhookRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhooks = await webhookService.listWebhooks(req.user!.org_id);
    res.json({ data: webhooks });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/outgoing-webhooks/:id — get webhook detail */
outgoingWebhookRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhook = await webhookService.getWebhook(req.user!.org_id, req.params.id);
    res.json(webhook);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/outgoing-webhooks/:id — update webhook */
outgoingWebhookRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateWebhookSchema.parse(req.body);
    const result = await webhookService.updateWebhook(req.user!.org_id, req.params.id, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/outgoing-webhooks/:id — delete webhook */
outgoingWebhookRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await webhookService.deleteWebhook(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/outgoing-webhooks/:id/test — send test webhook */
outgoingWebhookRouter.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await webhookService.testWebhook(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/outgoing-webhooks/:id/logs — paginated delivery logs */
outgoingWebhookRouter.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await webhookService.listWebhookLogs(req.user!.org_id, req.params.id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});
