import { Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { emailSendQueue } from '../config/queue.js';

// Children scheduled as soon as the parent step runs. "Not opened/clicked/replied" steps wait out
// their interval and are cancelled by the event worker if the contact does engage.
const RESCHEDULE_TRIGGER_TYPES = new Set(['begin', 'activity', 'activity_completed', 'mail_not_opened', 'mail_not_clicked', 'mail_not_replied']);

const UPDATABLE_FIELDS = new Set(['first_name', 'last_name', 'company_name', 'phone', 'country_code', 'timezone', 'source']);


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
      'aa.name as activity_name',
      'ac.org_id',
      'ac.name as automation_name',
      'ac.email_from',
      'ac.reply_to',
      'ac.target_filter',
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
      // The editor's "Start" node is stored as an email activity without a template; it only marks the entry point.
      if (trace.trigger_type === 'begin' && !trace.email_template_id) break;
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
  const orgId = trace.org_id as string;
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact || !contact.email) throw new Error('Contact has no email address');
  if (contact.is_blacklisted) throw new Error('Contact is blocked');
  const blocked = await db('email_blacklist').where({ org_id: orgId, is_active: true, email_normalized: contact.email_normalized }).first();
  if (blocked) throw new Error('Email address is on the block list');

  const templateId = trace.email_template_id as string;
  if (!templateId) throw new Error('No email template chosen for this step');
  const template = await db('email_templates').where({ id: templateId, org_id: orgId }).first();
  if (!template) throw new Error('Email template not found');

  const campaignId = await ensureStepCampaign(trace, template);

  const mailingTraceId = uuidv4();
  await db('mailing_traces').insert({
    id: mailingTraceId,
    campaign_id: campaignId,
    contact_id: contactId,
    email: contact.email,
    trace_status: 'outgoing',
    automation_trace_id: trace.trace_id as string,
  });
  await db('automation_traces').where('id', trace.trace_id as string).update({ mailing_trace_id: mailingTraceId });
  await db('campaigns').where('id', campaignId).increment('stat_total', 1);

  await emailSendQueue.add('send-batch', {
    campaign_id: campaignId, org_id: orgId, trace_ids: [mailingTraceId], batch_index: 0, total_batches: 1,
  }, { removeOnComplete: 1000, removeOnFail: 1000 });
}

/**
 * Each automation email step gets one hidden campaign row so sending, open/click tracking and
 * unsubscribe links work exactly like regular campaigns. Content is refreshed from the template
 * on every send so template edits apply to the next email.
 */
async function ensureStepCampaign(trace: Record<string, unknown>, template: Record<string, any>): Promise<string> {
  const orgId = trace.org_id as string;
  const activityId = trace.activity_id as string;
  let from = (trace.email_from as string | null) || null;
  if (!from) {
    const last = await db('campaigns').where({ org_id: orgId, is_automation: false }).whereNotNull('email_from')
      .orderBy('created_at', 'desc').select('email_from').first();
    from = last?.email_from || null;
  }
  if (!from) throw new Error('Set a "From" email address for this automation');

  const content = {
    subject: template.subject || template.name,
    preview_text: template.preview_text || null,
    body_html: template.body_html || '',
    email_from: from,
    reply_to: (trace.reply_to as string | null) || null,
    updated_at: new Date(),
  };
  const existing = await db('campaigns').where({ org_id: orgId, is_automation: true, automation_activity_id: activityId }).first();
  const id: string = existing?.id || uuidv4();
  if (existing) {
    await db('campaigns').where('id', id).update({ ...content, state: 'sending' });
  } else {
  await db('campaigns').insert({
    id,
    org_id: orgId,
    name: `Automation: ${trace.automation_name} / ${trace.activity_name}`,
    ...content,
    state: 'sending',
    use_blacklist: true,
    is_automation: true,
    automation_activity_id: activityId,
  });
  }

  // Linking the audience lists lets the normal unsubscribe page opt the contact out of them.
  const targets = (typeof trace.target_filter === 'string' ? JSON.parse(trace.target_filter) : trace.target_filter) || [];
  const listIds: string[] = Array.isArray(targets)
    ? targets.filter((t) => t?.operator === 'in_list' && t.value).map((t) => String(t.value))
    : [];
  await db('campaign_lists').where('campaign_id', id).del();
  if (listIds.length) await db('campaign_lists').insert(listIds.map((list_id) => ({ campaign_id: id, list_id })));
  return id;
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
      if (config.field && UPDATABLE_FIELDS.has(config.field) && config.value !== undefined) {
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
  const row = await db('contacts').where('id', trace.contact_id).first();
  if (!row) return false;

  // Pseudo-fields let a condition branch on how the contact reacted to the most recent
  // email this automation sent them.
  const lastMail = await db('automation_traces as at')
    .join('mailing_traces as mt', 'mt.id', 'at.mailing_trace_id')
    .where('at.participant_id', trace.participant_id as string)
    .orderBy('mt.created_at', 'desc')
    .select('mt.first_open_at', 'mt.first_click_at')
    .first();
  const contact: Record<string, unknown> = {
    ...row,
    last_email_opened: lastMail?.first_open_at ? 'yes' : 'no',
    last_email_clicked: lastMail?.first_click_at ? 'yes' : 'no',
  };

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

function norm(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim().toLowerCase();
}

function evaluateSingleRule(contact: Record<string, unknown>, rule: { field: string; operator: string; value?: unknown }): boolean {
  const value = contact[rule.field];
  switch (rule.operator) {
    case 'eq': return norm(value) === norm(rule.value);
    case 'neq': return norm(value) !== norm(rule.value);
    case 'contains': return norm(value).includes(norm(rule.value));
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
