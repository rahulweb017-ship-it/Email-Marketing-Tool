import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';

// Map automation trigger types to their cancel events
const TRIGGER_CANCEL_MAP: Record<string, string> = {
  mail_opened: 'mail_not_opened',
  mail_clicked: 'mail_not_clicked',
  mail_replied: 'mail_not_replied',
};

interface AutomationEventJob {
  event_type: 'mail_opened' | 'mail_clicked' | 'mail_replied' | 'mail_bounced';
  mailing_trace_id: string;
  contact_id: string;
}

/**
 * Automation Event Processor Worker
 * Mirrors Odoo's process_event (marketing_trace.py:66-125)
 *
 * Phase 3 of 3-phase automation engine:
 * - Triggered in real-time by tracking events (open, click, reply, bounce)
 * - Finds matching child activities with the corresponding trigger type
 * - Schedules new automation traces for those children
 * - CANCELS opposite traces (e.g., mail_opened cancels mail_not_opened)
 * - Bounce cancels ALL non-bounce child traces
 */
async function processEvent(job: Job<AutomationEventJob>) {
  const { event_type, mailing_trace_id, contact_id } = job.data;

  // Find automation traces linked to this mailing trace
  const automationTraces = await db('automation_traces')
    .where('mailing_trace_id', mailing_trace_id)
    .where('state', 'processed');

  for (const autoTrace of automationTraces) {
    try {
      await handleEventForTrace(autoTrace, event_type, contact_id);
    } catch (err) {
      console.error(`Event processing error for trace ${autoTrace.id}:`, (err as Error).message);
    }
  }
}

async function handleEventForTrace(
  parentAutoTrace: { id: string; activity_id: string; participant_id: string },
  eventType: string,
  contactId: string,
) {
  // Find child activities of the parent activity that match this event trigger
  const childActivities = await db('automation_activities')
    .where('parent_id', parentAutoTrace.activity_id);

  for (const child of childActivities) {
    if (child.trigger_type === eventType) {
      // Schedule matching child trace
      const scheduleDate = new Date(
        Date.now() + getIntervalMs(child.interval_number, child.interval_unit),
      );

      // Check if trace already exists to avoid duplicates
      const existing = await db('automation_traces')
        .where({
          participant_id: parentAutoTrace.participant_id,
          activity_id: child.id,
          parent_id: parentAutoTrace.id,
        })
        .first();

      if (!existing) {
        await db('automation_traces').insert({
          id: uuidv4(),
          participant_id: parentAutoTrace.participant_id,
          activity_id: child.id,
          parent_id: parentAutoTrace.id,
          state: 'scheduled',
          schedule_date: scheduleDate,
        });
      }
    }

    // Cancel opposite triggers (mirrors Odoo's cancellation logic)
    // e.g., if mail_opened fires, cancel mail_not_opened
    const cancelTrigger = TRIGGER_CANCEL_MAP[eventType];
    if (cancelTrigger && child.trigger_type === cancelTrigger) {
      await db('automation_traces')
        .where({
          participant_id: parentAutoTrace.participant_id,
          activity_id: child.id,
          state: 'scheduled',
        })
        .update({
          state: 'cancelled',
          state_message: `Cancelled by ${eventType} event`,
        });
    }

    // Bounce cancels ALL non-bounce children
    if (eventType === 'mail_bounced' && child.trigger_type !== 'mail_bounced') {
      await db('automation_traces')
        .where({
          participant_id: parentAutoTrace.participant_id,
          activity_id: child.id,
          state: 'scheduled',
        })
        .update({
          state: 'cancelled',
          state_message: 'Cancelled due to bounce',
        });
    }
  }

  // Check if participant has any remaining scheduled traces
  const remaining = await db('automation_traces')
    .where('participant_id', parentAutoTrace.participant_id)
    .where('state', 'scheduled')
    .count('* as count')
    .first();

  if (Number(remaining?.count) === 0) {
    await db('automation_participants')
      .where('id', parentAutoTrace.participant_id)
      .update({ state: 'completed', completed_at: new Date() });
  }
}

function getIntervalMs(number: number, unit: string): number {
  switch (unit) {
    case 'minutes': return number * 60 * 1000;
    case 'hours': return number * 60 * 60 * 1000;
    case 'days': return number * 24 * 60 * 60 * 1000;
    case 'weeks': return number * 7 * 24 * 60 * 60 * 1000;
    case 'months': return number * 30 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

export function createAutomationEventWorker() {
  return new Worker('automation-event', processEvent, {
    connection: redis,
    concurrency: 5,
  });
}
