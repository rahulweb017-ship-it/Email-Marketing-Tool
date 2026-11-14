import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import api from '../../api/client';

interface Activity {
  id: string;
  name: string;
  activity_type: string;
  trigger_type: string;
  parent_id: string | null;
  parent_handle: string | null;
  interval_number: number;
  interval_unit: string;
  position_x: number;
  position_y: number;
  email_template_id: string | null;
  action_config: Record<string, unknown>;
  activity_filter: unknown;
}

interface Props {
  activity: Activity;
  onClose: () => void;
  onSaved: () => void;
}

interface FilterRule {
  field: string;
  operator: string;
  value: string;
}

const CONTACT_FIELDS = [
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'phone', label: 'Phone' },
  { value: 'country_code', label: 'Country' },
  { value: 'is_blacklisted', label: 'Is Blacklisted' },
  { value: 'source', label: 'Source' },
];

const ENGAGEMENT_FIELDS = [
  { value: 'last_email_opened', label: 'Opened previous email' },
  { value: 'last_email_clicked', label: 'Clicked previous email' },
];
const isEngagement = (f: string) => ENGAGEMENT_FIELDS.some((e) => e.value === f);

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_empty', label: 'is set' },
];

const ACTION_TYPES = [
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'remove_tag', label: 'Remove Tag' },
  { value: 'add_to_list', label: 'Add to List' },
  { value: 'remove_from_list', label: 'Remove from List' },
  { value: 'update_field', label: 'Update Field' },
  { value: 'webhook', label: 'Webhook' },
];

const INTERVAL_UNITS = ['minutes', 'hours', 'days', 'weeks'];

export default function ActivityConfigModal({ activity, onClose, onSaved }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-gray-100">
            Configure {activity.activity_type === 'condition' ? 'Condition' : activity.activity_type === 'action' ? 'Action' : activity.activity_type === 'email' ? 'Email' : 'Wait'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          {activity.activity_type === 'condition' && <ConditionConfig activity={activity} onClose={onClose} onSaved={onSaved} />}
          {activity.activity_type === 'action' && <ActionConfig activity={activity} onClose={onClose} onSaved={onSaved} />}
          {activity.activity_type === 'email' && <EmailConfig activity={activity} onClose={onClose} onSaved={onSaved} />}
          {activity.activity_type === 'wait' && <WaitConfig activity={activity} onClose={onClose} onSaved={onSaved} />}
        </div>
      </div>
    </div>
  );
}

function ConditionConfig({ activity, onClose, onSaved }: Props) {
  const existingFilter = parseFilter(activity.activity_filter);
  const [match, setMatch] = useState<'all' | 'any'>(existingFilter.match || 'all');
  const [rules, setRules] = useState<FilterRule[]>(existingFilter.rules.length > 0 ? existingFilter.rules : [{ field: 'last_email_opened', operator: 'eq', value: 'yes' }]);
  const [saving, setSaving] = useState(false);

  const addRule = () => setRules([...rules, { field: 'email', operator: 'eq', value: '' }]);

  const updateRule = (idx: number, updates: Partial<FilterRule>) => {
    setRules(rules.map((r, i) => i === idx ? { ...r, ...updates } : r));
  };

  const removeRule = (idx: number) => {
    if (rules.length > 1) setRules(rules.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/automations/activities/${activity.id}`, {
        activity_filter: { match, rules },
      });
      onSaved();
      onClose();
    } catch {
      // error handled upstream
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-300">Match</span>
        <select value={match} onChange={(e) => setMatch(e.target.value as 'all' | 'any')}
          className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
          <option value="all">All rules (AND)</option>
          <option value="any">Any rule (OR)</option>
        </select>
      </div>

      <div className="space-y-3">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select value={rule.field}
              onChange={(e) => updateRule(idx, isEngagement(e.target.value) ? { field: e.target.value, operator: 'eq', value: 'yes' } : { field: e.target.value })}
              className="text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
              <optgroup label="Engagement">
                {ENGAGEMENT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </optgroup>
              <optgroup label="Contact">
                {CONTACT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </optgroup>
            </select>
            {isEngagement(rule.field) ? (
              <select value={rule.value || 'yes'} onChange={(e) => updateRule(idx, { operator: 'eq', value: e.target.value })}
                className="text-sm border rounded px-2 py-1.5 flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                <option value="yes">yes</option>
                <option value="no">no</option>
              </select>
            ) : (<>
            <select value={rule.operator} onChange={(e) => updateRule(idx, { operator: e.target.value })}
              className="text-sm border rounded px-2 py-1.5 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {rule.operator !== 'not_empty' && (
              <input type="text" value={rule.value} onChange={(e) => updateRule(idx, { value: e.target.value })}
                placeholder="Value" className="text-sm border rounded px-2 py-1.5 flex-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
            )}
            </>)}
            <button onClick={() => removeRule(idx)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
              disabled={rules.length <= 1}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button onClick={addRule} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
        <Plus className="h-4 w-4" /> Add rule
      </button>

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function ActionConfig({ activity, onClose, onSaved }: Props) {
  const config = (activity.action_config || {}) as Record<string, unknown>;
  const [actionType, setActionType] = useState<string>((config.action_type as string) || '');
  const [tagId, setTagId] = useState<string>((config.tag_id as string) || '');
  const [listId, setListId] = useState<string>((config.list_id as string) || '');
  const [field, setField] = useState<string>((config.field as string) || '');
  const [value, setValue] = useState<string>((config.value as string) || '');
  const [webhookUrl, setWebhookUrl] = useState<string>((config.webhook_url as string) || '');
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/automations/tags').then((r) => setTags(r.data)).catch(() => {});
    api.get('/automations/lists').then((r) => setLists(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const actionConfig: Record<string, unknown> = { action_type: actionType };
      if (actionType === 'add_tag' || actionType === 'remove_tag') actionConfig.tag_id = tagId;
      if (actionType === 'add_to_list' || actionType === 'remove_from_list') actionConfig.list_id = listId;
      if (actionType === 'update_field') { actionConfig.field = field; actionConfig.value = value; }
      if (actionType === 'webhook') actionConfig.webhook_url = webhookUrl;

      await api.patch(`/automations/activities/${activity.id}`, { action_config: actionConfig });
      onSaved();
      onClose();
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action Type</label>
        <select value={actionType} onChange={(e) => setActionType(e.target.value)}
          className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
          <option value="">Select action...</option>
          {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>

      {(actionType === 'add_tag' || actionType === 'remove_tag') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tag</label>
          <select value={tagId} onChange={(e) => setTagId(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
            <option value="">Select tag...</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}

      {(actionType === 'add_to_list' || actionType === 'remove_from_list') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">List</label>
          <select value={listId} onChange={(e) => setListId(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
            <option value="">Select list...</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      )}

      {actionType === 'update_field' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field</label>
            <select value={field} onChange={(e) => setField(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
              <option value="">Select field...</option>
              {CONTACT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Value</label>
            <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
              className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
          </div>
        </>
      )}

      {actionType === 'webhook' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
          <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://..." className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving || !actionType}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function EmailConfig({ activity, onClose, onSaved }: Props) {
  const [templateId, setTemplateId] = useState<string>(activity.email_template_id || '');
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/templates', { params: { per_page: 100 } }).then((r) => {
      setTemplates((r.data.data || r.data).map((t: Record<string, unknown>) => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/automations/activities/${activity.id}`, { email_template_id: templateId || null });
      onSaved();
      onClose();
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Template</label>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
          className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
          <option value="">Select template...</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function WaitConfig({ activity, onClose, onSaved }: Props) {
  const [intervalNumber, setIntervalNumber] = useState(activity.interval_number || 1);
  const [intervalUnit, setIntervalUnit] = useState(activity.interval_unit || 'hours');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/automations/activities/${activity.id}`, {
        interval_number: intervalNumber,
        interval_unit: intervalUnit,
      });
      onSaved();
      onClose();
    } catch {
      // error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
          <input type="number" min={1} value={intervalNumber} onChange={(e) => setIntervalNumber(Number(e.target.value))}
            className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
          <select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
            {INTERVAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t dark:border-gray-700">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function parseFilter(raw: unknown): { match: 'all' | 'any'; rules: FilterRule[] } {
  if (!raw) return { match: 'all', rules: [] };
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (obj && typeof obj === 'object' && 'match' in obj && 'rules' in obj) {
    return obj as { match: 'all' | 'any'; rules: FilterRule[] };
  }
  // Legacy array format
  if (Array.isArray(obj) && obj.length > 0) {
    return { match: 'all', rules: obj as FilterRule[] };
  }
  return { match: 'all', rules: [] };
}
