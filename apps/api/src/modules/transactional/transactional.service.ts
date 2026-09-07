import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { getSendingConfig, createProviderFromConfig } from '../sending/sending-config.service.js';
import { checkEmailLimit, incrementEmailCounter } from '../usage/usage.service.js';
import type { z } from 'zod';
import type {
  createTransactionalTemplateSchema,
  updateTransactionalTemplateSchema,
  sendTransactionalSchema,
} from './transactional.schema.js';

type CreateTemplateInput = z.infer<typeof createTransactionalTemplateSchema>;
type UpdateTemplateInput = z.infer<typeof updateTransactionalTemplateSchema>;
type SendInput = z.infer<typeof sendTransactionalSchema>;

// ── Templates ──────────────────────────────────────────────

export async function listTemplates(orgId: string) {
  return db('transactional_templates')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc');
}

export async function createTemplate(orgId: string, input: CreateTemplateInput) {
  const id = uuidv4();
  await db('transactional_templates').insert({
    id,
    org_id: orgId,
    name: input.name,
    subject: input.subject,
    body_html: input.body_html,
    body_design: input.body_design ? JSON.stringify(input.body_design) : null,
    variables: JSON.stringify(input.variables ?? []),
  });
  return db('transactional_templates').where('id', id).first();
}

export async function updateTemplate(orgId: string, id: string, input: UpdateTemplateInput) {
  const existing = await db('transactional_templates').where({ id, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Template not found');

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.subject !== undefined) updates.subject = input.subject;
  if (input.body_html !== undefined) updates.body_html = input.body_html;
  if (input.body_design !== undefined) updates.body_design = input.body_design ? JSON.stringify(input.body_design) : null;
  if (input.variables !== undefined) updates.variables = JSON.stringify(input.variables);

  await db('transactional_templates').where({ id, org_id: orgId }).update(updates);
  return db('transactional_templates').where('id', id).first();
}

export async function deleteTemplate(orgId: string, id: string) {
  const deleted = await db('transactional_templates').where({ id, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Template not found');
}

// ── Sending ────────────────────────────────────────────────

function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

export async function sendTransactionalEmail(orgId: string, input: SendInput) {
  // Check email limits
  await checkEmailLimit(orgId, 1);

  // Resolve template if provided
  let resolvedSubject = input.subject;
  let resolvedHtml = input.body_html;
  let templateId: string | null = null;

  if (input.template_name) {
    const template = await db('transactional_templates')
      .where({ org_id: orgId, name: input.template_name })
      .first();
    if (!template) throw new AppError(404, `Template "${input.template_name}" not found`);
    templateId = template.id;
    if (!resolvedSubject) resolvedSubject = template.subject;
    if (!resolvedHtml) resolvedHtml = template.body_html;
  }

  if (!resolvedSubject) throw new AppError(400, 'Subject is required (provide directly or via template)');
  if (!resolvedHtml) throw new AppError(400, 'body_html is required (provide directly or via template)');

  // Replace variables
  const vars = input.variables ?? {};
  resolvedSubject = replaceVariables(resolvedSubject, vars);
  resolvedHtml = replaceVariables(resolvedHtml, vars);

  // Find sending config
  let config: Record<string, unknown>;
  if (input.sending_config_id) {
    config = await getSendingConfig(orgId, input.sending_config_id);
  } else {
    const defaultConfig = await db('sending_configs')
      .where({ org_id: orgId, is_default: true, is_active: true })
      .first();
    if (!defaultConfig) throw new AppError(400, 'No default sending config found. Provide sending_config_id or set a default.');
    config = await getSendingConfig(orgId, defaultConfig.id);
  }

  const provider = createProviderFromConfig(config);
  const settings = config.settings as Record<string, unknown>;
  const fromAddress = (settings.from_email as string) || (settings.username as string) || 'noreply@example.com';

  const messageId = uuidv4();

  try {
    const result = await provider.send({
      from: fromAddress,
      to: input.to_name ? `"${input.to_name}" <${input.to}>` : input.to,
      subject: resolvedSubject,
      html: resolvedHtml,
    });

    // Record message
    await db('transactional_messages').insert({
      id: messageId,
      org_id: orgId,
      template_id: templateId,
      to_email: input.to,
      to_name: input.to_name ?? null,
      subject: resolvedSubject,
      status: result.success ? 'sent' : 'failed',
      sending_config_id: config.id as string,
      variables: JSON.stringify(vars),
      error_message: result.error ?? null,
      sent_at: result.success ? new Date() : null,
    });

    if (result.success) {
      await incrementEmailCounter(orgId);
    }

    return { id: messageId, status: result.success ? 'sent' : 'failed', error: result.error };
  } catch (err) {
    const errorMsg = (err as Error).message;
    await db('transactional_messages').insert({
      id: messageId,
      org_id: orgId,
      template_id: templateId,
      to_email: input.to,
      to_name: input.to_name ?? null,
      subject: resolvedSubject,
      status: 'failed',
      sending_config_id: config.id as string,
      variables: JSON.stringify(vars),
      error_message: errorMsg,
      sent_at: null,
    });
    return { id: messageId, status: 'failed', error: errorMsg };
  }
}

export async function sendBatchTransactional(orgId: string, messages: SendInput[]) {
  await checkEmailLimit(orgId, messages.length);

  const results = [];
  for (const msg of messages) {
    const result = await sendTransactionalEmail(orgId, msg);
    results.push(result);
  }
  return results;
}

// ── Message Log ────────────────────────────────────────────

export async function listMessages(orgId: string, params: { page?: number; per_page?: number; status?: string }) {
  const page = params.page ?? 1;
  const perPage = params.per_page ?? 20;
  const offset = (page - 1) * perPage;

  let query = db('transactional_messages')
    .where('transactional_messages.org_id', orgId);

  if (params.status) {
    query = query.where('transactional_messages.status', params.status);
  }

  const [{ count }] = await query.clone().count('transactional_messages.id as count');

  const messages = await query
    .leftJoin('transactional_templates', 'transactional_templates.id', 'transactional_messages.template_id')
    .select(
      'transactional_messages.*',
      'transactional_templates.name as template_name',
    )
    .orderBy('transactional_messages.created_at', 'desc')
    .limit(perPage)
    .offset(offset);

  return {
    data: messages,
    total: parseInt(String(count), 10),
    page,
    per_page: perPage,
  };
}
