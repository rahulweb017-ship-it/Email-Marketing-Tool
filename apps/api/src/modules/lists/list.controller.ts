import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createListSchema, updateListSchema, addSubscribersSchema } from './list.schema.js';
import * as listService from './list.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const listRouter = Router();
listRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/lists */
listRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await listService.listMailingLists(req.user!.org_id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/lists/:id */
listRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await listService.getMailingList(req.user!.org_id, req.params.id);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/lists */
listRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createListSchema.parse(req.body);
    const list = await listService.createMailingList(req.user!.org_id, input);
    res.status(201).json(list);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/lists/:id */
listRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateListSchema.parse(req.body);
    const list = await listService.updateMailingList(req.user!.org_id, req.params.id, input);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/lists/:id */
listRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listService.deleteMailingList(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/lists/:id/subscribers */
listRouter.get('/:id/subscribers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const filters = {
      opt_out: req.query.opt_out === 'true' ? true : req.query.opt_out === 'false' ? false : undefined,
    };
    const { data, total } = await listService.getSubscribers(req.user!.org_id, req.params.id, pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/lists/:id/subscribers */
listRouter.post('/:id/subscribers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contact_ids } = addSubscribersSchema.parse(req.body);
    const result = await listService.addSubscribers(req.user!.org_id, req.params.id, contact_ids);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/lists/:id/subscribers/:contactId */
listRouter.delete('/:id/subscribers/:contactId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await listService.removeSubscriber(req.user!.org_id, req.params.id, req.params.contactId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/lists/unsubscribe-reasons */
listRouter.get('/unsubscribe-reasons/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reasons = await listService.listUnsubscribeReasons(req.user!.org_id);
    res.json({ data: reasons });
  } catch (err) {
    next(err);
  }
});
