import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import * as mediaService from './media.service.js';

export const mediaRouter = Router();
mediaRouter.use(authenticate, checkTenantStatus);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MEDIA_MAX_MB * 1024 * 1024, files: 1 },
});

function singleFile(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(413, `File is too large. The limit is ${env.MEDIA_MAX_MB} MB.`));
    }
    next(err);
  });
}

/** GET /api/v1/media */
mediaRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await mediaService.listMedia(req.user!.org_id!, pagination, {
      kind: req.query.kind as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/media (multipart/form-data, field "file") */
mediaRouter.post('/', singleFile, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, 'Choose a file to upload');
    const asset = await mediaService.uploadMedia(req.user!.org_id!, req.user!.id, req.file);
    res.status(201).json(asset);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/media/:id */
mediaRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await mediaService.deleteMedia(req.user!.org_id!, String(req.params.id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
