import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { TextInput, TextArea, CheckboxInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import api from '../../api/client';

interface ListFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  list?: { id: string; name: string; description: string | null; is_public: boolean; is_double_optin: boolean } | null;
}

export default function ListFormModal({ isOpen, onClose, onSaved, list }: ListFormModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_public: false, is_double_optin: false });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (list) {
        setForm({ name: list.name, description: list.description || '', is_public: list.is_public, is_double_optin: list.is_double_optin });
      } else {
        setForm({ name: '', description: '', is_public: false, is_double_optin: false });
      }
      setErrors({});
    }
  }, [isOpen, list]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.description) delete payload.description;
      if (list) {
        await api.patch(`/lists/${list.id}`, payload);
        addToast('List updated', 'success');
      } else {
        await api.post('/lists', payload);
        addToast('List created', 'success');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save list';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={list ? 'Edit List' : 'New Mailing List'} size="md" footer={
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
        <button onClick={handleSubmit} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
          {loading && <ButtonSpinner />}
          {list ? 'Save Changes' : 'Create List'}
        </button>
      </div>
    }>
      <div className="space-y-4">
        <TextInput label="Name" name="name" value={form.name} onChange={(v) => { setForm({ ...form, name: v }); setErrors({}); }} required error={errors.name} placeholder="e.g. Newsletter Subscribers" />
        <TextArea label="Description" name="description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Optional description" />
        <CheckboxInput label="Public List" checked={form.is_public} onChange={(v) => setForm({ ...form, is_public: v })} description="Allow contacts to subscribe via public forms" />
        <CheckboxInput label="Double Opt-in" checked={form.is_double_optin} onChange={(v) => setForm({ ...form, is_double_optin: v })} description="New subscribers will receive a confirmation email before being added to this list." />
      </div>
    </Modal>
  );
}
