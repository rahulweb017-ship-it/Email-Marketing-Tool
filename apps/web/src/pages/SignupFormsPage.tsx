import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit, Code, Copy, Check } from 'lucide-react';
import { listForms, createForm, updateForm, deleteForm, getFormEmbed } from '../api/forms';
import { listCustomFields } from '../api/custom-fields';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToastStore } from '../stores/toast.store';

interface SignupForm {
  id: string;
  name: string;
  description: string | null;
  list_ids: string[];
  custom_field_ids: string[];
  success_message: string;
  redirect_url: string | null;
  style: { primary_color?: string; background_color?: string };
  honeypot_enabled: boolean;
  double_optin: boolean;
  status: string;
  submit_count: number;
  created_at: string;
  updated_at: string;
}

interface ListOption {
  id: string;
  name: string;
}

interface CustomFieldOption {
  id: string;
  name: string;
  field_key: string;
  field_type: string;
}

export default function SignupFormsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [forms, setForms] = useState<SignupForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<SignupForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SignupForm | null>(null);
  const [embedTarget, setEmbedTarget] = useState<string | null>(null);
  const [embedHtml, setEmbedHtml] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Available options
  const [lists, setLists] = useState<ListOption[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldOption[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formListIds, setFormListIds] = useState<string[]>([]);
  const [formCustomFieldIds, setFormCustomFieldIds] = useState<string[]>([]);
  const [formSuccessMessage, setFormSuccessMessage] = useState('Thank you for subscribing!');
  const [formRedirectUrl, setFormRedirectUrl] = useState('');
  const [formPrimaryColor, setFormPrimaryColor] = useState('#4f46e5');
  const [formBgColor, setFormBgColor] = useState('#ffffff');
  const [formHoneypot, setFormHoneypot] = useState(true);
  const [formDoubleOptin, setFormDoubleOptin] = useState(true);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listForms();
      setForms(data.data);
    } catch {
      addToast('Failed to load forms', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchOptions = useCallback(async () => {
    try {
      const [listsRes, fieldsRes] = await Promise.all([
        api.get('/lists', { params: { per_page: 100 } }),
        listCustomFields(),
      ]);
      setLists(listsRes.data.data);
      setCustomFields(fieldsRes.data.data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchForms(); fetchOptions(); }, [fetchForms, fetchOptions]);

  const resetFormState = () => {
    setFormName('');
    setFormDescription('');
    setFormListIds([]);
    setFormCustomFieldIds([]);
    setFormSuccessMessage('Thank you for subscribing!');
    setFormRedirectUrl('');
    setFormPrimaryColor('#4f46e5');
    setFormBgColor('#ffffff');
    setFormHoneypot(true);
    setFormDoubleOptin(true);
    setFormStatus('active');
  };

  const openCreate = () => {
    setEditTarget(null);
    resetFormState();
    setShowModal(true);
  };

  const openEdit = (f: SignupForm) => {
    setEditTarget(f);
    setFormName(f.name);
    setFormDescription(f.description || '');
    const lIds = typeof f.list_ids === 'string' ? JSON.parse(f.list_ids as unknown as string) : (f.list_ids || []);
    setFormListIds(lIds);
    const cfIds = typeof f.custom_field_ids === 'string' ? JSON.parse(f.custom_field_ids as unknown as string) : (f.custom_field_ids || []);
    setFormCustomFieldIds(cfIds);
    setFormSuccessMessage(f.success_message || 'Thank you for subscribing!');
    setFormRedirectUrl(f.redirect_url || '');
    const style = typeof f.style === 'string' ? JSON.parse(f.style as unknown as string) : (f.style || {});
    setFormPrimaryColor(style.primary_color || '#4f46e5');
    setFormBgColor(style.background_color || '#ffffff');
    setFormHoneypot(f.honeypot_enabled);
    setFormDoubleOptin(f.double_optin);
    setFormStatus(f.status as 'active' | 'inactive');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { addToast('Name is required', 'error'); return; }
    if (formListIds.length === 0) { addToast('Select at least one list', 'error'); return; }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDescription || undefined,
        list_ids: formListIds,
        custom_field_ids: formCustomFieldIds,
        success_message: formSuccessMessage,
        redirect_url: formRedirectUrl || undefined,
        style: { primary_color: formPrimaryColor, background_color: formBgColor },
        honeypot_enabled: formHoneypot,
        double_optin: formDoubleOptin,
        status: formStatus,
      };
      if (editTarget) {
        await updateForm(editTarget.id, payload);
        addToast('Form updated', 'success');
      } else {
        await createForm(payload);
        addToast('Form created', 'success');
      }
      setShowModal(false);
      fetchForms();
    } catch {
      addToast('Failed to save form', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteForm(deleteTarget.id);
      addToast('Form deleted', 'success');
      setDeleteTarget(null);
      fetchForms();
    } catch {
      addToast('Failed to delete form', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openEmbed = async (formId: string) => {
    try {
      const { data } = await getFormEmbed(formId);
      setEmbedHtml(data.html);
      setEmbedTarget(formId);
      setCopied(false);
    } catch {
      addToast('Failed to get embed code', 'error');
    }
  };

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleListId = (id: string) => {
    setFormListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCustomFieldId = (id: string) => {
    setFormCustomFieldIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.inactive}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Signup Forms</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create embeddable forms to grow your subscriber lists</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          New Form
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : forms.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No signup forms yet. Create one to get started.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Submissions</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <motion.tr
                  key={f.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium dark:text-gray-200">{f.name}</div>
                    {f.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">{f.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{statusBadge(f.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{f.submit_count}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(f.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEmbed(f.id)}
                        title="Get Embed Code"
                        className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Code className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEdit(f)}
                        title="Edit"
                        className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(f)}
                        title="Delete"
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? 'Edit Form' : 'New Form'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formName}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Newsletter Signup"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={2}
              placeholder="Shown at the top of the form"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Lists */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subscribe to Lists *</label>
            {lists.length === 0 ? (
              <p className="text-sm text-gray-400">No lists available. Create a list first.</p>
            ) : (
              <div className="border dark:border-gray-600 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {lists.map((l) => (
                  <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formListIds.includes(l.id)}
                      onChange={() => toggleListId(l.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{l.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Custom Fields to Include</label>
              <div className="border dark:border-gray-600 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {customFields.map((cf) => (
                  <label key={cf.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCustomFieldIds.includes(cf.id)}
                      onChange={() => toggleCustomFieldId(cf.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{cf.name}</span>
                    <span className="text-xs text-gray-400">({cf.field_type})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Success Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Success Message</label>
            <input
              type="text"
              value={formSuccessMessage}
              onChange={(e) => setFormSuccessMessage(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Redirect URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Redirect URL (optional)</label>
            <input
              type="text"
              value={formRedirectUrl}
              onChange={(e) => setFormRedirectUrl(e.target.value)}
              placeholder="https://example.com/thank-you"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Style Options */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formPrimaryColor}
                  onChange={(e) => setFormPrimaryColor(e.target.value)}
                  className="h-9 w-12 border dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formPrimaryColor}
                  onChange={(e) => setFormPrimaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Background Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formBgColor}
                  onChange={(e) => setFormBgColor(e.target.value)}
                  className="h-9 w-12 border dark:border-gray-600 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formBgColor}
                  onChange={(e) => setFormBgColor(e.target.value)}
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formHoneypot}
                onChange={(e) => setFormHoneypot(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Honeypot Protection</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Adds a hidden field to catch spam bots</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formDoubleOptin}
                onChange={(e) => setFormDoubleOptin(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Double Opt-in</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">Require email confirmation before subscribing</p>
              </div>
            </label>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Embed Code Modal */}
      <Modal
        isOpen={!!embedTarget}
        onClose={() => setEmbedTarget(null)}
        title="Embed Code"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setEmbedTarget(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Close
            </button>
            <button
              onClick={copyEmbed}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        }
      >
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Copy and paste this HTML snippet into your website to display the signup form.
          </p>
          <pre className="bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded-lg p-4 text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap break-all">
            {embedHtml}
          </pre>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Form"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}
