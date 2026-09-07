import { Worker, Job } from 'bullmq';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';

interface WebhookJobData {
  webhookId: string;
  url: string;
  secret: string;
  eventType: string;
  payload: Record<string, unknown>;
}

/**
 * Outgoing Webhook Worker
 * Processes webhook delivery jobs from the webhookProcessQueue.
 * Sends POST to webhook URL with JSON payload and HMAC-SHA256 signature.
 * Logs the result to the outgoing_webhook_logs table.
 * Retries 3 times with exponential backoff on failure.
 */
async function deliverWebhook(job: Job<WebhookJobData>) {
  const { webhookId, url, secret, eventType, payload } = job.data;

  const fullPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    attempt: (job.attemptsMade || 0) + 1,
    data: payload,
  };

  const body = JSON.stringify(fullPayload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const startTime = Date.now();
  let responseStatus = 0;
  let responseBody = '';
  let success = false;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Delivery': job.id || uuidv4(),
      },
      body,
      signal: AbortSignal.timeout(30000),
    });

    responseStatus = response.status;
    responseBody = await response.text().catch(() => '');
    success = response.ok;

    if (!response.ok) {
      throw new Error(`Webhook returned status ${response.status}`);
    }
  } catch (err) {
    const duration = Date.now() - startTime;

    // Log the failed attempt
    await db('outgoing_webhook_logs').insert({
      id: uuidv4(),
      webhook_id: webhookId,
      event_type: eventType,
      payload: body,
      response_status: responseStatus,
      response_body: (responseBody || (err as Error).message).substring(0, 2000),
      duration_ms: duration,
      success: false,
    });

    // Re-throw so BullMQ handles retries
    throw err;
  }

  const duration = Date.now() - startTime;

  // Log the successful delivery
  await db('outgoing_webhook_logs').insert({
    id: uuidv4(),
    webhook_id: webhookId,
    event_type: eventType,
    payload: body,
    response_status: responseStatus,
    response_body: responseBody.substring(0, 2000),
    duration_ms: duration,
    success: true,
  });

  console.log(`[webhook-worker] Delivered ${eventType} to ${url} (${duration}ms)`);
}

export function createOutgoingWebhookWorker() {
  return new Worker('webhook-process', deliverWebhook, {
    connection: redis,
    concurrency: 5,
  });
}
