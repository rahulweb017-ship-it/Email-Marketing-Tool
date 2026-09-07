import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';

/**
 * Automation Participant Sync Worker
 * Mirrors Odoo's sync_participants (marketing_campaign.py:330)
 *
 * Phase 1 of 3-phase automation engine:
 * - Runs every 5 minutes
 * - For each running automation campaign, fetch contacts matching target filter
 * - Create automation_participants for new contacts
 * - Create initial automation_traces for 'begin' activities
 * - Mark removed contacts as 'removed' state
 */
async function syncParticipants(job: Job) {
  const runningCampaigns = await db('automation_campaigns').where('state', 'running');

  for (const campaign of runningCampaigns) {
    try {
      await syncCampaignParticipants(campaign);
    } catch (err) {
      console.error(`Automation sync error for campaign ${campaign.id}:`, (err as Error).message);
    }
  }
}

async function syncCampaignParticipants(campaign: {
  id: string;
  org_id: string;
  target_filter: unknown[];
  unique_field: string;
}) {
  // Get existing participant contact IDs
  const existingContactIds = new Set(
    await db('automation_participants')
      .where('campaign_id', campaign.id)
      .pluck('contact_id'),
  );

  // Get contacts matching target filter
  // TODO: Implement proper filter evaluation (for now, get all org contacts)
  let query = db('contacts').where('org_id', campaign.org_id).where('is_blacklisted', false);

  // Apply simple filters if defined
  const filters = Array.isArray(campaign.target_filter) ? campaign.target_filter : [];
  for (const filter of filters as Array<{ field: string; operator: string; value: unknown }>) {
    if (filter.field && filter.operator && filter.value !== undefined) {
      switch (filter.operator) {
        case 'eq': query = query.where(filter.field, filter.value); break;
        case 'neq': query = query.whereNot(filter.field, filter.value); break;
        case 'contains': query = query.whereILike(filter.field, `%${filter.value}%`); break;
        case 'in_list':
          query = query.whereExists(function () {
            this.select('*').from('subscriptions')
              .whereRaw('subscriptions.contact_id = contacts.id')
              .where('subscriptions.list_id', filter.value as string)
              .where('subscriptions.opt_out', false);
          });
          break;
      }
    }
  }

  const matchingContacts = await query.select('id');
  const matchingIds = new Set(matchingContacts.map((c: { id: string }) => c.id));

  // Get 'begin' activities for this campaign
  const beginActivities = await db('automation_activities')
    .where({ campaign_id: campaign.id, trigger_type: 'begin' });

  // Add new participants
  let newCount = 0;
  for (const contact of matchingContacts) {
    if (existingContactIds.has(contact.id)) continue;

    const participantId = uuidv4();

    await db.transaction(async (trx) => {
      await trx('automation_participants').insert({
        id: participantId,
        campaign_id: campaign.id,
        contact_id: contact.id,
        state: 'running',
        entered_at: new Date(),
      });

      // Create initial traces for all 'begin' activities
      for (const activity of beginActivities) {
        const scheduleDate = calculateScheduleDate(activity.interval_number, activity.interval_unit);
        await trx('automation_traces').insert({
          id: uuidv4(),
          participant_id: participantId,
          activity_id: activity.id,
          state: 'scheduled',
          schedule_date: scheduleDate,
        });
      }
    });

    newCount++;
  }

  // Mark removed participants (contacts no longer matching filter)
  const removedIds: string[] = [];
  for (const existingId of existingContactIds) {
    if (!matchingIds.has(existingId)) {
      removedIds.push(existingId);
    }
  }

  if (removedIds.length > 0) {
    await db.transaction(async (trx) => {
      await trx('automation_participants')
        .where('campaign_id', campaign.id)
        .whereIn('contact_id', removedIds)
        .where('state', 'running')
        .update({ state: 'removed' });

      // Cancel their scheduled traces
      const removedParticipantIds = await trx('automation_participants')
        .where('campaign_id', campaign.id)
        .whereIn('contact_id', removedIds)
        .pluck('id');

      await trx('automation_traces')
        .whereIn('participant_id', removedParticipantIds)
        .where('state', 'scheduled')
        .update({ state: 'cancelled' });
    });
  }

  if (newCount > 0 || removedIds.length > 0) {
    // Update denormalized counts
    const [counts] = await db('automation_participants')
      .where('campaign_id', campaign.id)
      .select(
        db.raw("COUNT(*) FILTER (WHERE state = 'running') as running"),
        db.raw("COUNT(*) FILTER (WHERE state = 'completed') as completed"),
      );

    await db('automation_campaigns').where('id', campaign.id).update({
      running_participant_count: counts.running,
      completed_participant_count: counts.completed,
      last_sync_at: new Date(),
      updated_at: new Date(),
    });

    console.log(`Automation ${campaign.id}: +${newCount} participants, -${removedIds.length} removed`);
  }
}

function calculateScheduleDate(intervalNumber: number, intervalUnit: string): Date {
  const now = new Date();
  switch (intervalUnit) {
    case 'minutes': return new Date(now.getTime() + intervalNumber * 60 * 1000);
    case 'hours': return new Date(now.getTime() + intervalNumber * 60 * 60 * 1000);
    case 'days': return new Date(now.getTime() + intervalNumber * 24 * 60 * 60 * 1000);
    case 'weeks': return new Date(now.getTime() + intervalNumber * 7 * 24 * 60 * 60 * 1000);
    case 'months':
      const d = new Date(now);
      d.setMonth(d.getMonth() + intervalNumber);
      return d;
    default: return now;
  }
}

export function createAutomationSyncWorker() {
  return new Worker('automation-sync', syncParticipants, {
    connection: redis,
    concurrency: 1,
  });
}
