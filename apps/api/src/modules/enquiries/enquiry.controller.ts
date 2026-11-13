import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, requireSuperAdmin } from '../auth/auth.middleware.js';
import { redis } from '../../config/redis.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import { createEnquirySchema, updateEnquirySchema } from './enquiry.schema.js';
import * as enquiryService from './enquiry.service.js';

const PER_IP_PER_HOUR = 20;
const PER_EMAIL_PER_HOUR = 3;

/**
 * The web app reaches the API through the Vite proxy (xfwd on), which appends the
 * caller's address last; earlier entries are client-supplied and can be forged.
 */
function clientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd) ? fwd.join(',') : fwd;
  const last = raw?.split(',').map((s) => s.trim()).filter(Boolean).pop();
  return (last || req.ip || null)?.slice(0, 64) ?? null;
}

async function hitLimit(key: string, max: number): Promise<boolean> {
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 3600);
    return n > max;
  } catch {
    // Redis being down should not stop real enquiries from being saved
    return false;
  }
}

// ── Public: POST /api/v1/public/enquiries ─────────────────────
export const publicEnquiryRouter = Router();

publicEnquiryRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createEnquirySchema.parse(req.body);

    // Bots fill the hidden field; pretend it worked so they do not retry
    if (input.fax_number) {
      res.status(201).json({ success: true });
      return;
    }

    const ip = clientIp(req);
    if (
      (ip && await hitLimit(`enquiry:ip:${ip}`, PER_IP_PER_HOUR)) ||
      await hitLimit(`enquiry:email:${input.email}`, PER_EMAIL_PER_HOUR)
    ) {
      throw new AppError(429, 'Too many enquiries. Please try again in an hour or email us directly.');
    }

    const row = await enquiryService.createEnquiry(input, {
      ip,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    });
    res.status(201).json({ success: true, id: row.id });
  } catch (err) {
    next(err);
  }
});

// ── Super admin: /api/v1/super-admin/enquiries ────────────────
export const enquiryAdminRouter = Router();
enquiryAdminRouter.use(authenticate, requireSuperAdmin);

enquiryAdminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await enquiryService.listEnquiries(
      {
        status: (req.query.status as string) || undefined,
        type: (req.query.type as string) || undefined,
        search: (req.query.search as string) || undefined,
      },
      pagination,
    );
    const counts = await enquiryService.getEnquiryCounts();
    res.json({ ...paginatedResponse(data, total, pagination), counts });
  } catch (err) {
    next(err);
  }
});

enquiryAdminRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateEnquirySchema.parse(req.body);
    const row = await enquiryService.updateEnquiry(req.params.id as string, input);
    res.json(row);
  } catch (err) {
    next(err);
  }
});

enquiryAdminRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await enquiryService.deleteEnquiry(req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
