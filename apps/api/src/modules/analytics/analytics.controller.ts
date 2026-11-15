import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { db } from '../../config/database.js';
import { getHub } from './analytics.service.js';
import { clampDays } from './analytics.utils.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/analytics/overview - Dashboard overview stats */
analyticsRouter.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;

    const [contactCount] = await db('contacts').where('org_id', orgId).count('* as count');
    const [listCount] = await db('mailing_lists').where('org_id', orgId).count('* as count');
    const [campaignCount] = await db('campaigns').where({ org_id: orgId, is_automation: false }).count('* as count');
    const [sentCampaigns] = await db('campaigns').where({ org_id: orgId, state: 'done' }).count('* as count');

    // Compute stats from mailing_traces (source of truth) instead of stale stat_* columns
    const aggregateStats = await db('mailing_traces')
      .join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where('campaigns.org_id', orgId)
      .where('campaigns.state', 'done')
      .select(
        db.raw('COUNT(*) as total_recipients'),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.sent_at IS NOT NULL) as total_sent"),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.first_open_at IS NOT NULL) as total_opened"),
        db.raw("COUNT(DISTINCT mailing_traces.contact_id) FILTER (WHERE mailing_traces.first_click_at IS NOT NULL) as total_clicked"),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.trace_status = 'bounced') as total_bounced"),
      )
      .first();

    // Unsubscribes are tracked separately on campaigns table
    const [unsubStats] = await db('campaigns')
      .where({ org_id: orgId, state: 'done' })
      .select(db.raw('COALESCE(SUM(stat_unsubscribed), 0) as total_unsubscribed'));

    const totalSent = Number(aggregateStats?.total_sent || 0);
    const totalOpened = Number(aggregateStats?.total_opened || 0);
    const totalClicked = Number(aggregateStats?.total_clicked || 0);

    res.json({
      contacts: Number(contactCount.count),
      mailing_lists: Number(listCount.count),
      campaigns_total: Number(campaignCount.count),
      campaigns_sent: Number(sentCampaigns.count),
      total_emails_sent: totalSent,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      total_bounced: Number(aggregateStats?.total_bounced || 0),
      total_unsubscribed: Number(unsubStats?.total_unsubscribed || 0),
      avg_open_rate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(2) : '0.00',
      avg_click_rate: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(2) : '0.00',
    });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/hub?days=30 - All-channel dashboard (email, WhatsApp, social, leads, automations) */
analyticsRouter.get('/hub', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    if (!orgId) return res.status(403).json({ error: 'Organization context required' });
    res.json(await getHub(orgId, clampDays(req.query.days)));
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns - Campaign performance over time */
analyticsRouter.get('/campaigns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const days = parseInt(req.query.days as string) || 30;

    // Compute live stats from mailing_traces instead of stale stat_* columns
    const data = await db('campaigns')
      .leftJoin('mailing_traces', 'mailing_traces.campaign_id', 'campaigns.id')
      .where('campaigns.org_id', orgId)
      .where('campaigns.state', 'done')
      .where('campaigns.sent_date', '>=', db.raw(`NOW() - INTERVAL '${days} days'`))
      .select(
        'campaigns.id', 'campaigns.name', 'campaigns.subject', 'campaigns.sent_date',
        db.raw('COUNT(mailing_traces.id) as stat_total'),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.sent_at IS NOT NULL) as stat_sent"),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.first_open_at IS NOT NULL) as stat_opened"),
        db.raw("COUNT(DISTINCT mailing_traces.contact_id) FILTER (WHERE mailing_traces.first_click_at IS NOT NULL) as stat_clicked"),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.trace_status = 'bounced') as stat_bounced"),
        db.raw("COUNT(*) FILTER (WHERE mailing_traces.trace_status = 'error') as stat_failed"),
        'campaigns.stat_unsubscribed',
      )
      .groupBy('campaigns.id')
      .orderBy('campaigns.sent_date', 'desc');

    res.json({ data: data.map((d: any) => ({ ...d, stat_total: Number(d.stat_total), stat_sent: Number(d.stat_sent), stat_opened: Number(d.stat_opened), stat_clicked: Number(d.stat_clicked), stat_bounced: Number(d.stat_bounced), stat_failed: Number(d.stat_failed) })) });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/activity - Recent activity feed */
analyticsRouter.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;

    const events = await db('mailing_traces')
      .join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where('campaigns.org_id', orgId)
      .select(
        'mailing_traces.id',
        'mailing_traces.trace_status',
        'mailing_traces.email',
        'mailing_traces.sent_at',
        'mailing_traces.first_open_at',
        'mailing_traces.first_click_at',
        'mailing_traces.bounced_at',
        'mailing_traces.updated_at',
        'campaigns.name as campaign_name',
      )
      .orderBy('mailing_traces.updated_at', 'desc')
      .limit(20);

    // Transform into activity items
    const activities = events.map((e: Record<string, unknown>) => {
      let event_type = 'sent';
      let timestamp = e.sent_at;
      if (e.bounced_at) { event_type = 'bounced'; timestamp = e.bounced_at; }
      else if (e.first_click_at) { event_type = 'clicked'; timestamp = e.first_click_at; }
      else if (e.first_open_at) { event_type = 'opened'; timestamp = e.first_open_at; }
      return {
        id: e.id,
        event_type,
        email: e.email,
        campaign_name: e.campaign_name,
        timestamp,
      };
    });

    res.json({ data: activities });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/trends - Daily counts for sparklines (last 14 days) */
analyticsRouter.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;

    const contactTrend = await db('contacts')
      .where('org_id', orgId)
      .where('created_at', '>=', db.raw("NOW() - INTERVAL '14 days'"))
      .select(db.raw("DATE(created_at) as day"), db.raw('COUNT(*) as count'))
      .groupByRaw('DATE(created_at)')
      .orderBy('day');

    const sentTrend = await db('mailing_traces')
      .join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where('campaigns.org_id', orgId)
      .whereNotNull('mailing_traces.sent_at')
      .where('mailing_traces.sent_at', '>=', db.raw("NOW() - INTERVAL '14 days'"))
      .select(db.raw("DATE(mailing_traces.sent_at) as day"), db.raw('COUNT(*) as count'))
      .groupByRaw('DATE(mailing_traces.sent_at)')
      .orderBy('day');

    const openTrend = await db('mailing_traces')
      .join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where('campaigns.org_id', orgId)
      .whereNotNull('mailing_traces.first_open_at')
      .where('mailing_traces.first_open_at', '>=', db.raw("NOW() - INTERVAL '14 days'"))
      .select(db.raw("DATE(mailing_traces.first_open_at) as day"), db.raw('COUNT(*) as count'))
      .groupByRaw('DATE(mailing_traces.first_open_at)')
      .orderBy('day');

    const clickTrend = await db('mailing_traces')
      .join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where('campaigns.org_id', orgId)
      .whereNotNull('mailing_traces.first_click_at')
      .where('mailing_traces.first_click_at', '>=', db.raw("NOW() - INTERVAL '14 days'"))
      .select(db.raw("DATE(mailing_traces.first_click_at) as day"), db.raw('COUNT(*) as count'))
      .groupByRaw('DATE(mailing_traces.first_click_at)')
      .orderBy('day');

    const toArray = (rows: { day: string; count: string }[]) => rows.map((r) => Number(r.count));

    res.json({
      contacts: toArray(contactTrend),
      emails_sent: toArray(sentTrend),
      opens: toArray(openTrend),
      clicks: toArray(clickTrend),
    });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns/:id/traces - Per-recipient trace details */
analyticsRouter.get('/campaigns/:id/traces', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const campaignId = req.params.id;

    // Verify campaign belongs to org
    const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.per_page as string) || 50, 100);
    const status = req.query.status as string;

    let query = db('mailing_traces')
      .join('contacts', 'contacts.id', 'mailing_traces.contact_id')
      .where('mailing_traces.campaign_id', campaignId);

    let countQuery = db('mailing_traces').where('campaign_id', campaignId);

    if (status) {
      query = query.where('mailing_traces.trace_status', status);
      countQuery = countQuery.where('trace_status', status);
    }

    const [{ count }] = await countQuery.count('* as count');
    const data = await query
      .select(
        'mailing_traces.*',
        'contacts.first_name', 'contacts.last_name',
      )
      .orderBy('mailing_traces.created_at', 'desc')
      .limit(perPage)
      .offset((page - 1) * perPage);

    res.json({
      data,
      total: Number(count),
      page,
      per_page: perPage,
      total_pages: Math.ceil(Number(count) / perPage),
    });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns/:id/links - Tracked link performance */
analyticsRouter.get('/campaigns/:id/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const campaignId = req.params.id;

    const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const links = await db('tracked_links')
      .where('campaign_id', campaignId)
      .orderBy('click_count', 'desc');

    res.json({ data: links });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns/:id/timeline - Hourly open/click counts for 72h post-send */
analyticsRouter.get('/campaigns/:id/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const campaignId = req.params.id;

    const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const sentDate = campaign.sent_date || campaign.created_at;
    const cutoff = new Date(new Date(sentDate).getTime() + 72 * 60 * 60 * 1000).toISOString();

    const opens = await db('mailing_traces')
      .where('campaign_id', campaignId)
      .whereNotNull('first_open_at')
      .where('first_open_at', '>=', sentDate)
      .where('first_open_at', '<=', cutoff)
      .select(
        db.raw("date_trunc('hour', first_open_at) as hour"),
        db.raw('COUNT(*) as count'),
      )
      .groupByRaw("date_trunc('hour', first_open_at)")
      .orderBy('hour');

    const clicks = await db('mailing_traces')
      .where('campaign_id', campaignId)
      .whereNotNull('first_click_at')
      .where('first_click_at', '>=', sentDate)
      .where('first_click_at', '<=', cutoff)
      .select(
        db.raw("date_trunc('hour', first_click_at) as hour"),
        db.raw('COUNT(*) as count'),
      )
      .groupByRaw("date_trunc('hour', first_click_at)")
      .orderBy('hour');

    res.json({
      opens: opens.map((r: { hour: string; count: string }) => ({ hour: r.hour, count: Number(r.count) })),
      clicks: clicks.map((r: { hour: string; count: string }) => ({ hour: r.hour, count: Number(r.count) })),
    });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns/:id/devices - Device breakdown from user_agent */
analyticsRouter.get('/campaigns/:id/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const campaignId = req.params.id;

    const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const clicks = await db('link_clicks')
      .join('tracked_links', 'tracked_links.id', 'link_clicks.tracked_link_id')
      .where('tracked_links.campaign_id', campaignId)
      .select('link_clicks.user_agent');

    const deviceCounts: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0, Unknown: 0 };

    for (const row of clicks) {
      const ua = (row.user_agent || '').toLowerCase();
      if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceCounts.Tablet++;
      } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) {
        deviceCounts.Mobile++;
      } else if (/mozilla|chrome|safari|firefox|edge|opera|msie|trident/i.test(ua)) {
        deviceCounts.Desktop++;
      } else {
        deviceCounts.Unknown++;
      }
    }

    const data = Object.entries(deviceCounts)
      .map(([device, count]) => ({ device, count }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);

    res.json({ data });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/compare?ids=id1,id2,id3 - Comparative campaign reports */
analyticsRouter.get('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const idsParam = req.query.ids as string;

    if (!idsParam) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length < 2 || ids.length > 5) {
      return res.status(400).json({ error: 'Provide between 2 and 5 campaign IDs' });
    }

    // Verify all campaigns belong to user's org
    const campaigns = await db('campaigns')
      .whereIn('id', ids)
      .where('org_id', orgId)
      .select('id', 'name', 'subject', 'sent_date');

    if (campaigns.length !== ids.length) {
      return res.status(404).json({ error: 'One or more campaigns not found or not accessible' });
    }

    // Compute stats from mailing_traces for each campaign
    const stats = await db('mailing_traces')
      .whereIn('campaign_id', ids)
      .select(
        'campaign_id',
        db.raw('COUNT(*) as total_recipients'),
        db.raw("COUNT(*) FILTER (WHERE sent_at IS NOT NULL) as sent"),
        db.raw("COUNT(*) FILTER (WHERE first_open_at IS NOT NULL) as opened"),
        db.raw("COUNT(DISTINCT contact_id) FILTER (WHERE first_click_at IS NOT NULL) as clicked"),
        db.raw("COUNT(*) FILTER (WHERE trace_status = 'bounced') as bounced"),
      )
      .groupBy('campaign_id');

    const statsMap = new Map(stats.map((s: any) => [s.campaign_id, s]));

    // Return in the same order as requested
    const result = ids.map((id) => {
      const campaign = campaigns.find((c: any) => c.id === id)!;
      const s = statsMap.get(id) || { total_recipients: 0, sent: 0, opened: 0, clicked: 0, bounced: 0 };
      const sent = Number(s.sent);
      const opened = Number(s.opened);
      const clicked = Number(s.clicked);
      const bounced = Number(s.bounced);
      return {
        id,
        name: campaign.name,
        subject: campaign.subject,
        sent_date: campaign.sent_date,
        total_recipients: Number(s.total_recipients),
        sent,
        opened,
        clicked,
        bounced,
        open_rate: sent > 0 ? parseFloat(((opened / sent) * 100).toFixed(2)) : 0,
        click_rate: sent > 0 ? parseFloat(((clicked / sent) * 100).toFixed(2)) : 0,
        bounce_rate: sent > 0 ? parseFloat(((bounced / sent) * 100).toFixed(2)) : 0,
      };
    });

    res.json({ data: result });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns/:id/heatmap - Click heatmap data */
analyticsRouter.get('/campaigns/:id/heatmap', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const campaignId = req.params.id;

    const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get tracked links with click counts
    const links = await db('tracked_links')
      .where('campaign_id', campaignId)
      .select('id', 'original_url', 'click_count')
      .orderBy('click_count', 'desc');

    // Get unique clicks per link
    const uniqueClicks = await db('link_clicks')
      .join('tracked_links', 'tracked_links.id', 'link_clicks.tracked_link_id')
      .where('tracked_links.campaign_id', campaignId)
      .select('tracked_links.id as tracked_link_id')
      .countDistinct('link_clicks.contact_id as unique_clicks')
      .groupBy('tracked_links.id');

    const uniqueMap = new Map(uniqueClicks.map((u: any) => [u.tracked_link_id, Number(u.unique_clicks)]));

    // Get total unique opens for normalization
    const [openResult] = await db('mailing_traces')
      .where('campaign_id', campaignId)
      .whereNotNull('first_open_at')
      .count('* as total_opens');

    const linksWithUnique = links.map((l: any) => ({
      url: l.original_url,
      click_count: l.click_count,
      unique_clicks: uniqueMap.get(l.id) || 0,
    }));

    res.json({
      html: campaign.body_html || '',
      links: linksWithUnique,
      total_opens: Number(openResult.total_opens),
    });
  } catch (err) { next(err); }
});

/** GET /api/v1/analytics/campaigns/:id/geo - Geographic breakdown */
analyticsRouter.get('/campaigns/:id/geo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const campaignId = req.params.id;

    const campaign = await db('campaigns').where({ id: campaignId, org_id: orgId }).first();
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const data = await db('link_clicks')
      .join('tracked_links', 'tracked_links.id', 'link_clicks.tracked_link_id')
      .where('tracked_links.campaign_id', campaignId)
      .whereNotNull('link_clicks.country_code')
      .where('link_clicks.country_code', '!=', '')
      .select('link_clicks.country_code')
      .count('* as count')
      .groupBy('link_clicks.country_code')
      .orderBy('count', 'desc');

    res.json({
      data: data.map((r: any) => ({
        country_code: r.country_code,
        count: Number(r.count),
      })),
    });
  } catch (err) { next(err); }
});
