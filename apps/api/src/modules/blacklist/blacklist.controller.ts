import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { addBlacklistSchema, bulkBlacklistSchema } from './blacklist.schema.js';
import * as blacklistService from './blacklist.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const blacklistRouter = Router();
blacklistRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/blacklist */
blacklistRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const search = req.query.search as string | undefined;
    const { data, total } = await blacklistService.listBlacklist(req.user!.org_id, pagination, search);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/blacklist */
blacklistRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = addBlacklistSchema.parse(req.body);
    const entry = await blacklistService.addToBlacklist(req.user!.org_id, req.user!.id, input);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/blacklist/:id */
blacklistRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await blacklistService.removeFromBlacklist(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/blacklist/bulk */
blacklistRouter.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { emails, reason } = bulkBlacklistSchema.parse(req.body);
    const result = await blacklistService.bulkBlacklist(req.user!.org_id, req.user!.id, emails, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/blacklist/check/:email */
blacklistRouter.get('/check/:email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const is_blacklisted = await blacklistService.isBlacklisted(req.user!.org_id, req.params.email);
    res.json({ email: req.params.email, is_blacklisted });
  } catch (err) {
    next(err);
  }
});
