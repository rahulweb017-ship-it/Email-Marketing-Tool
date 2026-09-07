import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createTemplateSchema, updateTemplateSchema } from './template.schema.js';
import * as templateService from './template.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const templateRouter = Router();
templateRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/templates */
templateRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      is_favorite: req.query.is_favorite === 'true' ? true : undefined,
      category: req.query.category as string | undefined,
    };
    const { data, total } = await templateService.listTemplates(req.user!.org_id, pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/templates/:id */
templateRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateService.getTemplate(req.user!.org_id, req.params.id);
    res.json(template);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/templates */
templateRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTemplateSchema.parse(req.body);
    const template = await templateService.createTemplate(req.user!.org_id, input);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/templates/:id */
templateRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateTemplateSchema.parse(req.body);
    const template = await templateService.updateTemplate(req.user!.org_id, req.params.id, input);
    res.json(template);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/templates/:id */
templateRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await templateService.deleteTemplate(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/templates/:id/duplicate */
templateRouter.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateService.duplicateTemplate(req.user!.org_id, req.params.id);
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

// ---- Template Version History ----

/** GET /api/v1/templates/:id/versions */
templateRouter.get('/:id/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await templateService.listVersions(req.user!.org_id, req.params.id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/templates/:id/versions/:versionId */
templateRouter.get('/:id/versions/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await templateService.getVersion(req.user!.org_id, req.params.id, req.params.versionId);
    res.json(version);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/templates/:id/versions/:versionId/restore */
templateRouter.post('/:id/versions/:versionId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templateService.restoreVersion(req.user!.org_id, req.params.id, req.params.versionId);
    res.json(template);
  } catch (err) {
    next(err);
  }
});
