import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';

export const webhookRouter = Router();

/**
 * POST /webhooks/sendgrid
 * Handle SendGrid event webhooks (delivery, bounce, open, click, spam, unsubscribe)
 */
webhookRouter.post('/webhooks/sendgrid', async (req: Request, res: Response) => {
  const events = req.body;
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'Expected array of events' });
  }

  for (const event of events) {
    try {
      // Log raw event
      await db('webhook_events').insert({
        id: uuidv4(),
        provider: 'sendgrid',
        event_type: event.event,
        payload: JSON.stringify(event),
      });

      // Find trace by message_id or custom_args
      const messageId = event.sg_message_id?.split('.')[0];
      if (!messageId) continue;

      const trace = await db('mailing_traces').where('message_id', messageId).first();
      if (!trace) continue;

      switch (event.event) {
        case 'delivered':
          await db('mailing_traces').where('id', trace.id).update({ trace_status: 'sent' });
          break;
        case 'bounce':
        case 'dropped':
          await db('mailing_traces').where('id', trace.id).update({
            trace_status: 'bounced',
            bounced_at: new Date(event.timestamp * 1000),
            failure_type: event.event === 'bounce' ? 'smtp_error' : 'email_invalid',
            failure_reason: event.reason || event.response || null,
          });
          if (trace.campaign_id) {
            await db('campaigns').where('id', trace.campaign_id).update({
              stat_bounced: db.raw('stat_bounced + 1'), updated_at: new Date(),
            });
          }
          break;
        case 'spamreport':
          await db('mailing_traces').where('id', trace.id).update({
            trace_status: 'error',
            failure_type: 'complaint',
            failure_reason: 'Marked as spam',
          });
          if (trace.campaign_id) {
            await db('campaigns').where('id', trace.campaign_id).update({
              stat_bounced: db.raw('stat_bounced + 1'), updated_at: new Date(),
            });
          }
          // Auto-blacklist on complaint
          if (trace.email) {
            const contact = await db('contacts').where('id', trace.contact_id).first();
            if (contact) {
              await db('email_blacklist').insert({
                id: uuidv4(),
                org_id: contact.org_id,
                email: trace.email,
                email_normalized: trace.email.toLowerCase(),
                is_active: true,
                reason: 'Spam complaint via SendGrid',
              }).onConflict(['org_id', 'email_normalized']).ignore();
              await db('contacts').where('id', trace.contact_id).update({ is_blacklisted: true });
            }
          }
          break;
      }
    } catch (err) {
      console.error('SendGrid webhook error:', (err as Error).message);
    }
  }

  res.status(200).json({ received: true });
});

/**
 * POST /webhooks/ses
 * Handle AWS SES notifications via SNS
 */
webhookRouter.post('/webhooks/ses', async (req: Request, res: Response) => {
  const body = req.body;

  // Handle SNS subscription confirmation
  if (body.Type === 'SubscriptionConfirmation' && body.SubscribeURL) {
    try {
      await fetch(body.SubscribeURL);
      return res.status(200).json({ confirmed: true });
    } catch {
      return res.status(500).json({ error: 'Failed to confirm subscription' });
    }
  }

  // Handle notification
  if (body.Type === 'Notification') {
    try {
      const message = JSON.parse(body.Message);
      const notificationType = message.notificationType;

      await db('webhook_events').insert({
        id: uuidv4(),
        provider: 'ses',
        event_type: notificationType,
        payload: JSON.stringify(message),
      });

      const messageId = message.mail?.messageId;
      if (!messageId) return res.status(200).json({ received: true });

      const trace = await db('mailing_traces').where('message_id', messageId).first();
      if (!trace) return res.status(200).json({ received: true });

      switch (notificationType) {
        case 'Bounce':
          await db('mailing_traces').where('id', trace.id).update({
            trace_status: 'bounced',
            bounced_at: new Date(),
            failure_type: message.bounce?.bounceType === 'Permanent' ? 'email_invalid' : 'smtp_error',
            failure_reason: message.bounce?.bouncedRecipients?.[0]?.diagnosticCode || null,
          });
          if (trace.campaign_id) {
            await db('campaigns').where('id', trace.campaign_id).update({
              stat_bounced: db.raw('stat_bounced + 1'), updated_at: new Date(),
            });
          }
          break;

        case 'Complaint':
          await db('mailing_traces').where('id', trace.id).update({
            trace_status: 'error',
            failure_type: 'complaint',
            failure_reason: 'Complaint reported via SES',
          });
          if (trace.campaign_id) {
            await db('campaigns').where('id', trace.campaign_id).update({
              stat_bounced: db.raw('stat_bounced + 1'), updated_at: new Date(),
            });
          }
          // Auto-blacklist
          if (trace.email) {
            const contact = await db('contacts').where('id', trace.contact_id).first();
            if (contact) {
              await db('email_blacklist').insert({
                id: uuidv4(),
                org_id: contact.org_id,
                email: trace.email,
                email_normalized: trace.email.toLowerCase(),
                is_active: true,
                reason: 'Complaint via SES',
              }).onConflict(['org_id', 'email_normalized']).ignore();
              await db('contacts').where('id', trace.contact_id).update({ is_blacklisted: true });
            }
          }
          break;

        case 'Delivery':
          if (trace.trace_status === 'sent' || trace.trace_status === 'outgoing') {
            await db('mailing_traces').where('id', trace.id).update({ trace_status: 'sent' });
          }
          break;
      }
    } catch (err) {
      console.error('SES webhook error:', (err as Error).message);
    }
  }

  res.status(200).json({ received: true });
});
