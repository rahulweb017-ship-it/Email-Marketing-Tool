import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { z } from 'zod';
import * as searchService from './search.service.js';

export const searchRouter = Router();
searchRouter.use(authenticate, checkTenantStatus);

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

/** GET /api/v1/search?q=query */
searchRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = searchQuerySchema.parse(req.query);
    const results = await searchService.globalSearch(req.user!.org_id, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});
