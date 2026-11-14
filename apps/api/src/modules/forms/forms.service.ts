import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { addSubscribers } from '../lists/list.service.js';
import { upsertLead } from '../leads/leads.service.js';
import { setContactCustomFieldValues } from '../custom-fields/custom-fields.service.js';
import type { CreateFormInput, UpdateFormInput, SubmitFormInput } from './forms.schema.js';

export async function listForms(orgId: string) {
  return db('signup_forms')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc');
}

export async function getForm(orgId: string, formId: string) {
  const form = await db('signup_forms').where({ id: formId, org_id: orgId }).first();
  if (!form) throw new AppError(404, 'Signup form not found');
  return form;
}

export async function createForm(orgId: string, input: CreateFormInput) {
  const id = uuidv4();
  await db('signup_forms').insert({
    id,
    org_id: orgId,
    name: input.name,
    description: input.description || null,
    list_ids: JSON.stringify(input.list_ids),
    custom_field_ids: JSON.stringify(input.custom_field_ids || []),
    success_message: input.success_message || 'Thank you for subscribing!',
    redirect_url: input.redirect_url || null,
    style: JSON.stringify(input.style || {}),
    honeypot_enabled: input.honeypot_enabled ?? true,
    double_optin: input.double_optin ?? true,
    status: input.status || 'active',
  });
  return db('signup_forms').where('id', id).first();
}

export async function updateForm(orgId: string, formId: string, input: UpdateFormInput) {
  const form = await db('signup_forms').where({ id: formId, org_id: orgId }).first();
  if (!form) throw new AppError(404, 'Signup form not found');

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description || null;
  if (input.list_ids !== undefined) updates.list_ids = JSON.stringify(input.list_ids);
  if (input.custom_field_ids !== undefined) updates.custom_field_ids = JSON.stringify(input.custom_field_ids);
  if (input.success_message !== undefined) updates.success_message = input.success_message;
  if (input.redirect_url !== undefined) updates.redirect_url = input.redirect_url || null;
  if (input.style !== undefined) updates.style = JSON.stringify(input.style);
  if (input.honeypot_enabled !== undefined) updates.honeypot_enabled = input.honeypot_enabled;
  if (input.double_optin !== undefined) updates.double_optin = input.double_optin;
  if (input.status !== undefined) updates.status = input.status;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('signup_forms').where({ id: formId }).update(updates);
  }

  return db('signup_forms').where('id', formId).first();
}

export async function deleteForm(orgId: string, formId: string) {
  const deleted = await db('signup_forms').where({ id: formId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Signup form not found');
}

export async function getPublicForm(formId: string) {
  const form = await db('signup_forms').where({ id: formId, status: 'active' }).first();
  if (!form) throw new AppError(404, 'Form not found or inactive');

  // Get custom fields info for the form
  const customFieldIds = typeof form.custom_field_ids === 'string'
    ? JSON.parse(form.custom_field_ids)
    : (form.custom_field_ids || []);

  let customFields: Array<Record<string, unknown>> = [];
  if (customFieldIds.length > 0) {
    customFields = await db('custom_fields')
      .whereIn('id', customFieldIds)
      .select('id', 'name', 'field_key', 'field_type', 'options', 'is_required')
      .orderBy('sort_order', 'asc');
  }

  // Get list names
  const listIds = typeof form.list_ids === 'string'
    ? JSON.parse(form.list_ids)
    : (form.list_ids || []);

  let lists: Array<Record<string, unknown>> = [];
  if (listIds.length > 0) {
    lists = await db('mailing_lists')
      .whereIn('id', listIds)
      .select('id', 'name');
  }

  return {
    id: form.id,
    name: form.name,
    description: form.description,
    success_message: form.success_message,
    redirect_url: form.redirect_url,
    style: typeof form.style === 'string' ? JSON.parse(form.style) : (form.style || {}),
    honeypot_enabled: form.honeypot_enabled,
    custom_fields: customFields,
    lists,
  };
}

export async function submitForm(formId: string, input: SubmitFormInput) {
  const form = await db('signup_forms').where({ id: formId, status: 'active' }).first();
  if (!form) throw new AppError(404, 'Form not found or inactive');

  // Honeypot check
  if (form.honeypot_enabled && input.hp_field) {
    // Silently accept but don't process (bot detected)
    return { success: true, message: form.success_message, redirect_url: form.redirect_url };
  }

  const orgId = form.org_id;
  const listIds: string[] = typeof form.list_ids === 'string'
    ? JSON.parse(form.list_ids)
    : (form.list_ids || []);

  // Find or create contact
  const emailNormalized = input.email.toLowerCase().trim();
  let contact = await db('contacts')
    .where({ org_id: orgId, email_normalized: emailNormalized })
    .first();

  if (!contact) {
    const contactId = uuidv4();
    await db('contacts').insert({
      id: contactId,
      org_id: orgId,
      email: input.email.trim(),
      email_normalized: emailNormalized,
      first_name: input.first_name || null,
      last_name: input.last_name || null,
      status: 'subscribed',
    });
    contact = await db('contacts').where('id', contactId).first();
  } else {
    // Update name if provided and currently empty
    const nameUpdates: Record<string, unknown> = {};
    if (input.first_name && !contact.first_name) nameUpdates.first_name = input.first_name;
    if (input.last_name && !contact.last_name) nameUpdates.last_name = input.last_name;
    if (Object.keys(nameUpdates).length > 0) {
      nameUpdates.updated_at = new Date();
      await db('contacts').where('id', contact.id).update(nameUpdates);
    }
  }

  // Subscribe to each list
  for (const listId of listIds) {
    try {
      await addSubscribers(orgId, listId, [contact.id]);
    } catch {
      // If a list doesn't exist or subscription fails, continue with others
    }
  }

  // Save custom field values if provided
  const customFieldValues = input.custom_fields || {};
  if (Object.keys(customFieldValues).length > 0) {
    await setContactCustomFieldValues(contact.id, orgId, customFieldValues);
  }

  // Increment submit count
  await db('signup_forms').where('id', formId).update({
    submit_count: db.raw('submit_count + 1'),
  });

  await upsertLead(orgId, {
    source: 'email',
    source_detail: `Signup form: ${form.name}`.slice(0, 200),
    name: [input.first_name, input.last_name].filter(Boolean).join(' ') || undefined,
    email: emailNormalized,
    contact_id: contact.id,
  }).catch((err) => console.error('[forms] could not record lead', err.message));

  return {
    success: true,
    message: typeof form.success_message === 'string' ? form.success_message : 'Thank you for subscribing!',
    redirect_url: form.redirect_url || null,
  };
}

export function generateEmbedHtml(form: Record<string, unknown>, apiBaseUrl: string): string {
  const formId = form.id;
  const style = typeof form.style === 'string' ? JSON.parse(form.style as string) : (form.style || {}) as Record<string, string>;
  const primaryColor = style.primary_color || '#4f46e5';
  const bgColor = style.background_color || '#ffffff';
  const customFieldIds: string[] = typeof form.custom_field_ids === 'string'
    ? JSON.parse(form.custom_field_ids as string)
    : ((form.custom_field_ids as string[]) || []);
  const honeypotEnabled = form.honeypot_enabled;

  const submitUrl = `${apiBaseUrl}/api/v1/public/forms/${formId}/submit`;

  let fieldsHtml = '';

  // Email field (always present)
  fieldsHtml += `
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #374151;">Email *</label>
        <input type="email" name="email" required
          style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
      </div>`;

  // First name
  fieldsHtml += `
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #374151;">First Name</label>
        <input type="text" name="first_name"
          style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
      </div>`;

  // Last name
  fieldsHtml += `
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; color: #374151;">Last Name</label>
        <input type="text" name="last_name"
          style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;" />
      </div>`;

  // Honeypot
  const honeypotHtml = honeypotEnabled
    ? `\n      <div style="position: absolute; left: -9999px;" aria-hidden="true"><input type="text" name="hp_field" tabindex="-1" autocomplete="off" /></div>`
    : '';

  return `<!-- Rabbit Growth Signup Form -->
<div id="mf-form-${formId}" style="max-width: 420px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <form action="${submitUrl}" method="POST" style="background: ${bgColor}; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
    ${form.name ? `<h3 style="margin: 0 0 4px 0; font-size: 18px; color: #111827;">${form.name}</h3>` : ''}
    ${form.description ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">${form.description}</p>` : '<div style="margin-bottom: 16px;"></div>'}
${fieldsHtml}${honeypotHtml}
      <button type="submit"
        style="width: 100%; padding: 10px 16px; background: ${primaryColor}; color: #ffffff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;">
        Subscribe
      </button>
    <div id="mf-msg-${formId}" style="margin-top: 12px; font-size: 14px; display: none;"></div>
  </form>
</div>
<script>
(function(){
  var form = document.querySelector('#mf-form-${formId} form');
  var msg = document.getElementById('mf-msg-${formId}');
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var fd = new FormData(form);
    var body = {};
    fd.forEach(function(v,k){ body[k] = v; });
    // Move custom_fields prefix keys into nested object
    var cf = {};
    Object.keys(body).forEach(function(k){
      if(k.startsWith('cf_')){ cf[k.substring(3)] = body[k]; delete body[k]; }
    });
    if(Object.keys(cf).length) body.custom_fields = cf;
    fetch('${submitUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(r){ return r.json(); }).then(function(data){
      if(data.redirect_url){ window.location.href = data.redirect_url; return; }
      msg.style.display = 'block';
      msg.style.color = '#059669';
      msg.textContent = data.message || 'Thank you for subscribing!';
      form.reset();
    }).catch(function(){
      msg.style.display = 'block';
      msg.style.color = '#dc2626';
      msg.textContent = 'Something went wrong. Please try again.';
    });
  });
})();
</script>`;
}
