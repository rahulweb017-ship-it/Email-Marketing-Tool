import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import * as consentService from './consent.service.js';

export const consentRouter = Router();
consentRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/consent/contacts/:contactId/consent */
consentRouter.get('/contacts/:contactId/consent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await consentService.getContactConsent(req.user!.org_id!, req.params.contactId);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/consent/bulk — { consent_type, contact_ids? | list_id?, source? } */
consentRouter.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consent_type, contact_ids, list_id, source } = req.body || {};
    if (!consent_type || typeof consent_type !== 'string') {
      return res.status(400).json({ error: 'consent_type is required' });
    }
    const result = await consentService.bulkGrantConsentForOrg(req.user!.org_id!, {
      consent_type,
      contact_ids: Array.isArray(contact_ids) ? contact_ids.map(String) : undefined,
      list_id: typeof list_id === 'string' ? list_id : undefined,
      source: typeof source === 'string' ? source : 'manual',
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/consent/contacts/:contactId/consent */
consentRouter.post('/contacts/:contactId/consent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consent_type, source } = req.body;
    if (!consent_type || !source) {
      return res.status(400).json({ error: 'consent_type and source are required' });
    }
    const record = await consentService.grantConsent(
      req.user!.org_id!,
      req.params.contactId,
      consent_type,
      source,
      req.ip || undefined,
    );
    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/consent/contacts/:contactId/consent/:type */
consentRouter.delete('/contacts/:contactId/consent/:type', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await consentService.revokeConsent(
      req.user!.org_id!,
      req.params.contactId,
      req.params.type,
    );
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/consent/export */
consentRouter.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await consentService.exportConsentRecords(req.user!.org_id!);
    res.json(records);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/consent/overview */
consentRouter.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overview = await consentService.getConsentOverview(req.user!.org_id!);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/consent/recent-changes */
consentRouter.get('/recent-changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const changes = await consentService.getRecentConsentChanges(req.user!.org_id!);
    res.json(changes);
  } catch (err) {
    next(err);
  }
});
