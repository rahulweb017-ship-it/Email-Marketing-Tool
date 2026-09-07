import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { validateApiKey } from '../api-keys/api-key.service.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import {
  createTransactionalTemplateSchema,
  updateTransactionalTemplateSchema,
  sendTransactionalSchema,
  sendBatchTransactionalSchema,
} from './transactional.schema.js';
import * as service from './transactional.service.js';

export const transactionalRouter = Router();

// ── API key auth middleware ────────────────────────────────

async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer sk-')) {
    return next(new AppError(401, 'Invalid API key'));
  }
  const key = header.substring(7);
  const record = await validateApiKey(key);
  if (!record) {
    return next(new AppError(401, 'Invalid or expired API key'));
  }
  req.user = {
    id: record.id,
    org_id: record.org_id,
    role: 'api_key',
    is_super_admin: false,
  };
  next();
}

// Combined middleware: JWT or API key
function authenticateJwtOrApiKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer sk-')) {
    return authenticateApiKey(req, res, next);
  }
  return authenticate(req, res, next);
}

// ── Template routes (JWT only) ─────────────────────────────

transactionalRouter.get('/templates', authenticate, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await service.listTemplates(req.user!.org_id!);
    res.json({ data: templates });
  } catch (err) { next(err); }
});

transactionalRouter.post('/templates', authenticate, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTransactionalTemplateSchema.parse(req.body);
    const template = await service.createTemplate(req.user!.org_id!, input);
    res.status(201).json(template);
  } catch (err) { next(err); }
});

transactionalRouter.patch('/templates/:id', authenticate, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateTransactionalTemplateSchema.parse(req.body);
    const template = await service.updateTemplate(req.user!.org_id!, req.params.id, input);
    res.json(template);
  } catch (err) { next(err); }
});

transactionalRouter.delete('/templates/:id', authenticate, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteTemplate(req.user!.org_id!, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── Sending routes (JWT or API key) ────────────────────────

transactionalRouter.post('/send', authenticateJwtOrApiKey, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = sendTransactionalSchema.parse(req.body);
    const result = await service.sendTransactionalEmail(req.user!.org_id!, input);
    res.json(result);
  } catch (err) { next(err); }
});

transactionalRouter.post('/send-batch', authenticateJwtOrApiKey, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = sendBatchTransactionalSchema.parse(req.body);
    const results = await service.sendBatchTransactional(req.user!.org_id!, input.messages);
    res.json({ data: results });
  } catch (err) { next(err); }
});

// ── Message log (JWT only) ─────────────────────────────────

transactionalRouter.get('/messages', authenticate, checkTenantStatus, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listMessages(req.user!.org_id!, {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      per_page: req.query.per_page ? parseInt(req.query.per_page as string, 10) : undefined,
      status: req.query.status as string | undefined,
    });
    res.json(result);
  } catch (err) { next(err); }
});
