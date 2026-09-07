import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { CreateCustomFieldInput, UpdateCustomFieldInput } from './custom-fields.schema.js';

export async function listCustomFields(orgId: string) {
  return db('custom_fields')
    .where('org_id', orgId)
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc');
}

export async function createCustomField(orgId: string, input: CreateCustomFieldInput) {
  const existing = await db('custom_fields')
    .where({ org_id: orgId, field_key: input.field_key })
    .first();
  if (existing) {
    throw new AppError(409, `A custom field with key "${input.field_key}" already exists`);
  }

  const id = uuidv4();
  await db('custom_fields').insert({
    id,
    org_id: orgId,
    name: input.name,
    field_key: input.field_key,
    field_type: input.field_type,
    options: input.options ? JSON.stringify(input.options) : null,
    is_required: input.is_required ?? false,
    sort_order: input.sort_order ?? 0,
  });

  return db('custom_fields').where('id', id).first();
}

export async function updateCustomField(orgId: string, fieldId: string, input: UpdateCustomFieldInput) {
  const field = await db('custom_fields').where({ id: fieldId, org_id: orgId }).first();
  if (!field) throw new AppError(404, 'Custom field not found');

  if (input.field_key && input.field_key !== field.field_key) {
    const existing = await db('custom_fields')
      .where({ org_id: orgId, field_key: input.field_key })
      .whereNot('id', fieldId)
      .first();
    if (existing) {
      throw new AppError(409, `A custom field with key "${input.field_key}" already exists`);
    }
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.field_key !== undefined) updates.field_key = input.field_key;
  if (input.field_type !== undefined) updates.field_type = input.field_type;
  if (input.options !== undefined) updates.options = JSON.stringify(input.options);
  if (input.is_required !== undefined) updates.is_required = input.is_required;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('custom_fields').where({ id: fieldId }).update(updates);
  }

  return db('custom_fields').where('id', fieldId).first();
}

export async function deleteCustomField(orgId: string, fieldId: string) {
  const deleted = await db('custom_fields').where({ id: fieldId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Custom field not found');
}

export async function getContactCustomFieldValues(contactId: string) {
  return db('contact_custom_field_values')
    .join('custom_fields', 'contact_custom_field_values.custom_field_id', 'custom_fields.id')
    .where('contact_custom_field_values.contact_id', contactId)
    .select(
      'custom_fields.field_key',
      'custom_fields.name',
      'custom_fields.field_type',
      'contact_custom_field_values.value',
    );
}

export async function setContactCustomFieldValues(contactId: string, orgId: string, values: Record<string, string>) {
  const fields = await db('custom_fields').where('org_id', orgId);
  const fieldMap = new Map(fields.map((f: { field_key: string; id: string }) => [f.field_key, f.id]));

  for (const [key, value] of Object.entries(values)) {
    const fieldId = fieldMap.get(key);
    if (!fieldId) continue;

    const existing = await db('contact_custom_field_values')
      .where({ contact_id: contactId, custom_field_id: fieldId })
      .first();

    if (existing) {
      await db('contact_custom_field_values')
        .where({ contact_id: contactId, custom_field_id: fieldId })
        .update({ value, updated_at: new Date() });
    } else {
      await db('contact_custom_field_values').insert({
        id: uuidv4(),
        contact_id: contactId,
        custom_field_id: fieldId,
        value,
      });
    }
  }
}
