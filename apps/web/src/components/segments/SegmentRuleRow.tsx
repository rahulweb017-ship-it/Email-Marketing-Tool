import { X } from 'lucide-react';

interface Rule {
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

const FIELDS = [
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'country_code', label: 'Country Code' },
  { value: 'created_at', label: 'Created At' },
  { value: 'source', label: 'Source' },
  { value: 'engagement_score', label: 'Engagement Score' },
];

const STRING_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'is_set', label: 'is set' },
  { value: 'is_not_set', label: 'is not set' },
];

const NUMERIC_OPERATORS = [
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'eq', label: 'equals' },
  { value: 'between', label: 'between' },
];

const NUMERIC_FIELDS = new Set(['engagement_score']);

const VALUE_HIDDEN_OPERATORS = ['is_set', 'is_not_set'];

export default function SegmentRuleRow({ rule, onChange, onRemove, canRemove }: SegmentRuleRowProps) {
  const isNumeric = NUMERIC_FIELDS.has(rule.field);
  const operators = isNumeric ? NUMERIC_OPERATORS : STRING_OPERATORS;
  const showValue = !VALUE_HIDDEN_OPERATORS.includes(rule.operator);
  const isBetween = rule.operator === 'between';

  const handleFieldChange = (field: string) => {
    const nowNumeric = NUMERIC_FIELDS.has(field);
    const defaultOp = nowNumeric ? 'gt' : 'equals';
    onChange({ field, operator: defaultOp, value: '' });
  };

  return (
    <div className="flex items-center gap-2">
      {/* Field */}
      <select
        value={rule.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[140px]"
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={rule.operator}
        onChange={(e) => {
          const op = e.target.value;
          const updated: Rule = { ...rule, operator: op };
          if (VALUE_HIDDEN_OPERATORS.includes(op)) {
            delete updated.value;
          }
          onChange(updated);
        }}
        className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[130px]"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value */}
      {showValue && !isBetween && (
        <input
          type={isNumeric ? 'number' : 'text'}
          value={rule.value || ''}
          onChange={(e) => onChange({ ...rule, value: e.target.value })}
          placeholder={isNumeric ? 'Score...' : 'Value...'}
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      )}

      {/* Between: two inputs separated by comma */}
      {isBetween && (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="number"
            value={(rule.value || '').split(',')[0] || ''}
            onChange={(e) => {
              const parts = (rule.value || '').split(',');
              onChange({ ...rule, value: `${e.target.value},${parts[1] || ''}` });
            }}
            placeholder="Min"
            className="w-20 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <span className="text-sm text-gray-400">and</span>
          <input
            type="number"
            value={(rule.value || '').split(',')[1] || ''}
            onChange={(e) => {
              const parts = (rule.value || '').split(',');
              onChange({ ...rule, value: `${parts[0] || ''},${e.target.value}` });
            }}
            placeholder="Max"
            className="w-20 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      )}

      {/* Spacer when value is hidden */}
      {!showValue && !isBetween && <div className="flex-1" />}

      {/* Remove */}
      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
        title="Remove rule"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
