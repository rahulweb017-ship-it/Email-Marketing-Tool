import { Router } from 'express';
import { authenticate, checkTenantStatus, requireRole } from '../auth/auth.middleware.js';
import { getAiCreditUsage } from './ai.client.js';
import { brandProfileSchema, rewriteSchema, socialWriteSchema, subjectLinesSchema, writeEmailSchema } from './ai.schema.js';
import * as aiService from './ai.service.js';
import * as brand from './brand.service.js';

export const aiRouter = Router();
aiRouter.use(authenticate, checkTenantStatus);

const org = (req: any) => req.user!.org_id as string;

aiRouter.get('/usage', async (req, res, next) => {
  try { res.json(await getAiCreditUsage(org(req))); } catch (err) { next(err); }
});

aiRouter.get('/brand', async (req, res, next) => {
  try { res.json(await brand.getBrandProfile(org(req))); } catch (err) { next(err); }
});

aiRouter.put('/brand', requireRole('admin'), async (req, res, next) => {
  try { res.json(await brand.saveBrandProfile(org(req), req.user!.id, brandProfileSchema.parse(req.body))); } catch (err) { next(err); }
});

aiRouter.post('/email/write', async (req, res, next) => {
  try { res.json(await aiService.writeEmail(org(req), req.user!.id, writeEmailSchema.parse(req.body))); } catch (err) { next(err); }
});

aiRouter.post('/email/rewrite', async (req, res, next) => {
  try { res.json(await aiService.rewriteText(org(req), req.user!.id, rewriteSchema.parse(req.body))); } catch (err) { next(err); }
});

aiRouter.post('/subject-lines', async (req, res, next) => {
  try { res.json(await aiService.subjectLines(org(req), req.user!.id, subjectLinesSchema.parse(req.body))); } catch (err) { next(err); }
});

aiRouter.post('/social/write', async (req, res, next) => {
  try { res.json(await aiService.writeSocial(org(req), req.user!.id, socialWriteSchema.parse(req.body))); } catch (err) { next(err); }
});
