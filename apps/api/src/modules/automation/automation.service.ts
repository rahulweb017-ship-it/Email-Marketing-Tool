import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateAutomationCampaignInput, UpdateAutomationCampaignInput, CreateActivityInput, UpdateActivityInput } from './automation.schema.js';

// ---- Automation Campaigns ----

export async function listAutomationCampaigns(orgId: string, pagination: PaginationParams) {
  const [{ count }] = await db('automation_campaigns').where('org_id', orgId).count('* as count');
  const data = await db('automation_campaigns')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getAutomationCampaign(orgId: string, campaignId: string) {
  const campaign = await db('automation_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Automation campaign not found');

  const activities = await db('automation_activities')
    .where('campaign_id', campaignId)
    .orderBy('created_at', 'asc');

  return { ...campaign, activities };
}

export async function createAutomationCampaign(orgId: string, input: CreateAutomationCampaignInput) {
  const id = uuidv4();
  await db('automation_campaigns').insert({
    id,
    org_id: orgId,
    name: input.name,
    target_filter: JSON.stringify(input.target_filter),
    unique_field: input.unique_field,
    state: 'draft',
  });
  return getAutomationCampaign(orgId, id);
}

export async function updateAutomationCampaign(orgId: string, campaignId: string, input: UpdateAutomationCampaignInput) {
  const existing = await db('automation_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Automation campaign not found');

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.target_filter !== undefined) updates.target_filter = JSON.stringify(input.target_filter);
  if (input.unique_field !== undefined) updates.unique_field = input.unique_field;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('automation_campaigns').where('id', campaignId).update(updates);
  }

  return getAutomationCampaign(orgId, campaignId);
}

export async function startAutomationCampaign(orgId: string, campaignId: string) {
  const campaign = await db('automation_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Automation campaign not found');
  if (campaign.state !== 'draft') throw new AppError(400, 'Campaign must be in draft state');

  // Verify it has at least one begin activity
  const beginActivity = await db('automation_activities')
    .where({ campaign_id: campaignId, trigger_type: 'begin' })
    .first();

  if (!beginActivity) throw new AppError(400, 'Campaign must have at least one "begin" activity');

  await db('automation_campaigns').where('id', campaignId).update({
    state: 'running',
    updated_at: new Date(),
  });

  return getAutomationCampaign(orgId, campaignId);
}

export async function stopAutomationCampaign(orgId: string, campaignId: string) {
  const campaign = await db('automation_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Automation campaign not found');
  if (campaign.state !== 'running') throw new AppError(400, 'Campaign must be running');

  await db.transaction(async (trx) => {
    await trx('automation_campaigns').where('id', campaignId).update({ state: 'stopped', updated_at: new Date() });
    // Cancel all scheduled traces
    await trx('automation_traces')
      .where('state', 'scheduled')
      .whereIn('participant_id',
        trx('automation_participants').where('campaign_id', campaignId).select('id'),
      )
      .update({ state: 'cancelled' });
  });

  return getAutomationCampaign(orgId, campaignId);
}

export async function deleteAutomationCampaign(orgId: string, campaignId: string) {
  const campaign = await db('automation_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Automation campaign not found');
  if (campaign.state === 'running') throw new AppError(400, 'Stop the campaign before deleting');

  await db('automation_campaigns').where('id', campaignId).del();
}

// ---- Activities ----

export async function createActivity(orgId: string, input: CreateActivityInput) {
  const campaign = await db('automation_campaigns').where({ id: input.campaign_id, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Automation campaign not found');

  const id = uuidv4();
  await db('automation_activities').insert({
    id,
    campaign_id: input.campaign_id,
    parent_id: input.parent_id || null,
    name: input.name,
    activity_type: input.activity_type,
    trigger_type: input.trigger_type,
    interval_number: input.interval_number,
    interval_unit: input.interval_unit,
    has_validity: input.has_validity,
    validity_duration_number: input.validity_duration_number,
    validity_duration_unit: input.validity_duration_unit,
    activity_filter: JSON.stringify(input.activity_filter),
    action_config: JSON.stringify(input.action_config),
    email_template_id: input.email_template_id || null,
    position_x: input.position_x,
    position_y: input.position_y,
    parent_handle: input.parent_handle || null,
  });

  return db('automation_activities').where('id', id).first();
}

export async function updateActivity(orgId: string, activityId: string, input: UpdateActivityInput) {
  const activity = await db('automation_activities').where('id', activityId).first();
  if (!activity) throw new AppError(404, 'Activity not found');

  const campaign = await db('automation_campaigns').where({ id: activity.campaign_id, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');

  const updates: Record<string, unknown> = {};
  const fields = [
    'parent_id', 'name', 'activity_type', 'trigger_type',
    'interval_number', 'interval_unit', 'has_validity',
    'validity_duration_number', 'validity_duration_unit',
    'email_template_id', 'position_x', 'position_y', 'parent_handle',
  ] as const;

  for (const field of fields) {
    if (input[field] !== undefined) updates[field] = input[field] ?? null;
  }
  if (input.activity_filter !== undefined) updates.activity_filter = JSON.stringify(input.activity_filter);
  if (input.action_config !== undefined) updates.action_config = JSON.stringify(input.action_config);

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('automation_activities').where('id', activityId).update(updates);
  }

  return db('automation_activities').where('id', activityId).first();
}

export async function deleteActivity(orgId: string, activityId: string) {
  const activity = await db('automation_activities').where('id', activityId).first();
  if (!activity) throw new AppError(404, 'Activity not found');

  const campaign = await db('automation_campaigns').where({ id: activity.campaign_id, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');

  await db('automation_activities').where('id', activityId).del();
}

// ---- Dropdown data ----

export async function listTags(orgId: string) {
  return db('tags').where('org_id', orgId).select('id', 'name');
}

export async function listMailingLists(orgId: string) {
  return db('mailing_lists').where('org_id', orgId).select('id', 'name');
}

// ---- Participants ----

export async function listParticipants(orgId: string, campaignId: string, pagination: PaginationParams) {
  const campaign = await db('automation_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) throw new AppError(404, 'Campaign not found');

  const [{ count }] = await db('automation_participants').where('campaign_id', campaignId).count('* as count');
  const data = await db('automation_participants')
    .join('contacts', 'contacts.id', 'automation_participants.contact_id')
    .where('automation_participants.campaign_id', campaignId)
    .select('automation_participants.*', 'contacts.email', 'contacts.first_name', 'contacts.last_name')
    .orderBy('automation_participants.entered_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}
