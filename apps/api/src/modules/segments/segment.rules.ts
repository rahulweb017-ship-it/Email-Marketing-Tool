// Segment rule definitions shared by the query builder, validation and the AI segment builder.
// Pure (no DB) so the rule logic can be unit tested.

export type FieldKind = 'text' | 'number' | 'date' | 'tag';

export const SEGMENT_FIELDS: Record<string, { kind: FieldKind; label: string; column?: string }> = {
  email: { kind: 'text', label: 'Email' },
  first_name: { kind: 'text', label: 'First name' },
  last_name: { kind: 'text', label: 'Last name' },
  company_name: { kind: 'text', label: 'Company' },
  phone: { kind: 'text', label: 'Phone' },
  country_code: { kind: 'text', label: 'Country code (e.g. IN, US)' },
  timezone: { kind: 'text', label: 'Timezone' },
  source: { kind: 'text', label: 'Source (how the contact was added)' },
  engagement_score: { kind: 'number', label: 'Engagement score (opens +1, clicks +3, bounces -10)' },
  predicted_engagement: { kind: 'number', label: 'Predicted engagement (0-100, chance of opening the next email)' },
  churn_risk: { kind: 'number', label: 'Churn risk (0-100, risk of going quiet)' },
  created_at: { kind: 'date', label: 'Date added' },
  last_open_at: { kind: 'date', label: 'Last email open' },
  last_click_at: { kind: 'date', label: 'Last email click' },
  tag: { kind: 'tag', label: 'Tag' },
};

export const OPERATORS_BY_KIND: Record<FieldKind, string[]> = {
  text: ['equals', 'not_equals', 'contains', 'starts_with', 'is_set', 'is_not_set'],
  number: ['gt', 'gte', 'lt', 'lte', 'eq', 'between'],
  date: ['within_days', 'before_days', 'is_set', 'is_not_set'],
  tag: ['has_tag', 'not_has_tag'],
};

export const SEGMENT_OPERATORS = [...new Set(Object.values(OPERATORS_BY_KIND).flat()), 'equals'] as const;

const NO_VALUE = new Set(['is_set', 'is_not_set']);

export interface Rule { field: string; operator: string; value?: string | number | null }

/** Returns a human-readable problem with the rule, or null when it is usable. */
export function validateRule(rule: Rule): string | null {
  const def = SEGMENT_FIELDS[rule.field];
  if (!def) return `Unknown field "${rule.field}"`;
  // Older segments stored "equals" for numbers.
  const op = def.kind === 'number' && rule.operator === 'equals' ? 'eq' : rule.operator;
  if (!OPERATORS_BY_KIND[def.kind].includes(op)) return `"${rule.operator}" can't be used with ${def.label}`;
  if (NO_VALUE.has(op)) return null;
  const raw = rule.value;
  if (raw === undefined || raw === null || String(raw).trim() === '') return `${def.label} needs a value`;
  if (def.kind === 'number') {
    if (op === 'between') {
      const parts = String(raw).split(',').map((p) => Number(p.trim()));
      if (parts.length !== 2 || parts.some((n) => Number.isNaN(n))) return 'Use "min,max" for between';
    } else if (Number.isNaN(Number(raw))) return `${def.label} needs a number`;
  }
  if (def.kind === 'date') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 3650) return 'Enter a number of days between 0 and 3650';
  }
  return null;
}

/** The moment N days before `now`, for "within N days" / "more than N days ago" rules. */
export function daysAgo(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Escapes LIKE wildcards so a user value of "50%" matches literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
