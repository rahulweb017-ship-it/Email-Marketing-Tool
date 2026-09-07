import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export interface AuthUser {
  id: string;
  org_id: string | null;
  role: string;
  is_super_admin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'Missing or invalid authorization header'));
  }

  const token = header.substring(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      org_id: string | null;
      role: string;
      is_super_admin?: boolean;
    };
    req.user = {
      id: decoded.sub,
      org_id: decoded.org_id,
      role: decoded.role,
      is_super_admin: decoded.is_super_admin || false,
    };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.is_super_admin) {
    return next(new AppError(403, 'Super admin access required'));
  }
  next();
}

export async function checkTenantStatus(req: Request, _res: Response, next: NextFunction) {
  // Super admins without org_id skip tenant check
  if (req.user?.is_super_admin && !req.user.org_id) {
    return next();
  }

  const orgId = req.user?.org_id;
  if (!orgId) {
    return next(new AppError(403, 'No organization associated with this account'));
  }

  try {
    // Check Redis cache first (60s TTL)
    const cacheKey = `org:status:${orgId}`;
    let status = await redis.get(cacheKey);

    if (!status) {
      const org = await db('organizations').where('id', orgId).select('status').first();
      if (!org) {
        return next(new AppError(404, 'Organization not found'));
      }
      status = org.status;
      await redis.set(cacheKey, status, 'EX', 60);
    }

    if (status !== 'active') {
      return next(new AppError(403, 'Your organization has been suspended. Contact support.'));
    }

    next();
  } catch (err) {
    // If Redis/DB fails, allow through (don't block legitimate users on infra failure)
    next();
  }
}
