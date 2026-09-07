import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createFormSchema, updateFormSchema, submitFormSchema } from './forms.schema.js';
import * as formsService from './forms.service.js';
import { env } from '../../config/env.js';

// ── Authenticated routes ──────────────────────────────────────
export const formRouter = Router();

formRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/forms */
formRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forms = await formsService.listForms(req.user!.org_id!);
    res.json({ data: forms });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/forms/:id */
formRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await formsService.getForm(req.user!.org_id!, req.params.id as string);
    res.json(form);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/forms */
formRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createFormSchema.parse(req.body);
    const form = await formsService.createForm(req.user!.org_id!, input);
    res.status(201).json(form);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/forms/:id */
formRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateFormSchema.parse(req.body);
    const form = await formsService.updateForm(req.user!.org_id!, req.params.id as string, input);
    res.json(form);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/forms/:id */
formRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await formsService.deleteForm(req.user!.org_id!, req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/forms/:id/embed */
formRouter.get('/:id/embed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await formsService.getForm(req.user!.org_id!, req.params.id as string);
    const html = formsService.generateEmbedHtml(form, env.APP_URL);
    res.json({ html });
  } catch (err) {
    next(err);
  }
});

// ── Public routes ─────────────────────────────────────────────
export const publicFormRouter = Router();

/** GET /api/v1/public/forms/:id */
publicFormRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await formsService.getPublicForm(req.params.id as string);
    res.json(form);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/public/forms/:id/submit */
publicFormRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = submitFormSchema.parse(req.body);
    const result = await formsService.submitForm(req.params.id as string, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
