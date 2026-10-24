// Owns the long-lived QR-linked WhatsApp sockets (Baileys). Runs only in the whatsapp-gateway process.
import makeWASocket, {
  DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, type WASocket, type WAMessage,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { db } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import { whatsappInboundQueue } from '../../../config/queue.js';
import { e164ToWaId, waIdToE164 } from '../../../shared/utils/phone.js';
import { pauseAccount } from '../whatsapp.shared.js';
import type { OutboundMessage, SendResult, WhatsAppSender } from '../providers/types.js';
import { WhatsAppApiError } from '../providers/types.js';
import { useDbAuthState } from './db-auth-state.js';

const logger = pino({ level: process.env.WA_LOG_LEVEL || 'silent' });
const MAX_RECONNECTS = 6;

interface Session {
  sock: WASocket;
  open: boolean;
  clear: () => Promise<void>;
  closing?: boolean;
}

function extractText(msg: WAMessage): { type: string; body: string | null; media: Record<string, unknown> | null } {
  const m: any = msg.message || {};
  const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m;
  if (inner.conversation) return { type: 'text', body: inner.conversation, media: null };
  if (inner.extendedTextMessage) return { type: 'text', body: inner.extendedTextMessage.text ?? null, media: null };
  for (const kind of ['image', 'video', 'document', 'audio', 'sticker'] as const) {
    const part = inner[`${kind}Message`];
    if (part) {
      return {
        type: kind === 'sticker' ? 'other' : kind,
        body: part.caption ?? null,
        media: { type: kind, mime: part.mimetype, filename: part.fileName },
      };
    }
  }
  if (inner.buttonsResponseMessage) return { type: 'text', body: inner.buttonsResponseMessage.selectedDisplayText ?? null, media: null };
  if (inner.listResponseMessage) return { type: 'text', body: inner.listResponseMessage.title ?? null, media: null };
  if (inner.templateButtonReplyMessage) return { type: 'text', body: inner.templateButtonReplyMessage.selectedDisplayText ?? null, media: null };
  if (inner.locationMessage) return { type: 'text', body: `Location: ${inner.locationMessage.degreesLatitude}, ${inner.locationMessage.degreesLongitude}`, media: null };
  return { type: 'other', body: null, media: null };
}

/** Find the phone-number JID for a chat (Baileys 7 may address chats by LID). */
function phoneJid(key: WAMessage['key']): string | null {
  const candidates = [key.remoteJid, (key as any).remoteJidAlt];
  return candidates.find((j) => typeof j === 'string' && j.endsWith('@s.whatsapp.net')) || null;
}

const STATUS_MAP: Record<number, 'sent' | 'delivered' | 'read' | 'failed'> = { 0: 'failed', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' };

export class SessionManager {
  private sessions = new Map<string, Session>();
  private reconnects = new Map<string, number>();
  private version: [number, number, number] | undefined;

  async start() {
    try {
      const { version } = await fetchLatestBaileysVersion();
      this.version = version;
    } catch {
      console.warn('[wa-gateway] Could not fetch the latest WhatsApp Web version; using the library default');
    }
    // Reconnect numbers that were linked before this process restarted
    const accounts = await db('whatsapp_accounts as a')
      .where('a.provider', 'web_qr')
      .whereIn('a.status', ['connected', 'paused'])
      .whereExists(db('whatsapp_session_keys as k').whereRaw('k.account_id = a.id').where('k.category', 'creds'))
      .select('a.id');
    for (const a of accounts) await this.connect(a.id).catch((err) => console.error(`[wa-gateway] ${a.id}: ${err.message}`));
    console.log(`[wa-gateway] restored ${accounts.length} linked number(s)`);
  }

  isOpen(accountId: string): boolean {
    return this.sessions.get(accountId)?.open === true;
  }

  async connect(accountId: string) {
    const account = await db('whatsapp_accounts').where('id', accountId).first();
    if (!account || account.provider !== 'web_qr') return;
    const existing = this.sessions.get(accountId);
    if (existing) {
      if (existing.open) {
        // Already linked (e.g. "Resume" on a paused number): just mark it usable again
        await db('whatsapp_accounts').where('id', accountId).update({ status: 'connected', last_error: null, updated_at: new Date() });
        return;
      }
      existing.closing = true;
      existing.sock.end(undefined);
      this.sessions.delete(accountId);
    }

    const { state, saveCreds, clear } = await useDbAuthState(accountId);
    const sock = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      logger,
      version: this.version,
      browser: ['Rabbit Growth', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });
    const session: Session = { sock, open: false, clear };
    this.sessions.set(accountId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      try {
        if (update.qr) {
          await redis.set(`wa:qr:${accountId}`, update.qr, 'EX', 60);
          await db('whatsapp_accounts').where('id', accountId).update({ status: 'pending_qr', updated_at: new Date() });
        }
        if (update.connection === 'open') {
          session.open = true;
          this.reconnects.delete(accountId);
          await redis.del(`wa:qr:${accountId}`);
          const phone = sock.user?.id ? waIdToE164(sock.user.id) : null;
          const current = await db('whatsapp_accounts').where('id', accountId).first();
          await db('whatsapp_accounts').where('id', accountId).update({
            status: current?.status === 'paused' ? 'paused' : 'connected',
            phone_e164: phone ?? current?.phone_e164,
            display_name: sock.user?.name || current?.display_name,
            warmup_started_at: current?.warmup_started_at ?? new Date(),
            last_seen_at: new Date(),
            last_error: null,
            updated_at: new Date(),
          });
          console.log(`[wa-gateway] ${accountId} connected as ${phone}`);
        }
        if (update.connection === 'close') {
          session.open = false;
          if (session.closing) return;
          this.sessions.delete(accountId);
          const code = (update.lastDisconnect?.error as any)?.output?.statusCode as number | undefined;
          await this.handleClose(accountId, code, clear, state.creds.registered || !!state.creds.me);
        }
      } catch (err: any) {
        console.error(`[wa-gateway] ${accountId} connection.update: ${err.message}`);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe || !msg.message) continue;
        const jid = phoneJid(msg.key);
        if (!jid) continue; // groups, broadcasts, channels, or LID-only chats
        const { type: msgType, body, media } = extractText(msg);
        await whatsappInboundQueue.add('event', {
          kind: 'message',
          account_id: accountId,
          from: waIdToE164(jid),
          profile_name: msg.pushName ?? null,
          provider_message_id: msg.key.id,
          type: msgType,
          body,
          media,
          timestamp: Number(msg.messageTimestamp || 0) * 1000 || Date.now(),
        }, { removeOnComplete: 5000, removeOnFail: 5000 }).catch((err) => console.error(`[wa-gateway] enqueue: ${err.message}`));
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      for (const { key, update } of updates) {
        if (!key.fromMe || update.status == null || !key.id) continue;
        const status = STATUS_MAP[update.status as number];
        if (!status) continue;
        await whatsappInboundQueue.add('event', {
          kind: 'status', account_id: accountId, provider_message_id: key.id, status, timestamp: Date.now(),
        }, { removeOnComplete: 5000, removeOnFail: 5000 }).catch(() => {});
      }
    });
  }

  private async handleClose(accountId: string, code: number | undefined, clear: () => Promise<void>, wasLinked: boolean) {
    if (code === DisconnectReason.loggedOut) {
      await clear();
      await pauseAccount(accountId, 'The number was logged out from the phone (Linked devices). Scan a new QR to reconnect.', 'logged_out');
      return;
    }
    if (code === DisconnectReason.forbidden) {
      await pauseAccount(accountId, 'WhatsApp blocked this number. Stop sending from it and check the WhatsApp app for details.', 'banned');
      return;
    }
    if (code === DisconnectReason.connectionReplaced) {
      await pauseAccount(accountId, 'This session was opened somewhere else, so it was closed here. Click Reconnect to take it back.', 'error');
      return;
    }
    if (!wasLinked) {
      // QR shown but never scanned
      await redis.del(`wa:qr:${accountId}`);
      await db('whatsapp_accounts').where('id', accountId).update({
        status: 'disconnected', last_error: 'The QR code expired before it was scanned. Click Connect to get a new one.', updated_at: new Date(),
      });
      return;
    }
    const attempt = (this.reconnects.get(accountId) || 0) + 1;
    this.reconnects.set(accountId, attempt);
    if (attempt > MAX_RECONNECTS) {
      await pauseAccount(accountId, `Lost connection to WhatsApp (code ${code ?? 'unknown'}) and could not reconnect.`, 'error');
      return;
    }
    const delay = code === DisconnectReason.restartRequired ? 500 : Math.min(60_000, 2000 * 2 ** (attempt - 1));
    console.log(`[wa-gateway] ${accountId} closed (code ${code}); reconnecting in ${delay}ms (attempt ${attempt})`);
    setTimeout(() => this.connect(accountId).catch((err) => console.error(`[wa-gateway] reconnect ${accountId}: ${err.message}`)), delay);
  }

  async logout(accountId: string, deleting = false) {
    const session = this.sessions.get(accountId);
    if (session) {
      session.closing = true;
      try { await session.sock.logout(); } catch { session.sock.end(undefined); }
      await session.clear().catch(() => {});
      this.sessions.delete(accountId);
    } else if (!deleting) {
      await db('whatsapp_session_keys').where('account_id', accountId).delete();
    }
    await redis.del(`wa:qr:${accountId}`);
  }

  getSender(accountId: string): WhatsAppSender | null {
    const session = this.sessions.get(accountId);
    if (!session?.open) return null;
    const sock = session.sock;
    return {
      provider: 'web_qr',
      async send(message: OutboundMessage): Promise<SendResult> {
        const waId = e164ToWaId(message.to);
        // Only message numbers that are actually on WhatsApp — sending to non-users is a strong spam signal
        const [check] = (await sock.onWhatsApp(waId)) || [];
        if (!check?.exists) throw new WhatsAppApiError('This number is not on WhatsApp', 404, undefined, true);
        const jid = check.jid;
        let content: any;
        switch (message.type) {
          case 'image': content = { image: { url: message.media!.url }, caption: message.body || undefined }; break;
          case 'video': content = { video: { url: message.media!.url }, caption: message.body || undefined }; break;
          case 'document':
            content = {
              document: { url: message.media!.url },
              fileName: message.media!.filename || 'document',
              mimetype: message.media!.mime || 'application/pdf',
              caption: message.body || undefined,
            };
            break;
          default: content = { text: message.body || '' };
        }
        try {
          const sent = await sock.sendMessage(jid, content);
          if (!sent?.key?.id) throw new WhatsAppApiError('WhatsApp did not accept the message', 502);
          return { providerMessageId: sent.key.id };
        } catch (err: any) {
          if (err instanceof WhatsAppApiError) throw err;
          throw new WhatsAppApiError(err?.message || 'Send failed', err?.output?.statusCode || 500);
        }
      },
    };
  }

  async stopAll() {
    for (const [, session] of this.sessions) {
      session.closing = true;
      session.sock.end(undefined);
    }
    this.sessions.clear();
  }
}
