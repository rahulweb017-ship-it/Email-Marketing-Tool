import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Star, Copy, Trash2, FileText, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import { TextInput, SelectInput } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ButtonSpinner } from '../components/ui/Spinner';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';
import VersionHistoryPanel from '../components/templates/VersionHistoryPanel';

interface Template {
  id: string;
  name: string;
  subject: string | null;
  body_html: string | null;
  is_favorite: boolean;
  category: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: '', label: 'No category' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'announcement', label: 'Announcement' },
];

export default function TemplatesPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', subject: '', category: '' });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [versionTarget, setVersionTarget] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/templates', { params: { per_page: 50 } });
      setTemplates(data.data);
    } catch {
      addToast('Failed to load templates', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const payload: Record<string, string> = { name: createForm.name };
      if (createForm.subject) payload.subject = createForm.subject;
      if (createForm.category) payload.category = createForm.category;
      const { data } = await api.post('/templates', payload);
      addToast('Template created', 'success');
      setShowCreate(false);
      setCreateForm({ name: '', subject: '', category: '' });
      navigate(`/templates/${data.id}/edit`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create template';
      addToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/templates/${deleteTarget.id}`);
      addToast('Template deleted', 'success');
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      addToast('Failed to delete template', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/templates/${id}/duplicate`);
      addToast('Template duplicated', 'success');
      fetchTemplates();
    } catch {
      addToast('Failed to duplicate template', 'error');
    }
  };

  const handleFavorite = async (t: Template) => {
    try {
      await api.patch(`/templates/${t.id}`, { is_favorite: !t.is_favorite });
      setTemplates((prev) => prev.map((tpl) => tpl.id === t.id ? { ...tpl, is_favorite: !tpl.is_favorite } : tpl));
    } catch {
      addToast('Failed to update template', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-gray-100">Email Templates</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      {loading ? <CardGridSkeleton /> : templates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <EmptyState icon={FileText} title="No templates yet" description="Create your first email template"
            action={{ label: 'New Template', onClick: () => setShowCreate(true) }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden cursor-pointer group"
              onClick={() => navigate(`/templates/${t.id}/edit`)}
            >
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-300" />
              <div className="h-40 bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                {t.body_html ? (
                  <iframe srcDoc={t.body_html} className="w-full h-full pointer-events-none scale-50 origin-top-left" style={{ width: '200%', height: '200%' }} title={t.name} sandbox="" />
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No preview</p>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate dark:text-gray-100">{t.name}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleFavorite(t); }}
                    className="text-gray-400 hover:text-amber-500"
                  >
                    <Star className={`h-4 w-4 ${t.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                </div>
                {t.subject && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">{t.subject}</p>}
                {t.category && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">{t.category}</span>
                )}
                <div className="mt-3 pt-3 border-t dark:border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</span>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setVersionTarget(t.id)} className="p-1 text-gray-400 hover:text-primary-600" title="Version History">
                      <History className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDuplicate(t.id)} className="p-1 text-gray-400 hover:text-primary-600" title="Duplicate">
                      <Copy className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(t)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Template" size="md" footer={
        <div className="flex justify-end gap-3">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={handleCreate} disabled={creating || !createForm.name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
            {creating && <ButtonSpinner />} Create & Edit
          </button>
        </div>
      }>
        <div className="space-y-4">
          <TextInput label="Template Name" name="name" value={createForm.name} onChange={(v) => setCreateForm({ ...createForm, name: v })} required placeholder="e.g. Monthly Newsletter" />
          <TextInput label="Default Subject" name="subject" value={createForm.subject} onChange={(v) => setCreateForm({ ...createForm, subject: v })} placeholder="Optional default subject line" />
          <SelectInput label="Category" name="category" value={createForm.category} onChange={(v) => setCreateForm({ ...createForm, category: v })} options={CATEGORIES} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Template" message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete" variant="danger" loading={deleting} />

      {versionTarget && (
        <VersionHistoryPanel
          isOpen={!!versionTarget}
          onClose={() => setVersionTarget(null)}
          templateId={versionTarget}
        />
      )}
    </div>
  );
}
