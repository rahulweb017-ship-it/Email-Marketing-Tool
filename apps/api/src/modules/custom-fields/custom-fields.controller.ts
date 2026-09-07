import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createCustomFieldSchema, updateCustomFieldSchema } from './custom-fields.schema.js';
import * as customFieldsService from './custom-fields.service.js';

export const customFieldRouter = Router();
customFieldRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/custom-fields */
customFieldRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = await customFieldsService.listCustomFields(req.user!.org_id!);
    res.json({ data: fields });
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/custom-fields */
customFieldRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCustomFieldSchema.parse(req.body);
    const field = await customFieldsService.createCustomField(req.user!.org_id!, input);
    res.status(201).json(field);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/custom-fields/:id */
customFieldRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateCustomFieldSchema.parse(req.body);
    const field = await customFieldsService.updateCustomField(req.user!.org_id!, req.params.id, input);
    res.json(field);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/custom-fields/:id */
customFieldRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await customFieldsService.deleteCustomField(req.user!.org_id!, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
