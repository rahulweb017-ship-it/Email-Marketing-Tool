import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { TextInput, SelectInput, CheckboxInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { Plus, Loader2 } from 'lucide-react';
import api from '../../api/client';
import { listCustomFields } from '../../api/custom-fields';

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  contact?: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    phone: string | null;
    country_code: string | null;
  } | null;
}

interface ListOption { id: string; name: string }

interface CustomFieldDef {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
}

const COUNTRIES = [
  { value: '', label: 'Select country' },
  { value: 'US', label: 'United States' }, { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' }, { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' }, { value: 'FR', label: 'France' },
  { value: 'IN', label: 'India' }, { value: 'JP', label: 'Japan' },
  { value: 'BR', label: 'Brazil' }, { value: 'MX', label: 'Mexico' },
  { value: 'ES', label: 'Spain' }, { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' }, { value: 'SE', label: 'Sweden' },
  { value: 'CH', label: 'Switzerland' }, { value: 'SG', label: 'Singapore' },
];

export default function ContactFormModal({ isOpen, onClose, onSaved, contact }: ContactFormModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [existingListIds, setExistingListIds] = useState<string[]>([]);
  const [showQuickList, setShowQuickList] = useState(false);
  const [quickListName, setQuickListName] = useState('');
  const [quickListLoading, setQuickListLoading] = useState(false);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', company_name: '', phone: '', country_code: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => setLists(data.data)).catch(() => {});
      listCustomFields().then(({ data }) => setCustomFields(data.data)).catch(() => {});
      if (contact) {
        setForm({
          email: contact.email || '',
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          company_name: contact.company_name || '',
          phone: contact.phone || '',
          country_code: contact.country_code || '',
        });
        // Fetch current subscriptions and custom field values for edit mode
        api.get(`/contacts/${contact.id}`).then(({ data }) => {
          const subIds = (data.subscriptions || []).filter((s: { opt_out: boolean }) => !s.opt_out).map((s: { id: string }) => s.id);
          setSelectedLists(subIds);
          setExistingListIds(subIds);
          // Load custom field values
          if (data.custom_field_values) {
            const cfv: Record<string, string> = {};
            for (const v of data.custom_field_values) {
              cfv[v.field_key] = v.value || '';
            }
            setCustomFieldValues(cfv);
          }
        }).catch(() => {});
      } else {
        setForm({ email: '', first_name: '', last_name: '', company_name: '', phone: '', country_code: '' });
        setSelectedLists([]);
        setExistingListIds([]);
        setCustomFieldValues({});
      }
      setErrors({});
      setShowQuickList(false);
      setQuickListName('');
    }
  }, [isOpen, contact]);

  const setField = (field: string) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  const handleQuickCreateList = async () => {
    if (!quickListName.trim()) return;
    setQuickListLoading(true);
    try {
      const { data } = await api.post('/lists', { name: quickListName.trim() });
      setLists((prev) => [...prev, { id: data.id, name: data.name }]);
      setSelectedLists((prev) => [...prev, data.id]);
      setQuickListName('');
      setShowQuickList(false);
      addToast('List created', 'success');
    } catch {
      addToast('Failed to create list', 'error');
    } finally {
      setQuickListLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.email.trim() && !form.phone.trim()) {
      setErrors({ email: 'Add an email or a phone number', phone: 'Add a phone number or an email' });
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // On edit, send cleared email/phone as null so they are actually removed
      Object.keys(payload).forEach((k) => {
        if (!payload[k]) {
          if (contact && (k === 'email' || k === 'phone') && contact[k]) payload[k] = null;
          else delete payload[k];
        }
      });
      if (selectedLists.length > 0 && !contact) payload.list_ids = selectedLists;
      // Include custom field values if any are set
      const cfvWithValues = Object.fromEntries(
        Object.entries(customFieldValues).filter(([, v]) => v !== '')
      );
      if (Object.keys(cfvWithValues).length > 0) {
        payload.custom_field_values = cfvWithValues;
      }

      if (contact) {
        await api.patch(`/contacts/${contact.id}`, payload);
        // Handle list membership changes on edit
        const toAdd = selectedLists.filter((id) => !existingListIds.includes(id));
        const toRemove = existingListIds.filter((id) => !selectedLists.includes(id));
        for (const listId of toAdd) {
          await api.post(`/lists/${listId}/subscribers`, { contact_ids: [contact.id] }).catch(() => {});
        }
        for (const listId of toRemove) {
          await api.delete(`/lists/${listId}/subscribers/${contact.id}`).catch(() => {});
        }
        addToast('Contact updated', 'success');
      } else {
        await api.post('/contacts', payload);
        addToast('Contact created', 'success');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save contact';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!contact;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
          >
            {loading && <ButtonSpinner />}
            {isEdit ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <TextInput label="Email" name="email" value={form.email} onChange={setField('email')} error={errors.email} placeholder="john@example.com" type="email" />
        <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">Email or phone is enough. Use email for email campaigns and phone for WhatsApp.</p>
        <div className="grid grid-cols-2 gap-4">
          <TextInput label="First Name" name="first_name" value={form.first_name} onChange={setField('first_name')} placeholder="John" />
          <TextInput label="Last Name" name="last_name" value={form.last_name} onChange={setField('last_name')} placeholder="Doe" />
        </div>
        <TextInput label="Company" name="company_name" value={form.company_name} onChange={setField('company_name')} placeholder="Acme Inc." />
        <div className="grid grid-cols-2 gap-4">
          <TextInput label="Phone" name="phone" value={form.phone} onChange={setField('phone')} error={errors.phone} placeholder="+91 98765 43210" />
          <SelectInput label="Country" name="country_code" value={form.country_code} onChange={setField('country_code')} options={COUNTRIES} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              {isEdit ? 'Mailing Lists' : 'Add to Lists'}
            </label>
            <button
              type="button"
              onClick={() => setShowQuickList(!showQuickList)}
              className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Plus className="h-3 w-3" /> Create List
            </button>
          </div>
          {showQuickList && (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={quickListName}
                onChange={(e) => setQuickListName(e.target.value)}
                placeholder="List name, e.g. Newsletter"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateList(); } }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleQuickCreateList}
                disabled={quickListLoading || !quickListName.trim()}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
              >
                {quickListLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
          {lists.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              No mailing lists yet. Click "Create List" above to add one.
            </p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto border rounded-lg p-3">
              {lists.map((list) => (
                <label key={list.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedLists.includes(list.id)}
                    onChange={(e) => {
                      setSelectedLists(e.target.checked
                        ? [...selectedLists, list.id]
                        : selectedLists.filter((id) => id !== list.id));
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  {list.name}
                </label>
              ))}
            </div>
          )}
        </div>
        {/* Custom Fields */}
        {customFields.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              Custom Fields
            </label>
            <div className="space-y-3 border rounded-lg p-3 dark:border-gray-600">
              {customFields.map((cf) => {
                const cfValue = customFieldValues[cf.field_key] || '';
                const setCfValue = (val: string) => {
                  setCustomFieldValues((prev) => ({ ...prev, [cf.field_key]: val }));
                };

                if (cf.field_type === 'text') {
                  return (
                    <TextInput
                      key={cf.id}
                      label={cf.name}
                      name={`cf_${cf.field_key}`}
                      value={cfValue}
                      onChange={setCfValue}
                      required={cf.is_required}
                    />
                  );
                }
                if (cf.field_type === 'number') {
                  return (
                    <TextInput
                      key={cf.id}
                      label={cf.name}
                      name={`cf_${cf.field_key}`}
                      value={cfValue}
                      onChange={setCfValue}
                      type="number"
                      required={cf.is_required}
                    />
                  );
                }
                if (cf.field_type === 'date') {
                  return (
                    <TextInput
                      key={cf.id}
                      label={cf.name}
                      name={`cf_${cf.field_key}`}
                      value={cfValue}
                      onChange={setCfValue}
                      type="date"
                      required={cf.is_required}
                    />
                  );
                }
                if (cf.field_type === 'boolean') {
                  return (
                    <CheckboxInput
                      key={cf.id}
                      label={cf.name}
                      checked={cfValue === 'true'}
                      onChange={(checked) => setCfValue(checked ? 'true' : 'false')}
                    />
                  );
                }
                if (cf.field_type === 'dropdown' && cf.options) {
                  return (
                    <SelectInput
                      key={cf.id}
                      label={cf.name}
                      name={`cf_${cf.field_key}`}
                      value={cfValue}
                      onChange={setCfValue}
                      options={cf.options.map((o) => ({ value: o, label: o }))}
                      placeholder="Select..."
                      required={cf.is_required}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
