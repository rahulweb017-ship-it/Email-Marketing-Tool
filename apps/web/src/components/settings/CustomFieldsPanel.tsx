import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react';
import { listCustomFields, createCustomField, updateCustomField, deleteCustomField } from '../../api/custom-fields';
import { useToastStore } from '../../stores/toast.store';
import Badge from '../ui/Badge';
import EmptyState from '../ui/EmptyState';
import ConfirmDialog from '../ui/ConfirmDialog';
import { ListSkeleton } from '../ui/Skeleton';
import Modal from '../ui/Modal';
import { TextInput, SelectInput, CheckboxInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';

interface CustomField {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  created_at: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'dropdown', label: 'Dropdown' },
];

function generateFieldKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+/, '')
    .replace(/_+$/, '')
    .substring(0, 100);
}

export default function CustomFieldsPanel() {
  const addToast = useToastStore((s) => s.addToast);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editField, setEditField] = useState<CustomField | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    field_key: '',
    field_type: 'text',
    options: '',
    is_required: false,
    sort_order: 0,
  });

  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listCustomFields();
      setFields(data.data);
    } catch {
      addToast('Failed to load custom fields', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchFields(); }, [fetchFields]);

  const openCreate = () => {
    setEditField(null);
    setForm({ name: '', field_key: '', field_type: 'text', options: '', is_required: false, sort_order: 0 });
    setShowModal(true);
  };

  const openEdit = (field: CustomField) => {
    setEditField(field);
    setForm({
      name: field.name,
      field_key: field.field_key,
      field_type: field.field_type,
      options: field.options ? field.options.join(', ') : '',
      is_required: field.is_required,
      sort_order: field.sort_order,
    });
    setShowModal(true);
  };

  const handleNameChange = (value: string) => {
    setForm((f) => ({
      ...f,
      name: value,
      field_key: editField ? f.field_key : generateFieldKey(value),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.field_key) {
      addToast('Name and key are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        field_key: form.field_key,
        field_type: form.field_type,
        is_required: form.is_required,
        sort_order: form.sort_order,
      };
      if (form.field_type === 'dropdown' && form.options.trim()) {
        payload.options = form.options.split(',').map((o) => o.trim()).filter(Boolean);
      }

      if (editField) {
        await updateCustomField(editField.id, payload);
        addToast('Custom field updated', 'success');
      } else {
        await createCustomField(payload);
        addToast('Custom field created', 'success');
      }
      setShowModal(false);
      fetchFields();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save custom field';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomField(deleteTarget.id);
      addToast('Custom field deleted', 'success');
      setDeleteTarget(null);
      fetchFields();
    } catch {
      addToast('Failed to delete custom field', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const typeBadgeVariant = (type: string) => {
    switch (type) {
      case 'text': return 'neutral';
      case 'number': return 'info';
      case 'date': return 'warning';
      case 'boolean': return 'success';
      case 'dropdown': return 'info';
      default: return 'neutral';
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold dark:text-gray-100">Custom Fields</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Define custom fields to capture additional contact data</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Plus className="h-4 w-4" /> Add Field
        </button>
      </div>

      {loading ? <ListSkeleton count={3} /> : fields.length === 0 ? (
        <EmptyState
          icon={GripVertical}
          title="No custom fields defined"
          description="Create custom fields to track additional information about your contacts"
          action={{ label: 'Add Field', onClick: openCreate }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border dark:border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Key</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Required</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Order</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {fields.map((field, i) => (
                <motion.tr
                  key={field.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4 text-sm font-medium dark:text-gray-100">{field.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">{field.field_key}</td>
                  <td className="px-6 py-4">
                    <Badge variant={typeBadgeVariant(field.field_type)}>{field.field_type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {field.is_required ? 'Yes' : 'No'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{field.sort_order}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(field)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(field)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editField ? 'Edit Custom Field' : 'Add Custom Field'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
            >
              {saving && <ButtonSpinner />}
              {editField ? 'Save Changes' : 'Create Field'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextInput
            label="Field Name"
            name="name"
            value={form.name}
            onChange={handleNameChange}
            required
            placeholder="e.g. Company Size"
          />
          <TextInput
            label="Field Key"
            name="field_key"
            value={form.field_key}
            onChange={(v) => setForm((f) => ({ ...f, field_key: v }))}
            required
            placeholder="e.g. company_size"
          />
          <SelectInput
            label="Field Type"
            name="field_type"
            value={form.field_type}
            onChange={(v) => setForm((f) => ({ ...f, field_type: v }))}
            options={FIELD_TYPES}
          />
          {form.field_type === 'dropdown' && (
            <TextInput
              label="Options (comma-separated)"
              name="options"
              value={form.options}
              onChange={(v) => setForm((f) => ({ ...f, options: v }))}
              placeholder="e.g. Small, Medium, Large"
            />
          )}
          <CheckboxInput
            label="Required field"
            checked={form.is_required}
            onChange={(v) => setForm((f) => ({ ...f, is_required: v }))}
            description="Contacts must have a value for this field"
          />
          <TextInput
            label="Sort Order"
            name="sort_order"
            value={String(form.sort_order)}
            onChange={(v) => setForm((f) => ({ ...f, sort_order: parseInt(v) || 0 }))}
            type="number"
            placeholder="0"
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Custom Field"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? All stored values for this field will be permanently removed.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
