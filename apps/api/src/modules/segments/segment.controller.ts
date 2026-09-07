import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createSegmentSchema, updateSegmentSchema } from './segment.schema.js';
import * as segmentService from './segment.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const segmentRouter = Router();
segmentRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/segments */
segmentRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await segmentService.listSegments(req.user!.org_id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/segments/:id */
segmentRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const segment = await segmentService.getSegment(req.user!.org_id, req.params.id);
    res.json(segment);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/segments */
segmentRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createSegmentSchema.parse(req.body);
    const segment = await segmentService.createSegment(req.user!.org_id, input);
    res.status(201).json(segment);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/segments/:id */
segmentRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateSegmentSchema.parse(req.body);
    const segment = await segmentService.updateSegment(req.user!.org_id, req.params.id, input);
    res.json(segment);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/segments/:id */
segmentRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await segmentService.deleteSegment(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/segments/:id/compute */
segmentRouter.post('/:id/compute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await segmentService.computeSegment(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/segments/:id/contacts */
segmentRouter.get('/:id/contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await segmentService.getSegmentContacts(req.user!.org_id, req.params.id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});
