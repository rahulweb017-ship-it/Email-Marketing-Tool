import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { generateTraceToken, generateUnsubscribeToken, timingSafeEqual } from '../../shared/utils/hmac.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { confirmSubscription } from '../lists/list.service.js';
import { automationEventQueue } from '../../config/queue.js';

function enqueueAutomationEvent(trace: { id: string; contact_id: string; automation_trace_id?: string | null }, eventType: 'mail_opened' | 'mail_clicked') {
  if (!trace.automation_trace_id) return;
  automationEventQueue
    .add(eventType, { event_type: eventType, mailing_trace_id: trace.id, contact_id: trace.contact_id }, { jobId: `${eventType}-${trace.id}` })
    .catch(() => {});
}

export const trackingRouter = Router();

// 1x1 transparent GIF pixel
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** Unsubscribing from an automation email takes the contact out of that automation. */
async function leaveAutomation(campaignId: string, contactId: string) {
  const campaign = await db('campaigns').where('id', campaignId).select('is_automation', 'automation_activity_id').first();
  if (!campaign?.is_automation || !campaign.automation_activity_id) return;
  const activity = await db('automation_activities').where('id', campaign.automation_activity_id).select('campaign_id').first();
  if (!activity) return;
  const participantIds = await db('automation_participants')
    .where({ campaign_id: activity.campaign_id, contact_id: contactId, state: 'running' })
    .pluck('id');
  if (!participantIds.length) return;
  await db('automation_participants').whereIn('id', participantIds).update({ state: 'removed' });
  await db('automation_traces').whereIn('participant_id', participantIds).where('state', 'scheduled').update({ state: 'cancelled' });
}
/**
 * GET /t/:traceId/:token/pixel.gif
 * Open tracking pixel - mirrors Odoo's track_mail_open (mass_mailing/controllers/main.py:398)
 */
trackingRouter.get('/t/:traceId/:token/pixel.gif', async (req: Request, res: Response) => {
  const { traceId, token } = req.params;

  // Always return the pixel, even if token is invalid (don't leak info)
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': String(PIXEL_GIF.length),
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });

  try {
    const expectedToken = generateTraceToken(traceId);
    if (!timingSafeEqual(token, expectedToken)) {
      return res.end(PIXEL_GIF);
    }

    const trace = await db('mailing_traces').where('id', traceId).first();
    if (!trace || trace.trace_status === 'cancelled') {
      return res.end(PIXEL_GIF);
    }

    const now = new Date();
    const updates: Record<string, unknown> = {
      last_open_at: now,
      open_count: db.raw('open_count + 1'),
    };

    if (!trace.first_open_at) {
      updates.first_open_at = now;
      updates.trace_status = 'opened';
      // Increment campaign-level stat only on first open (unique opens)
      await db('campaigns').where('id', trace.campaign_id).update({
        stat_opened: db.raw('stat_opened + 1'),
        updated_at: now,
      });
    }

    await db('mailing_traces').where('id', traceId).update(updates);

    if (!trace.first_open_at) enqueueAutomationEvent(trace, 'mail_opened');
  } catch {
    // Silently fail - always serve pixel
  }

  res.end(PIXEL_GIF);
});

/**
 * GET /r/:code/m/:traceId
 * Click tracking redirect - mirrors Odoo's full_url_redirect (mass_mailing/controllers/main.py:411)
 */
trackingRouter.get('/r/:code/m/:traceId', async (req: Request, res: Response) => {
  const { code, traceId } = req.params;

  try {
    const link = await db('tracked_links').where('short_code', code).first();
    if (!link) {
      return res.status(404).send('Link not found');
    }

    // Record click
    const trace = await db('mailing_traces').where('id', traceId).first();
    if (trace && trace.trace_status !== 'cancelled') {
      const now = new Date();

      await db('link_clicks').insert({
        tracked_link_id: link.id,
        mailing_trace_id: traceId,
        ip_address: req.ip || null,
        user_agent: req.get('user-agent') || null,
        country_code: null, // TODO: GeoIP lookup
      });

      await db('tracked_links').where('id', link.id).update({
        click_count: db.raw('click_count + 1'),
      });

      if (!trace.first_click_at) {
        await db('mailing_traces').where('id', traceId).update({
          first_click_at: now,
          click_count: db.raw('click_count + 1'),
        });
        // Update unique click count on tracked link
        await db('tracked_links').where('id', link.id).update({
          unique_click_count: db.raw('unique_click_count + 1'),
        });
        // Increment campaign-level stat only on first click (unique clicks)
        await db('campaigns').where('id', trace.campaign_id).update({
          stat_clicked: db.raw('stat_clicked + 1'),
          updated_at: now,
        });
      } else {
        await db('mailing_traces').where('id', traceId).update({
          click_count: db.raw('click_count + 1'),
        });
      }

      if (!trace.first_click_at) enqueueAutomationEvent(trace, 'mail_clicked');
    }

    res.redirect(301, link.original_url);
  } catch {
    res.status(500).send('Server error');
  }
});

/**
 * GET /unsubscribe/:campaignId
 * Unsubscribe page - mirrors Odoo's mailing_unsubscribe (mass_mailing/controllers/main.py:161)
 */
trackingRouter.get('/unsubscribe/:campaignId', async (req: Request, res: Response) => {
  const { campaignId } = req.params;
  const { contact_id, token } = req.query as { contact_id?: string; token?: string };

  if (!contact_id || !token) {
    return res.status(400).send('Missing required parameters');
  }

  const contact = await db('contacts').where('id', contact_id).first();
  if (!contact) {
    return res.status(404).send('Contact not found');
  }

  const expectedToken = generateUnsubscribeToken(campaignId, contact_id, contact.email);
  if (!timingSafeEqual(token, expectedToken)) {
    return res.status(403).send('Invalid token');
  }

  // Get campaign lists
  const lists = await db('mailing_lists')
    .join('campaign_lists', 'mailing_lists.id', 'campaign_lists.list_id')
    .join('subscriptions', function () {
      this.on('subscriptions.list_id', '=', 'mailing_lists.id')
        .andOn('subscriptions.contact_id', '=', db.raw('?', [contact_id]));
    })
    .where('campaign_lists.campaign_id', campaignId)
    .where('subscriptions.opt_out', false)
    .select('mailing_lists.id', 'mailing_lists.name');

  // Get unsubscribe reasons
  const reasons = await db('unsubscribe_reasons')
    .where('org_id', contact.org_id)
    .orderBy('sequence', 'asc');

  // Simple HTML response (in production, use a template engine or frontend)
  const html = `<!DOCTYPE html><html><head><title>Unsubscribe</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px}
h1{font-size:24px}label{display:block;margin:8px 0}button{padding:10px 20px;background:#e74c3c;color:white;border:none;border-radius:4px;cursor:pointer;margin-top:16px}</style></head>
<body><h1>Unsubscribe</h1><p>Hi ${contact.first_name || contact.email},</p>
${lists.length ? "<p>Select the lists you'd like to unsubscribe from:</p>" : '<p>Confirm to stop receiving these emails.</p>'}
<form method="POST" action="/unsubscribe/${campaignId}">
<input type="hidden" name="contact_id" value="${contact_id}">
<input type="hidden" name="token" value="${token}">
${lists.map((l: { id: string; name: string }) => `<label><input type="checkbox" name="list_ids" value="${l.id}" checked> ${l.name}</label>`).join('')}
${reasons.length > 0 ? `<p>Reason (optional):</p><select name="reason_id"><option value="">--</option>${reasons.map((r: { id: string; name: string }) => `<option value="${r.id}">${r.name}</option>`).join('')}</select>` : ''}
<br><button type="submit">Unsubscribe</button>
<br><br><label><input type="checkbox" name="blacklist" value="true"> Also block all future emails from us</label>
</form></body></html>`;

  res.type('html').send(html);
});

/**
 * POST /unsubscribe/:campaignId
 * Process unsubscribe form
 */
trackingRouter.post('/unsubscribe/:campaignId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignId } = req.params;
    const { contact_id, token, list_ids, reason_id, blacklist } = req.body;

    if (!contact_id || !token) {
      throw new AppError(400, 'Missing required parameters');
    }

    const contact = await db('contacts').where('id', contact_id).first();
    if (!contact) throw new AppError(404, 'Contact not found');

    const expectedToken = generateUnsubscribeToken(campaignId, contact_id, contact.email);
    if (!timingSafeEqual(token, expectedToken)) {
      throw new AppError(403, 'Invalid token');
    }

    const selectedLists = Array.isArray(list_ids) ? list_ids : list_ids ? [list_ids] : [];

    await db.transaction(async (trx) => {
      for (const listId of selectedLists) {
        await trx('subscriptions')
          .where({ contact_id, list_id: listId })
          .update({ opt_out: true, opt_out_at: new Date(), opt_out_reason_id: reason_id || null });
      }

      // Update campaign unsubscribed stats
      await trx('campaigns').where('id', campaignId).update({
        stat_unsubscribed: db.raw('stat_unsubscribed + 1'),
      });

      if (blacklist === 'true' && contact.email_normalized) {
        const existing = await trx('email_blacklist')
          .where({ org_id: contact.org_id, email_normalized: contact.email_normalized })
          .first();

        if (!existing) {
          await trx('email_blacklist').insert({
            id: uuidv4(),
            org_id: contact.org_id,
            email: contact.email,
            email_normalized: contact.email_normalized,
            is_active: true,
            reason: 'Unsubscribed by user',
          });
        }

        await trx('contacts').where('id', contact_id).update({ is_blacklisted: true });
      }
    });
    await leaveAutomation(String(campaignId), String(contact_id));

    res.type('html').send(`<!DOCTYPE html><html><head><title>Unsubscribed</title>
<style>body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 20px;text-align:center}h1{color:#27ae60}</style></head>
<body><h1>Successfully Unsubscribed</h1><p>You have been removed from the selected mailing lists.</p></body></html>`);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /unsubscribe/:campaignId/oneclick
 * RFC 8058 one-click unsubscribe (used by Gmail, Yahoo)
 * Mirrors Odoo's mailing_unsubscribe_oneclick (mass_mailing/controllers/main.py:100)
 */
trackingRouter.post('/unsubscribe/:campaignId/oneclick', async (req: Request, res: Response) => {
  const { campaignId } = req.params;
  const contact_id = req.body.contact_id || req.query.contact_id;
  const token = req.body.token || req.query.token;

  if (!contact_id || !token) {
    return res.status(400).send('Missing parameters');
  }

  try {
    const contact = await db('contacts').where('id', contact_id).first();
    if (!contact) return res.status(404).send('Not found');

    const expectedToken = generateUnsubscribeToken(campaignId, contact_id, contact.email);
    if (!timingSafeEqual(token, expectedToken)) {
      return res.status(403).send('Invalid');
    }

    // Unsubscribe from all lists in this campaign
    const listIds = await db('campaign_lists').where('campaign_id', campaignId).pluck('list_id');
    await db('subscriptions')
      .where('contact_id', contact_id)
      .whereIn('list_id', listIds)
      .update({ opt_out: true, opt_out_at: new Date() });
    await leaveAutomation(String(campaignId), String(contact_id));

    await db('campaigns').where('id', campaignId).update({
      stat_unsubscribed: db.raw('stat_unsubscribed + 1'),
    });

    res.status(200).send('OK');
  } catch {
    res.status(500).send('Error');
  }
});

/**
 * GET /confirm/:token
 * Double opt-in confirmation endpoint (public, no auth required)
 */
trackingRouter.get('/confirm/:token', async (req: Request, res: Response) => {
  try {
    await confirmSubscription(req.params.token);
    res.json({ success: true, message: 'Your subscription has been confirmed!' });
  } catch (err) {
    const status = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : 'An error occurred';
    res.status(status).json({ success: false, message });
  }
});

/**
 * GET /preferences/:token
 * Public subscription preferences page - no auth required, token IS the auth
 */
trackingRouter.get('/preferences/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const contact = await db('contacts').where('preferences_token', token).first();
    if (!contact) {
      return res.status(404).json({ error: 'Invalid preferences link' });
    }

    // Get all lists the contact is subscribed to (or was subscribed to)
    const subscriptions = await db('mailing_lists')
      .join('subscriptions', 'mailing_lists.id', 'subscriptions.list_id')
      .where('subscriptions.contact_id', contact.id)
      .where('mailing_lists.org_id', contact.org_id)
      .select(
        'mailing_lists.id as list_id',
        'mailing_lists.name as list_name',
        'subscriptions.opt_out',
      );

    res.json({
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      subscriptions: subscriptions.map((s: { list_id: string; list_name: string; opt_out: boolean }) => ({
        list_id: s.list_id,
        list_name: s.list_name,
        subscribed: !s.opt_out,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /preferences/:token
 * Update subscription preferences - no auth required, token IS the auth
 */
trackingRouter.post('/preferences/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { subscriptions } = req.body as { subscriptions: Array<{ list_id: string; subscribed: boolean }> };

    if (!subscriptions || !Array.isArray(subscriptions)) {
      return res.status(400).json({ error: 'subscriptions array is required' });
    }

    const contact = await db('contacts').where('preferences_token', token).first();
    if (!contact) {
      return res.status(404).json({ error: 'Invalid preferences link' });
    }

    const now = new Date();
    await db.transaction(async (trx) => {
      for (const sub of subscriptions) {
        const existing = await trx('subscriptions')
          .where({ contact_id: contact.id, list_id: sub.list_id })
          .first();

        if (existing) {
          if (sub.subscribed) {
            await trx('subscriptions')
              .where({ contact_id: contact.id, list_id: sub.list_id })
              .update({ opt_out: false, opt_out_at: null, updated_at: now });
          } else {
            await trx('subscriptions')
              .where({ contact_id: contact.id, list_id: sub.list_id })
              .update({ opt_out: true, opt_out_at: now, updated_at: now });
          }
        }
      }
    });

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});
