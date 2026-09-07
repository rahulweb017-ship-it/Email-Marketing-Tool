import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createAutomationCampaignSchema, updateAutomationCampaignSchema, createActivitySchema, updateActivitySchema } from './automation.schema.js';
import * as automationService from './automation.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';

export const automationRouter = Router();
automationRouter.use(authenticate, checkTenantStatus);

// ---- Dropdown data for activity config (must be before /:id) ----

automationRouter.get('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await automationService.listTags(req.user!.org_id);
    res.json(tags);
  } catch (err) { next(err); }
});

automationRouter.get('/lists', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lists = await automationService.listMailingLists(req.user!.org_id);
    res.json(lists);
  } catch (err) { next(err); }
});

// ---- Campaigns ----

automationRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await automationService.listAutomationCampaigns(req.user!.org_id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

automationRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await automationService.getAutomationCampaign(req.user!.org_id, req.params.id);
    res.json(campaign);
  } catch (err) { next(err); }
});

automationRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAutomationCampaignSchema.parse(req.body);
    const campaign = await automationService.createAutomationCampaign(req.user!.org_id, input);
    res.status(201).json(campaign);
  } catch (err) { next(err); }
});

automationRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateAutomationCampaignSchema.parse(req.body);
    const campaign = await automationService.updateAutomationCampaign(req.user!.org_id, req.params.id, input);
    res.json(campaign);
  } catch (err) { next(err); }
});

automationRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await automationService.deleteAutomationCampaign(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

automationRouter.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await automationService.startAutomationCampaign(req.user!.org_id, req.params.id);
    res.json(campaign);
  } catch (err) { next(err); }
});

automationRouter.post('/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await automationService.stopAutomationCampaign(req.user!.org_id, req.params.id);
    res.json(campaign);
  } catch (err) { next(err); }
});

automationRouter.get('/:id/participants', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const { data, total } = await automationService.listParticipants(req.user!.org_id, req.params.id, pagination);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) { next(err); }
});

// ---- Activities ----

automationRouter.post('/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createActivitySchema.parse(req.body);
    const activity = await automationService.createActivity(req.user!.org_id, input);
    res.status(201).json(activity);
  } catch (err) { next(err); }
});

automationRouter.patch('/activities/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateActivitySchema.parse(req.body);
    const activity = await automationService.updateActivity(req.user!.org_id, req.params.id, input);
    res.json(activity);
  } catch (err) { next(err); }
});

automationRouter.delete('/activities/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await automationService.deleteActivity(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});
