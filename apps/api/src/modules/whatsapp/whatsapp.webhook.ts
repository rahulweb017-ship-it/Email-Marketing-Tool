// Public Meta webhook for WhatsApp Cloud API (mounted at root, no auth — verified by signature).
import { Router } from 'express';
import { env } from '../../config/env.js';
import { whatsappInboundQueue } from '../../config/queue.js';
import { safeQueueAdd } from '../../shared/utils/queue-helper.js';
import { verifyMetaSignature } from './whatsapp-webhook-parser.js';

export const whatsappWebhookRouter = Router();

// Meta's one-time subscription handshake
whatsappWebhookRouter.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).type('text/plain').send(String(challenge));
    return;
  }
  res.sendStatus(403);
});

whatsappWebhookRouter.post('/webhooks/whatsapp', async (req, res) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!verifyMetaSignature(rawBody, req.header('x-hub-signature-256'), env.WHATSAPP_APP_SECRET)) {
    res.sendStatus(401);
    return;
  }
  // Ack fast; processing happens in the worker
  try {
    await safeQueueAdd(whatsappInboundQueue, 'meta-webhook', { payload: req.body }, {
      attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 5000, removeOnFail: 5000,
    });
    res.sendStatus(200);
  } catch (err: any) {
    console.error('WhatsApp webhook enqueue failed:', err.message);
    res.sendStatus(500); // Meta retries
  }
});
