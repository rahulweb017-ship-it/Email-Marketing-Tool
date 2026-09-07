import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import * as notificationService from './notification.service.js';

export const notificationRouter = Router();
notificationRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/notifications */
notificationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await notificationService.listNotifications(req.user!.org_id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/notifications/unread-count */
notificationRouter.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.org_id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/notifications/:id/read */
notificationRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notification = await notificationService.markRead(req.user!.org_id, req.params.id);
    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/notifications/mark-all-read */
notificationRouter.post('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.markAllRead(req.user!.org_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
