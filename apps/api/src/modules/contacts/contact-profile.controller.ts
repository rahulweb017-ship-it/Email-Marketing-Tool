import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import * as contactProfileService from './contact-profile.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const contactProfileRouter = Router();
contactProfileRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/contacts/:id/activity */
contactProfileRouter.get('/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await contactProfileService.getContactActivity(req.user!.org_id, req.params.id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/contacts/:id/campaigns */
contactProfileRouter.get('/:id/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await contactProfileService.getContactCampaigns(req.user!.org_id, req.params.id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/contacts/:id/stats */
contactProfileRouter.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await contactProfileService.getContactStats(req.user!.org_id, req.params.id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
