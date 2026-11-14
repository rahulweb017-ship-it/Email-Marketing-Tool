import { X } from 'lucide-react';

export interface Rule {
  field: string;
  operator: string;
  value?: string;
}

interface SegmentRuleRowProps {
  rule: Rule;
  onChange: (updated: Rule) => void;
  onRemove: () => void;
  canRemove: boolean;
}

type Kind = 'text' | 'number' | 'date' | 'tag';

// Must match SEGMENT_FIELDS in apps/api/src/modules/segments/segment.rules.ts
const FIELDS: { value: string; label: string; kind: Kind }[] = [
  { value: 'email', label: 'Email', kind: 'text' },
  { value: 'first_name', label: 'First name', kind: 'text' },
  { value: 'last_name', label: 'Last name', kind: 'text' },
  { value: 'company_name', label: 'Company', kind: 'text' },
  { value: 'phone', label: 'Phone', kind: 'text' },
  { value: 'country_code', label: 'Country code', kind: 'text' },
  { value: 'timezone', label: 'Timezone', kind: 'text' },
  { value: 'source', label: 'Source', kind: 'text' },
  { value: 'engagement_score', label: 'Engagement score', kind: 'number' },
  { value: 'predicted_engagement', label: 'Predicted engagement (0-100)', kind: 'number' },
  { value: 'churn_risk', label: 'Churn risk (0-100)', kind: 'number' },
  { value: 'created_at', label: 'Date added', kind: 'date' },
  { value: 'last_open_at', label: 'Last email open', kind: 'date' },
  { value: 'last_click_at', label: 'Last email click', kind: 'date' },
  { value: 'tag', label: 'Tag', kind: 'tag' },
];

const OPERATORS: Record<Kind, { value: string; label: string }[]> = {
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'is_set', label: 'is set' },
    { value: 'is_not_set', label: 'is not set' },
  ],
  number: [
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'at least' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'at most' },
    { value: 'eq', label: 'equals' },
    { value: 'between', label: 'between' },
  ],
  date: [
    { value: 'within_days', label: 'in the last' },
    { value: 'before_days', label: 'more than' },
    { value: 'is_set', label: 'has happened' },
    { value: 'is_not_set', label: 'never' },
  ],
  tag: [
    { value: 'has_tag', label: 'has tag' },
    { value: 'not_has_tag', label: 'does not have tag' },
  ],
};

const NO_VALUE = ['is_set', 'is_not_set'];
const inputCls = 'px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';

export function fieldKind(field: string): Kind {
  return FIELDS.find((f) => f.value === field)?.kind || 'text';
}

export default function SegmentRuleRow({ rule, onChange, onRemove, canRemove }: SegmentRuleRowProps) {
  const kind = fieldKind(rule.field);
  // Older segments saved "equals" on numbers.
  const operator = kind === 'number' && rule.operator === 'equals' ? 'eq' : rule.operator;
  const showValue = !NO_VALUE.includes(operator);
  const isBetween = operator === 'between';
  const value = rule.value == null ? '' : String(rule.value);

  return (
    <div className="flex items-center gap-2">
      <select aria-label="Field" value={rule.field}
        onChange={(e) => onChange({ field: e.target.value, operator: OPERATORS[fieldKind(e.target.value)][0].value, value: '' })}
        className={`${inputCls} bg-white min-w-[150px]`}>
        {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      <select aria-label="Operator" value={operator}
        onChange={(e) => {
          const op = e.target.value;
          const updated: Rule = { ...rule, operator: op };
          if (NO_VALUE.includes(op)) delete updated.value;
          onChange(updated);
        }}
        className={`${inputCls} bg-white min-w-[130px]`}>
        {OPERATORS[kind].map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>

      {showValue && !isBetween && kind === 'date' && (
        <div className="flex-1 flex items-center gap-2">
          <input type="number" min={0} aria-label="Days" value={value}
            onChange={(e) => onChange({ ...rule, value: e.target.value })} placeholder="30" className={`${inputCls} w-24`} />
          <span className="text-sm text-gray-500">{operator === 'before_days' ? 'days ago' : 'days'}</span>
        </div>
      )}

      {showValue && !isBetween && kind !== 'date' && (
        <input type={kind === 'number' ? 'number' : 'text'} aria-label="Value" value={value}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder={kind === 'number' ? 'Score' : kind === 'tag' ? 'Tag name' : 'Value'}
          className={`${inputCls} flex-1`} />
      )}

      {isBetween && (
        <div className="flex-1 flex items-center gap-1">
          <input type="number" aria-label="Minimum" value={value.split(',')[0] || ''}
            onChange={(e) => onChange({ ...rule, value: `${e.target.value},${value.split(',')[1] || ''}` })}
            placeholder="Min" className={`${inputCls} w-20`} />
          <span className="text-sm text-gray-400">and</span>
          <input type="number" aria-label="Maximum" value={value.split(',')[1] || ''}
            onChange={(e) => onChange({ ...rule, value: `${value.split(',')[0] || ''},${e.target.value}` })}
            placeholder="Max" className={`${inputCls} w-20`} />
        </div>
      )}

      {!showValue && <div className="flex-1" />}

      <button onClick={onRemove} disabled={!canRemove} title="Remove rule"
        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
