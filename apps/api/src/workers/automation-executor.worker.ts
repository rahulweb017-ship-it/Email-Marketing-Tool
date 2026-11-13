import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';

// Map automation trigger types to their cancel events
const TRIGGER_CANCEL_MAP: Record<string, string> = {
  mail_opened: 'mail_not_open',
  mail_clicked: 'mail_not_click',
  mail_replied: 'mail_not_reply',
};

// Trigger types that need rescheduling
const RESCHEDULE_TRIGGER_TYPES = new Set(['begin', 'activity']);


/**
 * Automation Activity Executor Worker
 * Mirrors Odoo's execute() + execute_on_traces() (marketing_activity.py:345-508)
 *
 * Phase 2 of 3-phase automation engine:
 * - Runs every 1 minute
 * - Finds traces where state='scheduled' AND schedule_date <= now()
 * - Checks validity window and applies activity filter
 * - Executes based on type: email, action, etc.
 * - Generates child traces for next steps
 */
async function executeScheduledTraces(job: Job) {
  const now = new Date();

  // Find all scheduled traces ready to execute
  const traces = await db('automation_traces as at')
    .join('automation_activities as aa', 'aa.id', 'at.activity_id')
    .join('automation_participants as ap', 'ap.id', 'at.participant_id')
    .join('automation_campaigns as ac', 'ac.id', 'ap.campaign_id')
    .where('at.state', 'scheduled')
    .where('at.schedule_date', '<=', now)
    .where('ac.state', 'running')
    .where('ap.state', 'running')
    .select(
      'at.id as trace_id',
      'at.participant_id',
      'at.activity_id',
      'at.schedule_date',
      'aa.activity_type',
      'aa.trigger_type',
      'aa.has_validity',
      'aa.validity_duration_number',
      'aa.validity_duration_unit',
      'aa.activity_filter',
      'aa.action_config',
      'aa.email_template_id',
      'aa.campaign_id',
      'ap.contact_id',
    )
    .limit(100); // Process in batches

  for (const trace of traces) {
    try {
      await executeTrace(trace, now);
    } catch (err) {
      console.error(`Automation trace ${trace.trace_id} error:`, (err as Error).message);
      await db('automation_traces').where('id', trace.trace_id).update({
        state: 'error',
        state_message: (err as Error).message.substring(0, 500),
        processed_at: new Date(),
      });
    }
  }
}

async function executeTrace(trace: Record<string, unknown>, now: Date) {
  const traceId = trace.trace_id as string;

  // 1. Check validity window (mirrors Odoo's validity check)
  if (trace.has_validity) {
    const scheduleDate = new Date(trace.schedule_date as string);
    const validityMs = getIntervalMs(
      trace.validity_duration_number as number,
      trace.validity_duration_unit as string,
    );
    if (now.getTime() > scheduleDate.getTime() + validityMs) {
      await db('automation_traces').where('id', traceId).update({
        state: 'rejected',
        state_message: 'Validity window expired',
        processed_at: now,
      });
      return;
    }
  }

  // 2. Apply activity filter (if any)
  const filterRules = typeof trace.activity_filter === 'string'
    ? JSON.parse(trace.activity_filter as string)
    : trace.activity_filter;

  if (Array.isArray(filterRules) && filterRules.length > 0) {
    const contact = await db('contacts').where('id', trace.contact_id).first();
    if (!evaluateFilter(contact, filterRules)) {
      await db('automation_traces').where('id', traceId).update({
        state: 'rejected',
        state_message: 'Activity filter not matched',
        processed_at: now,
      });
      return;
    }
  }

  // 3. Execute based on activity type
  let conditionResult: boolean | null = null;
  switch (trace.activity_type) {
    case 'email':
      await executeEmailActivity(trace);
      break;
    case 'action':
      await executeActionActivity(trace);
      break;
    case 'wait':
      // Wait activities just pass through - the delay was in the schedule
      break;
    case 'condition':
      // Evaluate condition for branching
      conditionResult = await evaluateCondition(trace);
      break;
  }

  // 4. Mark trace as processed
  await db('automation_traces').where('id', traceId).update({
    state: 'processed',
    state_message: conditionResult !== null
      ? (conditionResult ? 'condition_met' : 'condition_not_met')
      : null,
    processed_at: now,
  });

  // 5. Generate child traces for time-based triggers
  await generateChildTraces(trace, conditionResult);
}

async function executeEmailActivity(trace: Record<string, unknown>) {
  const contactId = trace.contact_id as string;
  const contact = await db('contacts').where('id', contactId).first();
  if (!contact || !contact.email) return;

  // Get email template
  const templateId = trace.email_template_id as string;
  if (!templateId) return;

  const template = await db('email_templates').where('id', templateId).first();
  if (!template) return;

  // Create a mini-campaign for this automation email, then enqueue
  // For now, directly create a mailing trace that can be sent
  const mailingTraceId = uuidv4();
  await db('mailing_traces').insert({
    id: mailingTraceId,
    campaign_id: null, // Automation-originated trace
    contact_id: contactId,
    email: contact.email,
    trace_status: 'outgoing',
    automation_trace_id: trace.trace_id as string,
  });

  // Update automation trace with the mailing trace reference
  await db('automation_traces').where('id', trace.trace_id as string).update({
    mailing_trace_id: mailingTraceId,
  });

  // TODO: Enqueue to email:send queue for actual sending
}

async function executeActionActivity(trace: Record<string, unknown>) {
  const contactId = trace.contact_id as string;
  const config = typeof trace.action_config === 'string'
    ? JSON.parse(trace.action_config as string)
    : (trace.action_config || {});

  switch (config.action_type) {
    case 'add_tag':
      if (config.tag_id) {
        const existing = await db('contact_tags').where({ contact_id: contactId, tag_id: config.tag_id }).first();
        if (!existing) {
          await db('contact_tags').insert({ contact_id: contactId, tag_id: config.tag_id });
        }
      }
      break;

    case 'remove_tag':
      if (config.tag_id) {
        await db('contact_tags').where({ contact_id: contactId, tag_id: config.tag_id }).del();
      }
      break;

    case 'add_to_list':
      if (config.list_id) {
        const existing = await db('subscriptions').where({ contact_id: contactId, list_id: config.list_id }).first();
        if (!existing) {
          await db('subscriptions').insert({ id: uuidv4(), contact_id: contactId, list_id: config.list_id });
        }
      }
      break;

    case 'remove_from_list':
      if (config.list_id) {
        await db('subscriptions').where({ contact_id: contactId, list_id: config.list_id }).update({ opt_out: true, opt_out_at: new Date() });
      }
      break;

    case 'update_field':
      if (config.field && config.value !== undefined) {
        await db('contacts').where('id', contactId).update({ [config.field]: config.value, updated_at: new Date() });
      }
      break;

    case 'webhook':
      if (config.webhook_url) {
        try {
          const contact = await db('contacts').where('id', contactId).first();
          await fetch(config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: 'automation_action', contact, activity_id: trace.activity_id }),
          });
        } catch (err) {
          console.error('Webhook failed:', (err as Error).message);
        }
      }
      break;
  }
}

/**
 * Evaluate a condition activity's filter against the contact.
 * Returns true if the condition is met, false otherwise.
 */
async function evaluateCondition(trace: Record<string, unknown>): Promise<boolean> {
  const contact = await db('contacts').where('id', trace.contact_id).first();
  if (!contact) return false;

  const filterRaw = typeof trace.activity_filter === 'string'
    ? JSON.parse(trace.activity_filter as string)
    : trace.activity_filter;

  if (!filterRaw) return true;

  // Support new { match, rules } format
  if (filterRaw && typeof filterRaw === 'object' && 'rules' in filterRaw) {
    const { match, rules } = filterRaw as { match?: string; rules: Array<{ field: string; operator: string; value?: unknown }> };
    if (!Array.isArray(rules) || rules.length === 0) return true;

    if (match === 'any') {
      return rules.some((rule) => evaluateSingleRule(contact, rule));
    }
    // Default: 'all' (AND)
    return rules.every((rule) => evaluateSingleRule(contact, rule));
  }

  // Legacy array format
  if (Array.isArray(filterRaw) && filterRaw.length > 0) {
    return evaluateFilter(contact, filterRaw);
  }

  return true;
}

function evaluateSingleRule(contact: Record<string, unknown>, rule: { field: string; operator: string; value?: unknown }): boolean {
  const value = contact[rule.field];
  switch (rule.operator) {
    case 'eq': return value === rule.value;
    case 'neq': return value !== rule.value;
    case 'contains': return String(value || '').includes(String(rule.value || ''));
    case 'not_empty': return !!value;
    default: return true;
  }
}

/**
 * Generate child traces for time-dependent triggers.
 * Mirrors Odoo's _generate_children_traces (marketing_activity.py)
 * For condition nodes, routes to yes/no branches based on conditionResult.
 */
async function generateChildTraces(parentTrace: Record<string, unknown>, conditionResult: boolean | null = null) {
  const activityId = parentTrace.activity_id as string;
  const participantId = parentTrace.participant_id as string;
  const isCondition = parentTrace.activity_type === 'condition';

  // Find child activities that depend on time-based triggers
  const children = await db('automation_activities')
    .where('parent_id', activityId);

  for (const child of children) {
    // For condition parents, only create traces for the matching branch
    if (isCondition && conditionResult !== null) {
      const handle = child.parent_handle;
      if (handle === 'yes' && !conditionResult) continue;
      if (handle === 'no' && conditionResult) continue;
      // If handle is null, create trace regardless (backward compat)
    }

    // Only generate traces for time-based / schedule-based triggers here
    // Event-based triggers (mail_opened, mail_clicked, etc.) are handled by the event worker
    if (RESCHEDULE_TRIGGER_TYPES.has(child.trigger_type)) {
      const scheduleDate = new Date(
        Date.now() + getIntervalMs(child.interval_number, child.interval_unit),
      );

      await db('automation_traces').insert({
        id: uuidv4(),
        participant_id: participantId,
        activity_id: child.id,
        parent_id: parentTrace.trace_id as string,
        state: 'scheduled',
        schedule_date: scheduleDate,
      });
    }
  }
}

function evaluateFilter(contact: Record<string, unknown>, rules: unknown[]): boolean {
  // Simple filter evaluation - can be extended
  for (const rule of rules as Array<{ field: string; operator: string; value: unknown }>) {
    const value = contact[rule.field];
    switch (rule.operator) {
      case 'eq': if (value !== rule.value) return false; break;
      case 'neq': if (value === rule.value) return false; break;
      case 'contains': if (!String(value).includes(String(rule.value))) return false; break;
      case 'not_empty': if (!value) return false; break;
    }
  }
  return true;
}

function getIntervalMs(number: number, unit: string): number {
  switch (unit) {
    case 'minutes': return number * 60 * 1000;
    case 'hours': return number * 60 * 60 * 1000;
    case 'days': return number * 24 * 60 * 60 * 1000;
    case 'weeks': return number * 7 * 24 * 60 * 60 * 1000;
    case 'months': return number * 30 * 24 * 60 * 60 * 1000; // Approximate
    default: return 0;
  }
}

export function createAutomationExecutorWorker() {
  return new Worker('automation-execute', executeScheduledTraces, {
    connection: redis,
    concurrency: 3,
  });
}
