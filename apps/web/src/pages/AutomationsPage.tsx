import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Play, Square, Users, Workflow, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import DropdownMenu from '../components/ui/DropdownMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { TextInput } from '../components/ui/FormField';
import { ButtonSpinner } from '../components/ui/Spinner';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';

interface AutomationCampaign {
  id: string;
  name: string;
  state: string;
  running_participant_count: number;
  completed_participant_count: number;
  last_sync_at: string | null;
  created_at: string;
}

const stateConfig: Record<string, { variant: 'neutral' | 'success' | 'danger'; pulse?: boolean }> = {
  draft: { variant: 'neutral' },
  running: { variant: 'success', pulse: true },
  stopped: { variant: 'danger' },
};

export default function AutomationsPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [automations, setAutomations] = useState<AutomationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AutomationCampaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stopTarget, setStopTarget] = useState<AutomationCampaign | null>(null);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/automations', { params: { per_page: 50 } });
      setAutomations(data.data);
    } catch {
      addToast('Failed to load automations', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/automations', { name: createName });
      addToast('Automation created', 'success');
      setShowCreate(false);
      setCreateName('');
      navigate(`/automations/${data.id}/edit`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create';
      addToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleAction = async (id: string, action: 'start' | 'stop') => {
    try {
      await api.post(`/automations/${id}/${action}`);
      addToast(`Automation ${action === 'start' ? 'started' : 'stopped'}`, 'success');
      setStopTarget(null);
      fetchAutomations();
    } catch {
      addToast(`Failed to ${action} automation`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/automations/${deleteTarget.id}`);
      addToast('Automation deleted', 'success');
      setDeleteTarget(null);
      fetchAutomations();
    } catch {
      addToast('Failed to delete automation', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-gray-100">Automations</h1>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="h-4 w-4" /> New Automation
        </button>
      </div>

      {loading ? <ListSkeleton /> : automations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <EmptyState icon={Workflow} title="No automations yet" description="Create your first marketing automation workflow"
            action={{ label: 'New Automation', onClick: () => setShowCreate(true) }} />
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map((a, i) => {
            const cfg = stateConfig[a.state] || stateConfig.draft;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                whileHover={{ y: -2, boxShadow: '0 8px 20px -6px rgba(0,0,0,0.1)' }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg dark:text-gray-100">{a.name}</h3>
                      <Badge variant={cfg.variant} pulse={cfg.pulse}>{a.state}</Badge>
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {a.running_participant_count} running</span>
                      <span>{a.completed_participant_count} completed</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.state === 'draft' && (
                      <button onClick={() => handleAction(a.id, 'start')}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                        <Play className="h-4 w-4" /> Start
                      </button>
                    )}
                    {a.state === 'running' && (
                      <button onClick={() => setStopTarget(a)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                        <Square className="h-4 w-4" /> Stop
                      </button>
                    )}
                    <button onClick={() => navigate(`/automations/${a.id}/edit`)}
                      className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                      Edit Workflow
                    </button>
                    <DropdownMenu items={[
                      ...(a.state !== 'running' ? [{ label: 'Delete', icon: Trash2, onClick: () => setDeleteTarget(a), variant: 'danger' as const }] : []),
                    ]} />
                  </div>
                </div>
                {a.last_sync_at && <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">Last synced: {new Date(a.last_sync_at).toLocaleString()}</div>}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Automation" size="sm" footer={
        <div className="flex justify-end gap-3">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={handleCreate} disabled={creating || !createName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
            {creating && <ButtonSpinner />} Create & Edit
          </button>
        </div>
      }>
        <TextInput label="Automation Name" name="name" value={createName} onChange={setCreateName} required placeholder="e.g. Welcome Email Series" />
      </Modal>

      <ConfirmDialog isOpen={!!stopTarget} onClose={() => setStopTarget(null)}
        onConfirm={() => stopTarget && handleAction(stopTarget.id, 'stop')}
        title="Stop Automation" message={`Are you sure you want to stop "${stopTarget?.name}"? Running participants will not receive further emails.`}
        confirmLabel="Stop" variant="warning" />

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Automation" message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete" variant="danger" loading={deleting} />
    </div>
  );
}
