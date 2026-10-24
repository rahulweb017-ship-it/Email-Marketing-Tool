import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { createProviderFromConfig, getSendingConfig } from '../sending/sending-config.service.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateListInput, UpdateListInput } from './list.schema.js';

export async function listMailingLists(orgId: string, pagination: PaginationParams) {
  const [{ count }] = await db('mailing_lists').where('org_id', orgId).count('* as count');
  const data = await db('mailing_lists')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getMailingList(orgId: string, listId: string) {
  const list = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
  if (!list) throw new AppError(404, 'Mailing list not found');
  return list;
}

export async function createMailingList(orgId: string, input: CreateListInput) {
  const id = uuidv4();
  await db('mailing_lists').insert({
    id,
    org_id: orgId,
    name: input.name,
    description: input.description || null,
    is_public: input.is_public,
    is_double_optin: input.is_double_optin,
  });
  return getMailingList(orgId, id);
}

export async function updateMailingList(orgId: string, listId: string, input: UpdateListInput) {
  const existing = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Mailing list not found');

  await db('mailing_lists').where({ id: listId }).update({
    ...input,
    updated_at: new Date(),
  });
  return getMailingList(orgId, listId);
}

export async function deleteMailingList(orgId: string, listId: string) {
  const deleted = await db('mailing_lists').where({ id: listId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Mailing list not found');
}

export async function addSubscribers(orgId: string, listId: string, contactIds: string[]) {
  const list = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
  if (!list) throw new AppError(404, 'Mailing list not found');

  // Verify contacts belong to org
  const contacts = await db('contacts').whereIn('id', contactIds).where('org_id', orgId).select('id', 'email', 'first_name');
  const contactMap = new Map(contacts.map((c: { id: string; email: string; first_name: string | null }) => [c.id, c]));

  let added = 0;
  for (const contactId of contactIds) {
    const contact = contactMap.get(contactId);
    if (!contact) continue;

    const existing = await db('subscriptions').where({ contact_id: contactId, list_id: listId }).first();
    if (existing) {
      if (existing.opt_out) {
        await db('subscriptions').where('id', existing.id).update({
          opt_out: false,
          opt_out_at: null,
          status: list.is_double_optin ? 'pending' : 'active',
          confirmation_token: list.is_double_optin ? crypto.randomBytes(32).toString('hex') : null,
          confirmed_at: list.is_double_optin ? null : new Date(),
        });
        if (list.is_double_optin) {
          const updatedSub = await db('subscriptions').where({ contact_id: contactId, list_id: listId }).first();
          await sendConfirmationEmail(orgId, contact.email, contact.first_name, list.name, updatedSub.confirmation_token);
        }
        added++;
      }
      continue;
    }

    const token = list.is_double_optin ? crypto.randomBytes(32).toString('hex') : null;
    await db('subscriptions').insert({
      id: uuidv4(),
      contact_id: contactId,
      list_id: listId,
      status: list.is_double_optin ? 'pending' : 'active',
      confirmation_token: token,
      confirmed_at: list.is_double_optin ? null : new Date(),
    });

    if (list.is_double_optin && token) {
      await sendConfirmationEmail(orgId, contact.email, contact.first_name, list.name, token);
    }

    added++;
  }

  await refreshListCounts(listId);
  return { added, total: contactIds.length };
}

export async function removeSubscriber(orgId: string, listId: string, contactId: string) {
  const list = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
  if (!list) throw new AppError(404, 'Mailing list not found');

  const deleted = await db('subscriptions').where({ contact_id: contactId, list_id: listId }).del();
  if (!deleted) throw new AppError(404, 'Subscription not found');

  await refreshListCounts(listId);
}

export async function unsubscribe(listId: string, contactId: string, reasonId?: string) {
  const sub = await db('subscriptions').where({ contact_id: contactId, list_id: listId }).first();
  if (!sub) throw new AppError(404, 'Subscription not found');

  await db('subscriptions').where('id', sub.id).update({
    opt_out: true,
    opt_out_at: new Date(),
    opt_out_reason_id: reasonId || null,
    status: 'unsubscribed',
  });

  await refreshListCounts(listId);
}

export async function confirmSubscription(token: string) {
  const sub = await db('subscriptions').where({ confirmation_token: token }).first();
  if (!sub) throw new AppError(404, 'Invalid or expired confirmation token');
  if (sub.confirmed_at) throw new AppError(400, 'Subscription already confirmed');

  await db('subscriptions').where('id', sub.id).update({
    status: 'active',
    confirmed_at: new Date(),
    confirmation_token: null,
  });

  await refreshListCounts(sub.list_id);
  return { confirmed: true };
}

export async function getSubscribers(orgId: string, listId: string, pagination: PaginationParams, filters?: { opt_out?: boolean }) {
  const list = await db('mailing_lists').where({ id: listId, org_id: orgId }).first();
  if (!list) throw new AppError(404, 'Mailing list not found');

  let query = db('contacts')
    .join('subscriptions', 'contacts.id', 'subscriptions.contact_id')
    .where('subscriptions.list_id', listId);

  let countQuery = db('subscriptions').where('list_id', listId);

  if (filters?.opt_out !== undefined) {
    query = query.where('subscriptions.opt_out', filters.opt_out);
    countQuery = countQuery.where('opt_out', filters.opt_out);
  }

  const [{ count }] = await countQuery.count('* as count');
  const data = await query
    .select('contacts.*', 'subscriptions.opt_out', 'subscriptions.opt_out_at', 'subscriptions.status as subscription_status', 'subscriptions.confirmed_at', 'subscriptions.created_at as subscribed_at')
    .orderBy('subscriptions.created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function refreshListCounts(listId: string) {
  const [stats] = await db('subscriptions')
    .where('list_id', listId)
    .select(
      db.raw('COUNT(*) as total'),
      db.raw("COUNT(*) FILTER (WHERE opt_out = false AND status = 'active') as active"),
      db.raw("COUNT(*) FILTER (WHERE opt_out = true) as opted_out"),
    );

  const [{ count: blacklisted }] = await db('subscriptions')
    .join('contacts', 'contacts.id', 'subscriptions.contact_id')
    .where('subscriptions.list_id', listId)
    .where('contacts.is_blacklisted', true)
    .count('* as count');

  await db('mailing_lists').where('id', listId).update({
    contact_count: stats.total,
    contact_count_active: stats.active,
    contact_count_opt_out: stats.opted_out,
    contact_count_blacklisted: Number(blacklisted),
    updated_at: new Date(),
  });
}

export async function listUnsubscribeReasons(orgId: string) {
  return db('unsubscribe_reasons').where('org_id', orgId).orderBy('sequence', 'asc');
}

async function sendConfirmationEmail(orgId: string, contactEmail: string, contactName: string | null, listName: string, token: string) {
  try {
    // Get the org's default sending config
    const configRow = await db('sending_configs').where({ org_id: orgId, is_default: true, is_active: true }).first();
    if (!configRow) {
      // Try any active config
      const anyConfig = await db('sending_configs').where({ org_id: orgId, is_active: true }).first();
      if (!anyConfig) return; // Can't send without a config
      const config = await getSendingConfig(orgId, anyConfig.id);
      return await doSendConfirmation(config, contactEmail, contactName, listName, token);
    }
    const config = await getSendingConfig(orgId, configRow.id);
    await doSendConfirmation(config, contactEmail, contactName, listName, token);
  } catch (err) {
    console.error('Failed to send confirmation email:', err);
  }
}

async function doSendConfirmation(config: Record<string, unknown>, contactEmail: string, contactName: string | null, listName: string, token: string) {
  const provider = createProviderFromConfig(config);
  const frontendUrl = env.FRONTEND_URL;
  const confirmUrl = `${frontendUrl}/confirm/${token}`;
  const settings = config.settings as Record<string, unknown>;
  const fromEmail = (settings.from_email as string) || (settings.username as string) || 'noreply@example.com';
  const fromName = (settings.from_name as string) || 'Rabbit Growth';

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1f2937;">Confirm your subscription</h2>
    <p>Hi ${contactName || 'there'},</p>
    <p>Please confirm your subscription to <strong>${listName}</strong> by clicking the button below:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${confirmUrl}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Confirm Subscription</a>
    </p>
    <p style="color: #666; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
  </div>`;

  await provider.send({
    from: `${fromName} <${fromEmail}>`,
    to: contactEmail,
    subject: `Confirm your subscription to ${listName}`,
    html,
    text: `Hi ${contactName || 'there'}, please confirm your subscription to ${listName} by visiting: ${confirmUrl}`,
  });
}
