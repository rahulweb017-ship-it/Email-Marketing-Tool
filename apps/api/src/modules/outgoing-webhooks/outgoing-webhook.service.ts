import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { webhookProcessQueue } from '../../config/queue.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateWebhookInput, UpdateWebhookInput } from './outgoing-webhook.schema.js';

/**
 * Create a new outgoing webhook.
 */
export async function createWebhook(orgId: string, data: CreateWebhookInput) {
  const id = uuidv4();
  const secret = data.secret || crypto.randomBytes(24).toString('hex');

  await db('outgoing_webhooks').insert({
    id,
    org_id: orgId,
    name: data.name,
    url: data.url,
    secret,
    events: JSON.stringify(data.events),
    is_active: true,
  });

  return getWebhook(orgId, id);
}

/**
 * Get a single outgoing webhook with its details.
 */
export async function getWebhook(orgId: string, webhookId: string) {
  const webhook = await db('outgoing_webhooks').where({ id: webhookId, org_id: orgId }).first();
  if (!webhook) throw new AppError(404, 'Webhook not found');

  return {
    ...webhook,
    events: typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events,
  };
}

/**
 * List all outgoing webhooks for an org.
 */
export async function listWebhooks(orgId: string) {
  const webhooks = await db('outgoing_webhooks')
    .where({ org_id: orgId })
    .orderBy('created_at', 'desc');

  return webhooks.map((w: Record<string, unknown>) => ({
    ...w,
    events: typeof w.events === 'string' ? JSON.parse(w.events as string) : w.events,
  }));
}

/**
 * Update an outgoing webhook.
 */
export async function updateWebhook(orgId: string, webhookId: string, data: UpdateWebhookInput) {
  const webhook = await db('outgoing_webhooks').where({ id: webhookId, org_id: orgId }).first();
  if (!webhook) throw new AppError(404, 'Webhook not found');

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.url !== undefined) updates.url = data.url;
  if (data.secret !== undefined) updates.secret = data.secret;
  if (data.events !== undefined) updates.events = JSON.stringify(data.events);

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('outgoing_webhooks').where({ id: webhookId }).update(updates);
  }

  return getWebhook(orgId, webhookId);
}

/**
 * Toggle a webhook's active status.
 */
export async function toggleWebhook(orgId: string, webhookId: string) {
  const webhook = await db('outgoing_webhooks').where({ id: webhookId, org_id: orgId }).first();
  if (!webhook) throw new AppError(404, 'Webhook not found');

  await db('outgoing_webhooks').where({ id: webhookId }).update({
    is_active: !webhook.is_active,
    updated_at: new Date(),
  });

  return getWebhook(orgId, webhookId);
}

/**
 * Delete an outgoing webhook.
 */
export async function deleteWebhook(orgId: string, webhookId: string) {
  const webhook = await db('outgoing_webhooks').where({ id: webhookId, org_id: orgId }).first();
  if (!webhook) throw new AppError(404, 'Webhook not found');

  await db.transaction(async (trx) => {
    await trx('outgoing_webhook_logs').where('webhook_id', webhookId).del();
    await trx('outgoing_webhooks').where({ id: webhookId }).del();
  });
}

/**
 * Send a test payload to a webhook URL.
 */
export async function testWebhook(orgId: string, webhookId: string) {
  const webhook = await db('outgoing_webhooks').where({ id: webhookId, org_id: orgId }).first();
  if (!webhook) throw new AppError(404, 'Webhook not found');

  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook delivery from Rabbit Growth.',
      webhook_id: webhookId,
    },
  };

  const body = JSON.stringify(testPayload);
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(body)
    .digest('hex');

  const startTime = Date.now();
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Webhook-Event': 'webhook.test',
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;
    const responseBody = await response.text().catch(() => '');

    // Log the test delivery
    await db('outgoing_webhook_logs').insert({
      id: uuidv4(),
      webhook_id: webhookId,
      event_type: 'webhook.test',
      payload: JSON.stringify(testPayload),
      response_status: response.status,
      response_body: responseBody.substring(0, 2000),
      duration_ms: duration,
      success: response.ok,
    });

    return {
      success: response.ok,
      status: response.status,
      duration_ms: duration,
      message: response.ok ? 'Webhook test successful' : `Webhook returned status ${response.status}`,
    };
  } catch (err) {
    const duration = Date.now() - startTime;

    await db('outgoing_webhook_logs').insert({
      id: uuidv4(),
      webhook_id: webhookId,
      event_type: 'webhook.test',
      payload: JSON.stringify(testPayload),
      response_status: 0,
      response_body: (err as Error).message,
      duration_ms: duration,
      success: false,
    });

    return {
      success: false,
      status: 0,
      duration_ms: duration,
      message: `Connection failed: ${(err as Error).message}`,
    };
  }
}

/**
 * List webhook delivery logs (paginated).
 */
export async function listWebhookLogs(orgId: string, webhookId: string, pagination: PaginationParams) {
  // Verify webhook belongs to org
  const webhook = await db('outgoing_webhooks').where({ id: webhookId, org_id: orgId }).first();
  if (!webhook) throw new AppError(404, 'Webhook not found');

  const [{ count }] = await db('outgoing_webhook_logs')
    .where('webhook_id', webhookId)
    .count('* as count');

  const logs = await db('outgoing_webhook_logs')
    .where('webhook_id', webhookId)
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data: logs, total: Number(count) };
}

/**
 * Dispatch a webhook event to all matching active webhooks for an org.
 * Queues each delivery as a BullMQ job for async processing.
 */
export async function dispatchWebhook(eventType: string, payload: Record<string, unknown>, orgId: string) {
  const webhooks = await db('outgoing_webhooks')
    .where({ org_id: orgId, is_active: true })
    .select('id', 'url', 'secret', 'events');

  for (const webhook of webhooks) {
    const events: string[] = typeof webhook.events === 'string' ? JSON.parse(webhook.events) : webhook.events;
    if (!events.includes(eventType)) continue;

    await webhookProcessQueue.add('deliver-webhook', {
      webhookId: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      eventType,
      payload,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }
}
