import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createAbTestSchema, updateAbTestSchema } from './ab-testing.schema.js';
import * as abTestingService from './ab-testing.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const abTestingRouter = Router();
abTestingRouter.use(authenticate, checkTenantStatus);

/** POST /api/v1/ab-tests — create a new A/B test */
abTestingRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAbTestSchema.parse(req.body);
    const result = await abTestingService.createAbTest(req.user!.org_id, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/ab-tests — list A/B tests */
abTestingRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await abTestingService.listAbTests(req.user!.org_id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/ab-tests/:id — get A/B test detail */
abTestingRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await abTestingService.getAbTest(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/ab-tests/:id — update A/B test settings */
abTestingRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateAbTestSchema.parse(req.body);
    const result = await abTestingService.updateAbTest(req.user!.org_id, req.params.id, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/ab-tests/:id/send — launch A/B test */
abTestingRouter.post('/:id/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await abTestingService.sendAbTest(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/ab-tests/:id/pick-winner — manually pick winner */
abTestingRouter.post('/:id/pick-winner', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await abTestingService.pickWinner(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/ab-tests/:id/send-winner — send winner to remaining recipients */
abTestingRouter.post('/:id/send-winner', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await abTestingService.sendWinner(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/ab-tests/:id — delete A/B test */
abTestingRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await abTestingService.deleteAbTest(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
