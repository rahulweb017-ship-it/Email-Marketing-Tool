import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';
import { validateApiKey } from '../../modules/api-keys/api-key.service.js';

/**
 * Alternative authentication via X-API-Key header.
 * If an X-API-Key header is present, hash the provided key, look up
 * in api_keys table, and if valid, set req.user with org_id from the api_key record.
 * Falls through to the next middleware if no X-API-Key header is present.
 */
export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // If no API key header, skip and let next auth middleware handle it
  if (!apiKey) {
    return next();
  }

  try {
    const keyRecord = await validateApiKey(apiKey);
    if (!keyRecord) {
      return next(new AppError(401, 'Invalid or expired API key'));
    }

    // Set the req.user from the API key record
    req.user = {
      id: `apikey:${keyRecord.id}`,
      org_id: keyRecord.org_id,
      role: 'api_key',
    };

    next();
  } catch (err) {
    next(new AppError(401, 'API key authentication failed'));
  }
}

/**
 * Middleware to require specific scopes from the API key.
 * Must be used after authenticateApiKey middleware.
 */
export function requireScope(...requiredScopes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Only check scopes for API key auth (role === 'api_key')
    if (req.user?.role !== 'api_key') {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) {
      return next(new AppError(401, 'API key required'));
    }

    const keyRecord = await validateApiKey(apiKey);
    if (!keyRecord) {
      return next(new AppError(401, 'Invalid API key'));
    }

    const hasScope = requiredScopes.some((scope) => keyRecord.scopes.includes(scope));
    if (!hasScope) {
      return next(new AppError(403, `Insufficient scope. Required: ${requiredScopes.join(' or ')}`));
    }

    next();
  };
}
