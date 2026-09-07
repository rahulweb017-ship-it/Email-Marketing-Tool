import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema, refreshSchema, inviteUserSchema, updateProfileSchema } from './auth.schema.js';
import * as authService from './auth.service.js';
import { authenticate, requireRole } from './auth.middleware.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export const authRouter = Router();

/** POST /api/v1/auth/register - Register new organization + admin user */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  } catch (err) {
    next(err instanceof AppError ? err : err);
  }
});

/** POST /api/v1/auth/login */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/refresh */
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = refreshSchema.parse(req.body);
    const tokens = await authService.refreshToken(refresh_token);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/logout */
authRouter.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user!.id);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/auth/me */
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/auth/me */
authRouter.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const profile = await authService.updateProfile(req.user!.id, input);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/auth/users - List org users (admin/manager only) */
authRouter.get('/users', authenticate, requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await authService.listOrgUsers(req.user!.org_id);
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/auth/users/invite - Invite new user (admin only) */
authRouter.post('/users/invite', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = inviteUserSchema.parse(req.body);
    const result = await authService.inviteUser(req.user!.org_id, input);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
