// Sends queued WhatsApp messages at a safe pace for every connected number. Runs in the whatsapp-gateway process.
import { db } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import { getOrgLimits, getWhatsAppUsage, incrementWhatsAppCounter } from '../../usage/usage.service.js';
import type { OutboundMessage, WhatsAppSender } from '../providers/types.js';
import { WhatsAppApiError } from '../providers/types.js';
import { getSentToday, incrementSentToday, maybeCompleteCampaign, metaProviderFor, pauseAccount } from '../whatsapp.shared.js';
import { DEFAULT_QUIET_HOURS, dailyCap, isQuietTime, nextDelayMs, type QuietHours } from '../whatsapp.utils.js';
import type { SessionManager } from './session-manager.js';

const TICK_MS = 1000;
const META_BATCH_PER_TICK = 10;
const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_TRANSIENT_RETRIES = 3;
/** Replies to a customer (inbox, AI, STOP confirmation) are not counted against the daily bulk cap. */
const CONVERSATIONAL = ['user', 'ai', 'system'];

export class Dispatcher {
  private timer: NodeJS.Timeout | null = null;
  private busy = new Set<string>();
  private stopped = false;

  constructor(private sessions: SessionManager) {}

  start() {
    this.timer = setInterval(() => { this.tick().catch((err) => console.error('[wa-dispatch] tick:', err.message)); }, TICK_MS);
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    while (this.busy.size) await new Promise((r) => setTimeout(r, 200));
  }

  private async tick() {
    const accounts = await db('whatsapp_accounts').where('status', 'connected').select('*');
    for (const account of accounts) {
      if (this.busy.has(account.id)) continue;
      this.busy.add(account.id);
      this.runAccount(account)
        .catch((err) => console.error(`[wa-dispatch] ${account.id}: ${err.message}`))
        .finally(() => this.busy.delete(account.id));
    }
  }

  private senderFor(account: any): WhatsAppSender | null {
    if (account.provider === 'meta_cloud') return metaProviderFor(account);
    return this.sessions.getSender(account.id);
  }

  private async runAccount(account: any) {
    const nextKey = `wa:next:${account.id}`;
    const nextAt = Number(await redis.get(nextKey) || 0);
    if (Date.now() < nextAt) return;

    const sender = this.senderFor(account);
    if (!sender) return; // QR socket not open yet

    const quiet: QuietHours | null = account.quiet_hours
      ? (typeof account.quiet_hours === 'string' ? JSON.parse(account.quiet_hours) : account.quiet_hours)
      : DEFAULT_QUIET_HOURS;
    const bulkBlocked = isQuietTime(quiet) || await getSentToday(account.id) >= dailyCap(account);

    const batch = account.provider === 'meta_cloud' ? META_BATCH_PER_TICK : 1;
    for (let i = 0; i < batch && !this.stopped; i++) {
      const message = await this.claim(account.id, bulkBlocked);
      if (!message) return;
      await this.deliver(account, sender, message);
      const delay = nextDelayMs(account);
      await redis.set(nextKey, String(Date.now() + delay), 'PX', Math.max(delay, 1000) + 60_000);
      if (account.provider === 'meta_cloud' && i < batch - 1) await new Promise((r) => setTimeout(r, delay));
      if (account.provider !== 'meta_cloud') return;
    }
  }

  /** Atomically take the next message: conversational replies first, then campaign messages (unless blocked). */
  private async claim(accountId: string, bulkBlocked: boolean) {
    const result = await db.raw(`
      UPDATE whatsapp_messages SET status = 'sending', updated_at = now()
      WHERE id = (
        SELECT m.id FROM whatsapp_messages m
        LEFT JOIN whatsapp_campaigns c ON c.id = m.campaign_id
        WHERE m.account_id = ? AND m.status = 'queued'
          AND (m.scheduled_for IS NULL OR m.scheduled_for <= now())
          AND (m.campaign_id IS NULL OR c.state = 'sending')
          ${bulkBlocked ? `AND m.sent_by IN ('user','ai','system')` : ''}
        ORDER BY (COALESCE(m.sent_by, '') IN ('user','ai','system')) DESC, m.created_at ASC
        LIMIT 1
        FOR UPDATE OF m SKIP LOCKED
      )
      RETURNING *`, [accountId]);
    return result.rows[0] || null;
  }

  private async deliver(account: any, sender: WhatsAppSender, message: any) {
    // Last-moment checks: plan limit and opt-out may have changed since the message was queued
    const limits = await getOrgLimits(account.org_id);
    if (await getWhatsAppUsage(account.org_id) >= limits.max_whatsapp_messages_per_month) {
      await this.finish(message, 'failed', { error: 'Monthly WhatsApp limit reached' });
      if (message.campaign_id) {
        await db('whatsapp_campaigns').where('id', message.campaign_id).update({ state: 'paused', failure_reason: 'Monthly WhatsApp limit reached', updated_at: new Date() });
      }
      return;
    }
    if (message.sent_by !== 'system' && message.contact_id) {
      const contact = await db('contacts').where('id', message.contact_id).select('whatsapp_opt_out').first();
      if (contact?.whatsapp_opt_out) {
        await this.finish(message, 'skipped', { error: 'Recipient opted out' });
        return;
      }
    }

    const media = typeof message.media === 'string' ? JSON.parse(message.media) : message.media;
    const template = typeof message.template === 'string' ? JSON.parse(message.template) : message.template;
    const outbound: OutboundMessage = {
      to: message.phone_e164,
      type: message.type === 'template' && sender.provider === 'web_qr' ? (media?.type || 'text') : message.type,
      body: message.body ?? undefined,
      media: media ? { url: media.url, filename: media.filename, mime: media.mime } : undefined,
      template: template || undefined,
    };

    try {
      const { providerMessageId } = await sender.send(outbound);
      await this.finish(message, 'sent', { provider_message_id: providerMessageId });
      await incrementWhatsAppCounter(account.org_id, 1);
      if (!CONVERSATIONAL.includes(message.sent_by)) await incrementSentToday(account.id);
      await redis.del(`wa:fail:${account.id}`);
    } catch (err: any) {
      const apiErr = err instanceof WhatsAppApiError ? err : new WhatsAppApiError(err?.message || 'Send failed', 500);
      const retryKey = `wa:retry:${message.id}`;
      if (!apiErr.permanent && !apiErr.pauseAccount) {
        const tries = await redis.incr(retryKey);
        await redis.expire(retryKey, 86_400);
        if (tries <= MAX_TRANSIENT_RETRIES) {
          await db('whatsapp_messages').where('id', message.id).update({
            status: 'queued', scheduled_for: new Date(Date.now() + 60_000 * tries), error: apiErr.message, updated_at: new Date(),
          });
          return;
        }
      }
      await this.finish(message, 'failed', { error: apiErr.message });
      // "Not on WhatsApp" is a bad number, not a sign the account is in trouble
      const countsAsFailure = !(apiErr.permanent && apiErr.statusCode === 404);
      const fails = countsAsFailure ? await redis.incr(`wa:fail:${account.id}`) : 0;
      await redis.expire(`wa:fail:${account.id}`, 3600);
      if (apiErr.pauseAccount) {
        await pauseAccount(account.id, `Sending stopped: ${apiErr.message}`);
      } else if (fails >= MAX_CONSECUTIVE_FAILURES) {
        await redis.del(`wa:fail:${account.id}`);
        await pauseAccount(account.id, `${fails} messages in a row failed to send (last error: ${apiErr.message}).`);
      }
    }
  }

  private async finish(message: any, status: 'sent' | 'failed' | 'skipped', extra: { provider_message_id?: string; error?: string }) {
    const now = new Date();
    await db('whatsapp_messages').where('id', message.id).update({
      status,
      provider_message_id: extra.provider_message_id ?? message.provider_message_id,
      error: extra.error ?? null,
      sent_at: status === 'sent' ? now : message.sent_at,
      failed_at: status === 'failed' ? now : message.failed_at,
      updated_at: now,
    });
    if (status === 'sent' && message.conversation_id) {
      await db('whatsapp_conversations').where('id', message.conversation_id).update({
        last_message_at: now,
        last_message_preview: (message.body || `[${message.type}]`).slice(0, 200),
        updated_at: now,
      });
    }
    if (message.campaign_id) {
      const col = status === 'sent' ? 'stat_sent' : status === 'failed' ? 'stat_failed' : 'stat_skipped';
      await db('whatsapp_campaigns').where('id', message.campaign_id).increment(col, 1);
      await maybeCompleteCampaign(message.campaign_id);
    }
  }
}
