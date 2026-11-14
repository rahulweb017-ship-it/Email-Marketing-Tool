// Turns an AI-drafted workflow outline into automation activities. Pure so it can be unit tested.

export type StepType = 'email' | 'wait' | 'condition' | 'action';
export type StepTrigger = 'after_previous' | 'opened' | 'not_opened' | 'clicked' | 'not_clicked';

export interface DraftStep {
  key: string;
  parent: string; // "start" or the key of an earlier step
  branch: 'yes' | 'no' | '';
  type: StepType;
  name: string;
  trigger: StepTrigger;
  delay_number: number;
  delay_unit: 'minutes' | 'hours' | 'days' | 'weeks';
  condition_field?: string;
  condition_value?: string;
  tag_name?: string;
  tag_action?: 'add_tag' | 'remove_tag';
}

export interface PlannedActivity {
  key: string;
  parentKey: string | null; // null = child of the Start node
  parent_handle: 'yes' | 'no' | null;
  activity_type: StepType;
  name: string;
  trigger_type: string;
  interval_number: number;
  interval_unit: string;
  position_x: number;
  position_y: number;
  activity_filter: { match: 'all'; rules: Array<{ field: string; operator: string; value: string }> } | [];
}

export const MAX_DRAFT_STEPS = 20;
export const CONDITION_FIELDS = ['last_email_opened', 'last_email_clicked', 'country_code', 'source', 'company_name', 'email'];

const TRIGGER_MAP: Record<StepTrigger, string> = {
  after_previous: 'activity_completed',
  opened: 'mail_opened',
  not_opened: 'mail_not_opened',
  clicked: 'mail_clicked',
  not_clicked: 'mail_not_clicked',
};

/**
 * Validates and lays out the draft. Steps that can't be wired correctly are dropped and
 * reported, so a bad AI answer never produces a broken workflow.
 */
export function planAutomation(steps: DraftStep[]): { activities: PlannedActivity[]; skipped: string[] } {
  const skipped: string[] = [];
  const byKey = new Map<string, PlannedActivity>();
  const order: PlannedActivity[] = [];
  const childCount = new Map<string, number>();

  for (const step of steps.slice(0, MAX_DRAFT_STEPS)) {
    const label = step.name || step.key;
    if (!step.key || step.key === 'start' || byKey.has(step.key)) { skipped.push(`${label}: duplicate or missing id`); continue; }
    const parent = step.parent === 'start' ? null : byKey.get(step.parent);
    if (step.parent !== 'start' && !parent) { skipped.push(`${label}: comes after a step that does not exist`); continue; }

    let trigger: StepTrigger = TRIGGER_MAP[step.trigger] ? step.trigger : 'after_previous';
    if (trigger !== 'after_previous' && parent?.activity_type !== 'email') trigger = 'after_previous';

    let handle: 'yes' | 'no' | null = null;
    if (parent?.activity_type === 'condition') {
      if (step.branch !== 'yes' && step.branch !== 'no') { skipped.push(`${label}: needs a yes or no branch`); continue; }
      handle = step.branch;
    }

    let filter: PlannedActivity['activity_filter'] = [];
    if (step.type === 'condition') {
      const field = step.condition_field && CONDITION_FIELDS.includes(step.condition_field) ? step.condition_field : null;
      if (!field) { skipped.push(`${label}: unsupported condition`); continue; }
      const engagement = field.startsWith('last_email_');
      const value = engagement ? (String(step.condition_value).toLowerCase() === 'no' ? 'no' : 'yes') : String(step.condition_value ?? '').trim();
      if (!value) { skipped.push(`${label}: condition needs a value`); continue; }
      filter = { match: 'all', rules: [{ field, operator: 'eq', value }] };
    }

    const parentKey = parent ? parent.key : null;
    const siblings = childCount.get(parentKey ?? 'start') ?? 0;
    childCount.set(parentKey ?? 'start', siblings + 1);
    const parentX = parent ? parent.position_x : 250;
    const parentY = parent ? parent.position_y : 50;
    const offset = handle === 'yes' ? -180 : handle === 'no' ? 180 : siblings * 260;

    const planned: PlannedActivity = {
      key: step.key,
      parentKey,
      parent_handle: handle,
      activity_type: step.type,
      name: (step.name || step.type).slice(0, 200),
      trigger_type: TRIGGER_MAP[trigger],
      interval_number: Math.max(0, Math.min(365, Math.round(Number(step.delay_number) || 0))),
      interval_unit: ['minutes', 'hours', 'days', 'weeks'].includes(step.delay_unit) ? step.delay_unit : 'days',
      position_x: parentX + offset,
      position_y: parentY + 150,
      activity_filter: filter,
    };
    byKey.set(step.key, planned);
    order.push(planned);
  }
  if (steps.length > MAX_DRAFT_STEPS) skipped.push(`Only the first ${MAX_DRAFT_STEPS} steps were kept`);
  return { activities: order, skipped };
}
