import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateTemplateInput, UpdateTemplateInput } from './template.schema.js';

export async function listTemplates(orgId: string, pagination: PaginationParams, filters?: { search?: string; is_favorite?: boolean; category?: string }) {
  let query = db('email_templates').where('org_id', orgId);
  let countQuery = db('email_templates').where('org_id', orgId);

  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.whereILike('name', s);
    countQuery = countQuery.whereILike('name', s);
  }

  if (filters?.is_favorite !== undefined) {
    query = query.where('is_favorite', filters.is_favorite);
    countQuery = countQuery.where('is_favorite', filters.is_favorite);
  }

  if (filters?.category) {
    query = query.where('category', filters.category);
    countQuery = countQuery.where('category', filters.category);
  }

  const [{ count }] = await countQuery.count('* as count');
  const data = await query
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getTemplate(orgId: string, templateId: string) {
  const template = await db('email_templates').where({ id: templateId, org_id: orgId }).first();
  if (!template) throw new AppError(404, 'Template not found');
  return template;
}

export async function createTemplate(orgId: string, input: CreateTemplateInput) {
  const id = uuidv4();
  await db('email_templates').insert({
    id,
    org_id: orgId,
    name: input.name,
    subject: input.subject || null,
    body_html: input.body_html || null,
    body_design: input.body_design ? JSON.stringify(input.body_design) : null,
    thumbnail_url: input.thumbnail_url || null,
    is_favorite: input.is_favorite,
    category: input.category || null,
  });
  return getTemplate(orgId, id);
}

export async function updateTemplate(orgId: string, templateId: string, input: UpdateTemplateInput) {
  const existing = await db('email_templates').where({ id: templateId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Template not found');

  // Save a version snapshot before updating (only if body content is changing)
  if (input.body_html !== undefined || input.body_design !== undefined) {
    await saveVersionSnapshot(orgId, templateId, existing);
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.subject !== undefined) updates.subject = input.subject || null;
  if (input.body_html !== undefined) updates.body_html = input.body_html || null;
  if (input.body_design !== undefined) updates.body_design = input.body_design ? JSON.stringify(input.body_design) : null;
  if (input.thumbnail_url !== undefined) updates.thumbnail_url = input.thumbnail_url || null;
  if (input.is_favorite !== undefined) updates.is_favorite = input.is_favorite;
  if (input.category !== undefined) updates.category = input.category || null;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('email_templates').where({ id: templateId }).update(updates);
  }

  return getTemplate(orgId, templateId);
}

export async function deleteTemplate(orgId: string, templateId: string) {
  const deleted = await db('email_templates').where({ id: templateId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Template not found');
}

export async function duplicateTemplate(orgId: string, templateId: string) {
  const original = await db('email_templates').where({ id: templateId, org_id: orgId }).first();
  if (!original) throw new AppError(404, 'Template not found');

  const newId = uuidv4();
  const { id, created_at, updated_at, ...rest } = original;
  await db('email_templates').insert({
    ...rest,
    id: newId,
    name: `${original.name} (Copy)`,
  });

  return getTemplate(orgId, newId);
}

// ---- Template Version History ----

async function saveVersionSnapshot(
  orgId: string,
  templateId: string,
  existing: Record<string, unknown>,
) {
  // Get the next version number
  const [{ max_version }] = await db('template_versions')
    .where({ template_id: templateId, org_id: orgId })
    .max('version_number as max_version');

  const versionNumber = (max_version || 0) + 1;

  await db('template_versions').insert({
    id: uuidv4(),
    org_id: orgId,
    template_id: templateId,
    version_number: versionNumber,
    name: existing.name,
    subject: existing.subject,
    body_html: existing.body_html,
    body_design: existing.body_design,
  });
}

export async function listVersions(orgId: string, templateId: string, pagination: PaginationParams) {
  // Verify template exists
  const template = await db('email_templates').where({ id: templateId, org_id: orgId }).first();
  if (!template) throw new AppError(404, 'Template not found');

  const [{ count }] = await db('template_versions')
    .where({ template_id: templateId, org_id: orgId })
    .count('* as count');

  const data = await db('template_versions')
    .where({ template_id: templateId, org_id: orgId })
    .orderBy('version_number', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset)
    .select('id', 'version_number', 'name', 'subject', 'created_at');

  return { data, total: Number(count) };
}

export async function getVersion(orgId: string, templateId: string, versionId: string) {
  const version = await db('template_versions')
    .where({ id: versionId, template_id: templateId, org_id: orgId })
    .first();
  if (!version) throw new AppError(404, 'Version not found');
  return version;
}

export async function restoreVersion(orgId: string, templateId: string, versionId: string) {
  const version = await db('template_versions')
    .where({ id: versionId, template_id: templateId, org_id: orgId })
    .first();
  if (!version) throw new AppError(404, 'Version not found');

  const existing = await db('email_templates').where({ id: templateId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Template not found');

  // Save current state as a new version before restoring
  await saveVersionSnapshot(orgId, templateId, existing);

  // Restore the version's content
  await db('email_templates').where({ id: templateId }).update({
    body_html: version.body_html,
    body_design: version.body_design,
    updated_at: new Date(),
  });

  return getTemplate(orgId, templateId);
}
