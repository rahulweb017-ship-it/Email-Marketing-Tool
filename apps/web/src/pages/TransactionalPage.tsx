import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit, X } from 'lucide-react';
import {
  listTransactionalTemplates,
  createTransactionalTemplate,
  updateTransactionalTemplate,
  deleteTransactionalTemplate,
  listTransactionalMessages,
} from '../api/transactional';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useToastStore } from '../stores/toast.store';

interface Template {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_design: Record<string, unknown> | null;
  variables: string[];
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  template_name: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

type Tab = 'templates' | 'messages';

export default function TransactionalPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<Tab>('templates');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Transactional Email</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage templates and send transactional emails via API</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(['templates', 'messages'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'templates' ? 'Templates' : 'Message Log'}
          </button>
        ))}
      </div>

      {activeTab === 'templates' ? (
        <TemplatesTab addToast={addToast} />
      ) : (
        <MessagesTab addToast={addToast} />
      )}
    </div>
  );
}

// ── Templates Tab ──────────────────────────────────────────

function TemplatesTab({ addToast }: { addToast: (msg: string, type: 'success' | 'error') => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Template | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBodyHtml, setFormBodyHtml] = useState('');
  const [formVariables, setFormVariables] = useState<string[]>([]);
  const [varInput, setVarInput] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listTransactionalTemplates();
      setTemplates(data.data);
    } catch {
      addToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setEditTarget(null);
    setFormName('');
    setFormSubject('');
    setFormBodyHtml('');
    setFormVariables([]);
    setVarInput('');
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditTarget(t);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBodyHtml(t.body_html);
    setFormVariables(typeof t.variables === 'string' ? JSON.parse(t.variables as unknown as string) : (t.variables ?? []));
    setVarInput('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formName,
        subject: formSubject,
        body_html: formBodyHtml,
        variables: formVariables,
      };
      if (editTarget) {
        await updateTransactionalTemplate(editTarget.id, payload);
        addToast('Template updated', 'success');
      } else {
        await createTransactionalTemplate(payload);
        addToast('Template created', 'success');
      }
      setShowModal(false);
      fetchTemplates();
    } catch {
      addToast('Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransactionalTemplate(deleteTarget.id);
      addToast('Template deleted', 'success');
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      addToast('Failed to delete template', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const addVariable = () => {
    const v = varInput.trim();
    if (v && !formVariables.includes(v)) {
      setFormVariables([...formVariables, v]);
    }
    setVarInput('');
  };

  const removeVariable = (v: string) => {
    setFormVariables(formVariables.filter((x) => x !== v));
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Templates</h2>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No transactional templates yet. Create one to get started.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Variables</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => {
                const vars = typeof t.variables === 'string' ? JSON.parse(t.variables as unknown as string) : (t.variables ?? []);
                return (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="px-4 py-3 text-sm font-medium dark:text-gray-200">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.subject}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {(vars as string[]).map((v: string) => (
                          <span key={v} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editTarget ? 'Edit Template' : 'New Template'}
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formName || !formSubject || !formBodyHtml}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editTarget ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. welcome-email"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
            <input
              type="text"
              value={formSubject}
              onChange={(e) => setFormSubject(e.target.value)}
              placeholder="Welcome, {{name}}!"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body HTML</label>
            <textarea
              value={formBodyHtml}
              onChange={(e) => setFormBodyHtml(e.target.value)}
              rows={8}
              placeholder="<h1>Hello {{name}}</h1><p>Welcome to our service!</p>"
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variables</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={varInput}
                onChange={(e) => setVarInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariable(); } }}
                placeholder="variable name"
                className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addVariable}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 text-sm transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formVariables.map((v) => (
                <span key={v} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-xs">
                  {`{{${v}}}`}
                  <button onClick={() => removeVariable(v)} className="hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}

// ── Messages Tab ───────────────────────────────────────────

function MessagesTab({ addToast }: { addToast: (msg: string, type: 'success' | 'error') => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const perPage = 20;

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), per_page: String(perPage) };
      if (statusFilter) params.status = statusFilter;
      const { data } = await listTransactionalMessages(params);
      setMessages(data.data);
      setTotal(data.total);
    } catch {
      addToast('Failed to load messages', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, addToast]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      queued: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold dark:text-white">Message Log</h2>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No transactional messages yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">To</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subject</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Template</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="px-4 py-3 text-sm dark:text-gray-200">
                    {m.to_name ? `${m.to_name} <${m.to_email}>` : m.to_email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{m.subject}</td>
                  <td className="px-4 py-3 text-sm">{statusBadge(m.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{m.template_name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {m.sent_at ? new Date(m.sent_at).toLocaleString() : '-'}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > perPage && (
        <Pagination page={page} total={total} perPage={perPage} onPageChange={setPage} />
      )}
    </>
  );
}
