import crypto from 'crypto';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { toE164 } from '../../shared/utils/phone.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import { checkContactLimit, checkWhatsAppLimit } from '../usage/usage.service.js';
import { getAccountRow, upsertConversation } from './whatsapp.shared.js';
import {
  buildTemplateParams, fillTemplateBody, renderMessage, withinServiceWindow, type ContactLike,
} from './whatsapp.utils.js';
import type { ReplyInput, SendMessageInput } from './whatsapp.schema.js';

interface QueueOptions {
  orgId: string;
  account: any;
  phoneE164: string;
  contact: (ContactLike & { id?: string; whatsapp_opt_out?: boolean }) | null;
  body?: string | null;
  media?: { type: string; url: string; filename?: string } | null;
  templateId?: string | null;
  variableMapping?: Record<string, string>;
  sentBy: 'user' | 'campaign' | 'ai' | 'api' | 'system';
  userId?: string | null;
  campaignId?: string | null;
  /** Enforce Meta's 24h rule for free-form messages (off for campaign expansion, which checks templates up front) */
  enforceWindow?: boolean;
}

/** Resolve the text / template payload for one recipient. Shared by single sends, replies, AI and campaigns. */
export async function buildOutbound(opts: Pick<QueueOptions, 'orgId' | 'account' | 'contact' | 'body' | 'media' | 'templateId' | 'variableMapping'>) {
  const contact: ContactLike = opts.contact || {};
  if (opts.templateId) {
    const template = await db('whatsapp_templates').where({ id: opts.templateId, org_id: opts.orgId }).first();
    if (!template) throw new AppError(404, 'Template not found');
    if (template.source === 'meta') {
      if (opts.account.provider !== 'meta_cloud') throw new AppError(400, 'Meta templates can only be sent from a Meta Cloud API number');
      if (template.status !== 'APPROVED') throw new AppError(400, `Template "${template.name}" is ${template.status}, not APPROVED`);
      const params = buildTemplateParams(opts.variableMapping || {}, contact);
      return {
        type: 'template' as const,
        body: fillTemplateBody(template.body, params),
        template: { name: template.name, language: template.language, params, headerMedia: opts.media ? { kind: opts.media.type, url: opts.media.url, filename: opts.media.filename } : undefined },
        media: opts.media || null,
      };
    }
    return {
      type: (opts.media?.type || 'text') as string,
      body: renderMessage(template.body, contact),
      template: null,
      media: opts.media || null,
    };
  }
  return {
    type: (opts.media?.type || 'text') as string,
    body: opts.body ? renderMessage(opts.body, contact) : null,
    template: null,
    media: opts.media || null,
  };
}

export async function queueOutbound(opts: QueueOptions) {
  if (opts.contact?.whatsapp_opt_out) throw new AppError(400, 'This contact has opted out of WhatsApp messages');
  const conversation = await upsertConversation(opts.orgId, opts.account.id, opts.phoneE164, { contact_id: opts.contact?.id ?? null });

  const outbound = await buildOutbound(opts);
  if (opts.enforceWindow !== false && opts.account.provider === 'meta_cloud' && outbound.type !== 'template'
    && !withinServiceWindow(conversation.last_inbound_at)) {
    throw new AppError(400, 'This customer has not messaged you in the last 24 hours. Meta only allows an approved template here.');
  }

  const [message] = await db('whatsapp_messages').insert({
    org_id: opts.orgId,
    account_id: opts.account.id,
    conversation_id: conversation.id,
    campaign_id: opts.campaignId ?? null,
    contact_id: opts.contact?.id ?? conversation.contact_id ?? null,
    phone_e164: opts.phoneE164,
    direction: 'out',
    type: outbound.type,
    body: outbound.body,
    media: outbound.media ? JSON.stringify(outbound.media) : null,
    template: outbound.template ? JSON.stringify(outbound.template) : null,
    status: 'queued',
    sent_by: opts.sentBy,
    user_id: opts.userId ?? null,
  }).returning('*');
  return message;
}

function assertSendable(account: any) {
  if (account.status !== 'connected') {
    throw new AppError(400, `WhatsApp number "${account.name}" is ${account.status.replace('_', ' ')}. Reconnect it first.`);
  }
}

/** Send one message to a contact or phone number (queued; the gateway dispatcher paces delivery). */
export async function sendSingle(orgId: string, userId: string, input: SendMessageInput) {
  const account = await getAccountRow(orgId, input.account_id);
  assertSendable(account);
  await checkWhatsAppLimit(orgId, 1);

  let contact: any = null;
  let phone: string | null = null;
  if (input.contact_id) {
    contact = await db('contacts').where({ id: input.contact_id, org_id: orgId }).first();
    if (!contact) throw new AppError(404, 'Contact not found');
    phone = contact.phone_e164 || toE164(contact.phone, contact.country_code || 'IN');
    if (!phone) throw new AppError(400, 'This contact has no valid mobile number');
  } else {
    phone = toE164(input.phone, 'IN');
    if (!phone) throw new AppError(400, 'Enter a valid mobile number, e.g. +91 98765 43210');
    contact = await db('contacts').where({ org_id: orgId, phone_e164: phone }).first() || null;
  }

  return queueOutbound({
    orgId, account, phoneE164: phone, contact,
    body: input.body, media: input.media, templateId: input.template_id, variableMapping: input.variable_mapping,
    sentBy: 'user', userId,
  });
}

// ─── Inbox ───

export async function listConversations(orgId: string, pagination: PaginationParams, filters: {
  account_id?: string; status?: string; unread?: boolean; search?: string;
}) {
  const base = db('whatsapp_conversations as c')
    .leftJoin('contacts as ct', 'ct.id', 'c.contact_id')
    .leftJoin('whatsapp_accounts as a', 'a.id', 'c.account_id')
    .where('c.org_id', orgId);
  if (filters.account_id) base.where('c.account_id', filters.account_id);
  if (filters.status) base.where('c.status', filters.status);
  if (filters.unread) base.where('c.unread_count', '>', 0);
  if (filters.search) {
    const s = `%${filters.search}%`;
    base.where((b) => b.whereILike('c.phone_e164', s).orWhereILike('c.profile_name', s)
      .orWhereILike('ct.first_name', s).orWhereILike('ct.last_name', s).orWhereILike('ct.email', s));
  }
  const [{ count }] = await base.clone().count('c.id as count');
  const data = await base
    .select('c.*', 'ct.first_name', 'ct.last_name', 'ct.email', 'a.name as account_name', 'a.provider as account_provider')
    .orderByRaw('c.last_message_at DESC NULLS LAST')
    .limit(pagination.per_page)
    .offset(pagination.offset);
  return { data, total: Number(count) };
}

export async function getConversation(orgId: string, conversationId: string) {
  const conversation = await db('whatsapp_conversations as c')
    .leftJoin('contacts as ct', 'ct.id', 'c.contact_id')
    .leftJoin('whatsapp_accounts as a', 'a.id', 'c.account_id')
    .where({ 'c.id': conversationId, 'c.org_id': orgId })
    .select('c.*', 'ct.first_name', 'ct.last_name', 'ct.email', 'ct.whatsapp_opt_out',
      'a.name as account_name', 'a.provider as account_provider', 'a.status as account_status', 'a.ai_enabled')
    .first();
  if (!conversation) throw new AppError(404, 'Conversation not found');
  return { ...conversation, within_service_window: withinServiceWindow(conversation.last_inbound_at) };
}

export async function getConversationMessages(orgId: string, conversationId: string, opts: { before?: string; limit?: number }) {
  await getConversation(orgId, conversationId);
  const q = db('whatsapp_messages').where({ org_id: orgId, conversation_id: conversationId })
    .orderBy('created_at', 'desc')
    .limit(Math.min(opts.limit || 50, 200));
  if (opts.before) q.where('created_at', '<', opts.before);
  const rows = await q;
  await db('whatsapp_conversations').where('id', conversationId).update({ unread_count: 0 });
  return rows.reverse();
}

export async function replyToConversation(orgId: string, userId: string, conversationId: string, input: ReplyInput) {
  const conversation = await getConversation(orgId, conversationId);
  const account = await getAccountRow(orgId, conversation.account_id);
  assertSendable(account);
  await checkWhatsAppLimit(orgId, 1);
  const contact = conversation.contact_id ? await db('contacts').where('id', conversation.contact_id).first() : null;
  const message = await queueOutbound({
    orgId, account, phoneE164: conversation.phone_e164, contact,
    body: input.body, media: input.media, templateId: input.template_id, variableMapping: input.variable_mapping,
    sentBy: 'user', userId,
  });
  // A human replied — keep the bot out of this thread until someone turns it back on
  if (conversation.status === 'needs_human') {
    await db('whatsapp_conversations').where('id', conversationId).update({ status: 'open', updated_at: new Date() });
  }
  return message;
}

export async function updateConversation(orgId: string, conversationId: string, input: { status?: string; ai_paused?: boolean }) {
  await getConversation(orgId, conversationId);
  await db('whatsapp_conversations').where('id', conversationId).update({ ...input, updated_at: new Date() });
  return getConversation(orgId, conversationId);
}

export async function saveConversationContact(orgId: string, conversationId: string, input: {
  email: string; first_name?: string; last_name?: string; list_ids?: string[]; whatsapp_consent?: boolean;
}) {
  const conversation = await getConversation(orgId, conversationId);
  if (conversation.contact_id) throw new AppError(409, 'This conversation is already linked to a contact');
  const emailNormalized = input.email.trim().toLowerCase();
  let contact = await db('contacts').where({ org_id: orgId, email_normalized: emailNormalized }).first();
  if (contact) {
    await db('contacts').where('id', contact.id).update({ phone: conversation.phone_e164, phone_e164: conversation.phone_e164, updated_at: new Date() });
  } else {
    await checkContactLimit(orgId);
    const [first, ...rest] = (conversation.profile_name || '').split(' ');
    [contact] = await db('contacts').insert({
      org_id: orgId,
      email: input.email.trim(),
      email_normalized: emailNormalized,
      first_name: input.first_name ?? (first || null),
      last_name: input.last_name ?? (rest.join(' ') || null),
      phone: conversation.phone_e164,
      phone_e164: conversation.phone_e164,
      source: 'whatsapp',
      preferences_token: crypto.randomBytes(32).toString('hex'),
    }).returning('*');
  }
  for (const listId of input.list_ids || []) {
    const list = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
    if (!list) continue;
    await db('subscriptions').insert({ contact_id: contact.id, list_id: listId }).onConflict(['contact_id', 'list_id']).ignore();
  }
  if (input.whatsapp_consent) {
    await db('consent_records').insert({
      org_id: orgId, contact_id: contact.id, consent_type: 'whatsapp_marketing', status: 'granted',
      source: 'manual', granted_at: new Date(),
    }).catch(() => {});
  }
  await db('whatsapp_conversations').where({ org_id: orgId, phone_e164: conversation.phone_e164 }).update({ contact_id: contact.id });
  await db('whatsapp_messages').where({ org_id: orgId, phone_e164: conversation.phone_e164 }).whereNull('contact_id').update({ contact_id: contact.id });
  return getConversation(orgId, conversationId);
}

/** WhatsApp events for the contact profile timeline. */
export async function getContactWhatsAppActivity(orgId: string, contactId: string, limit = 50) {
  return db('whatsapp_messages as m')
    .leftJoin('whatsapp_campaigns as c', 'c.id', 'm.campaign_id')
    .where({ 'm.org_id': orgId, 'm.contact_id': contactId })
    .select('m.id', 'm.direction', 'm.status', 'm.body', 'm.type', 'm.created_at', 'm.sent_at', 'm.delivered_at', 'm.read_at',
      'm.conversation_id', 'm.campaign_id', 'c.name as campaign_name')
    .orderBy('m.created_at', 'desc')
    .limit(limit);
}
