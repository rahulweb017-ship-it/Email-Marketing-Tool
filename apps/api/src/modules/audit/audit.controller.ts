import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import * as auditService from './audit.service.js';

export const auditRouter = Router();
auditRouter.use(authenticate, checkTenantStatus);

// GET /api/v1/audit-logs — paginated list with optional filters
auditRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const page = parseInt(req.query.page as string) || 1;
    const per_page = Math.min(parseInt(req.query.per_page as string) || 20, 100);

    const result = await auditService.listAuditLogs(orgId, {
      entity_type: req.query.entity_type as string | undefined,
      user_id: req.query.user_id as string | undefined,
      action: req.query.action as string | undefined,
      date_from: req.query.date_from as string | undefined,
      date_to: req.query.date_to as string | undefined,
      page,
      per_page,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
