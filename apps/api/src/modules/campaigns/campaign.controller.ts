import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createCampaignSchema, updateCampaignSchema, sendTestSchema } from './campaign.schema.js';
import * as campaignService from './campaign.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import { generateCsv } from '../../shared/utils/csv-generator.js';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export const campaignRouter = Router();
campaignRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/campaigns */
campaignRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const filters = {
      state: req.query.state as string | undefined,
      search: req.query.search as string | undefined,
    };
    const { data, total } = await campaignService.listCampaigns(req.user!.org_id, pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/campaigns/:id */
campaignRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await campaignService.getCampaign(req.user!.org_id, req.params.id);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns */
campaignRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCampaignSchema.parse(req.body);
    const campaign = await campaignService.createCampaign(req.user!.org_id, input);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/campaigns/:id */
campaignRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateCampaignSchema.parse(req.body);
    const campaign = await campaignService.updateCampaign(req.user!.org_id, req.params.id, input);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/campaigns/:id */
campaignRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await campaignService.deleteCampaign(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns/:id/duplicate */
campaignRouter.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await campaignService.duplicateCampaign(req.user!.org_id, req.params.id);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns/:id/test - Send test email(s) */
campaignRouter.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = sendTestSchema.parse(req.body);
    const results = await campaignService.sendTestEmail(req.user!.org_id, req.params.id, input.emails);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns/:id/schedule - Transition draft -> in_queue or scheduled */
campaignRouter.post('/:id/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleDate = req.body.schedule_date as string | undefined;
    const campaign = await campaignService.scheduleCampaign(req.user!.org_id, req.params.id, scheduleDate);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns/:id/cancel-schedule - Cancel scheduled back to draft */
campaignRouter.post('/:id/cancel-schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await campaignService.cancelSchedule(req.user!.org_id, req.params.id);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns/:id/cancel */
campaignRouter.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await campaignService.cancelCampaign(req.user!.org_id, req.params.id);
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/campaigns/:id/stats */
campaignRouter.get('/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await campaignService.getCampaignStats(req.user!.org_id, req.params.id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/campaigns/:id/export - Export campaign results as CSV */
campaignRouter.post('/:id/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await db('campaigns')
      .where({ id: req.params.id, org_id: req.user!.org_id })
      .first();
    if (!campaign) throw new AppError(404, 'Campaign not found');

    const traces = await db('mailing_traces')
      .where('campaign_id', req.params.id)
      .join('contacts', 'mailing_traces.contact_id', 'contacts.id')
      .select(
        'contacts.email',
        'contacts.first_name',
        'contacts.last_name',
        'mailing_traces.trace_status',
        'mailing_traces.sent_at',
        'mailing_traces.first_open_at',
        'mailing_traces.first_click_at',
        'mailing_traces.bounced_at',
      );

    const columns = [
      { key: 'email', header: 'Email' },
      { key: 'first_name', header: 'First Name' },
      { key: 'last_name', header: 'Last Name' },
      { key: 'trace_status', header: 'Status' },
      { key: 'sent_at', header: 'Sent At' },
      { key: 'first_open_at', header: 'Opened At' },
      { key: 'first_click_at', header: 'Clicked At' },
      { key: 'bounced_at', header: 'Bounced At' },
    ];

    const csv = generateCsv(traces, columns);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.id}-results.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});
