import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createApiKeySchema } from './api-key.schema.js';
import * as apiKeyService from './api-key.service.js';

export const apiKeyRouter = Router();
apiKeyRouter.use(authenticate, checkTenantStatus);

/** POST /api/v1/api-keys — create a new API key */
apiKeyRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createApiKeySchema.parse(req.body);
    const result = await apiKeyService.createApiKey(req.user!.org_id, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/api-keys — list API keys */
apiKeyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = await apiKeyService.listApiKeys(req.user!.org_id);
    res.json({ data: keys });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/api-keys/:id — revoke API key */
apiKeyRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await apiKeyService.revokeApiKey(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
