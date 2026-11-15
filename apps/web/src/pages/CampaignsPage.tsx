import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Send, Clock, FileEdit, CheckCircle, Copy, XCircle, BarChart3, CalendarClock, Download, FlaskConical, AlertTriangle, GitCompare } from 'lucide-react';
import api from '../api/client';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import DropdownMenu from '../components/ui/DropdownMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';
import CampaignWizard from '../components/campaigns/CampaignWizard';
import CampaignStatsModal from '../components/campaigns/CampaignStatsModal';
import ABTestWizard from '../components/campaigns/ABTestWizard';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  email_from: string;
  reply_to: string | null;
  body_html: string | null;
  state: string;
  use_blacklist: boolean;
  stat_total: number;
  stat_sent: number;
  stat_opened: number;
  stat_clicked: number;
  sent_date: string | null;
  schedule_date: string | null;
  created_at: string;
  list_ids?: string[];
  failure_reason?: string | null;
}

const stateConfig: Record<string, { label: string; variant: 'neutral' | 'warning' | 'info' | 'success' | 'danger'; icon: typeof Send; pulse?: boolean }> = {
  draft: { label: 'Draft', variant: 'neutral', icon: FileEdit },
  scheduled: { label: 'Scheduled', variant: 'info', icon: CalendarClock },
  in_queue: { label: 'Queued', variant: 'warning', icon: Clock },
  sending: { label: 'Sending', variant: 'info', icon: Send, pulse: true },
  done: { label: 'Sent', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'danger', icon: XCircle },
};

const FILTERS = [['', 'All'], ['draft', 'Draft'], ['scheduled', 'Scheduled'], ['in_queue', 'Queued'], ['sending', 'Sending'], ['done', 'Sent']];

export default function CampaignsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statsTarget, setStatsTarget] = useState<Campaign | null>(null);
  const [showAbWizard, setShowAbWizard] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/campaigns', { params: { per_page: 50, state: filter || undefined } });
      setCampaigns(data.data);
    } catch {
      addToast('Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, addToast]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Auto-poll when campaigns are in active states (queued, sending, scheduled)
  useEffect(() => {
    const hasActive = campaigns.some((c) => ['in_queue', 'sending', 'scheduled'].includes(c.state));
    if (!hasActive) return;
    const interval = setInterval(() => {
      api.get('/campaigns', { params: { per_page: 50, state: filter || undefined } })
        .then(({ data }) => setCampaigns(data.data))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [campaigns, filter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/campaigns/${deleteTarget.id}`);
      addToast('Campaign deleted', 'success');
      setDeleteTarget(null);
      fetchCampaigns();
    } catch {
      addToast('Failed to delete campaign', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/duplicate`);
      addToast('Campaign duplicated', 'success');
      fetchCampaigns();
    } catch {
      addToast('Failed to duplicate campaign', 'error');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/cancel`);
      addToast('Campaign cancelled', 'success');
      fetchCampaigns();
    } catch {
      addToast('Failed to cancel campaign', 'error');
    }
  };

  const handleCancelSchedule = async (id: string) => {
    try {
      await api.post(`/campaigns/${id}/cancel-schedule`);
      addToast('Schedule cancelled — campaign returned to draft', 'success');
      fetchCampaigns();
    } catch {
      addToast('Failed to cancel schedule', 'error');
    }
  };

  const handleExportResults = async (campaignId: string) => {
    try {
      const response = await api.post(`/campaigns/${campaignId}/export`, {}, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign-results-${campaignId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('Campaign results exported', 'success');
    } catch {
      addToast('Failed to export campaign results', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < 5) next.add(id);
      }
      return next;
    });
  };

  const handleCompare = () => {
    if (selectedIds.size >= 2 && selectedIds.size <= 5) {
      navigate(`/campaigns/compare?ids=${Array.from(selectedIds).join(',')}`);
    }
  };

  const getMenuItems = (c: Campaign) => {
    const items = [];
    if (c.state === 'draft') {
      items.push({ label: 'Edit', icon: FileEdit, onClick: () => { setEditCampaign(c); setShowWizard(true); } });
    }
    items.push({ label: 'Duplicate', icon: Copy, onClick: () => handleDuplicate(c.id) });
    if (c.state === 'done') {
      items.push({ label: 'View Stats', icon: BarChart3, onClick: () => navigate(`/campaigns/${c.id}/analytics`) });
      items.push({ label: 'Export Results', icon: Download, onClick: () => handleExportResults(c.id) });
    }
    if (c.state === 'scheduled') {
      items.push({ label: 'Cancel Schedule', icon: CalendarClock, onClick: () => handleCancelSchedule(c.id) });
    }
    if (['in_queue', 'sending', 'scheduled'].includes(c.state)) {
      items.push({ label: 'Cancel', icon: XCircle, onClick: () => handleCancel(c.id), variant: 'danger' as const });
    }
    if (['draft', 'cancelled'].includes(c.state)) {
      items.push({ label: 'Delete', icon: XCircle, onClick: () => setDeleteTarget(c), variant: 'danger' as const });
    }
    return items;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-gray-100">Campaigns</h1>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleCompare}
              disabled={selectedIds.size < 2}
              className="flex items-center gap-2 px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <GitCompare className="h-4 w-4" /> Compare ({selectedIds.size})
            </button>
          )}
          <button onClick={() => setShowAbWizard(true)}
            className="flex items-center gap-2 px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 text-sm">
            <FlaskConical className="h-4 w-4" /> New A/B Test
          </button>
          <button onClick={() => { setEditCampaign(null); setShowWizard(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
            <Plus className="h-4 w-4" /> New Campaign
          </button>
        </div>
      </div>

      {/* Animated Tab Filter */}
      <div className="flex gap-2 mb-6 relative">
        {FILTERS.map(([state, label]) => (
          <button key={state} onClick={() => setFilter(state)}
            className="relative px-4 py-2 rounded-lg text-sm z-10">
            {filter === state && (
              <motion.div
                layoutId="activeFilter"
                className="absolute inset-0 bg-primary-100 dark:bg-primary-900/30 rounded-lg"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className={`relative z-10 ${filter === state ? 'text-primary-700 dark:text-primary-400 font-medium' : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {loading ? <ListSkeleton /> : campaigns.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <EmptyState icon={Send} title={filter ? 'No campaigns in this state' : 'No campaigns yet'}
            description="Create your first email campaign"
            action={!filter ? { label: 'New Campaign', onClick: () => setShowWizard(true) } : undefined} />
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c, i) => {
            const config = stateConfig[c.state] || stateConfig.draft;
            const Icon = config.icon;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
                whileHover={{ y: -2, boxShadow: '0 8px 20px -6px rgba(0,0,0,0.1)' }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      disabled={!selectedIds.has(c.id) && selectedIds.size >= 5}
                      className="mt-1.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg dark:text-gray-100">{c.name || c.subject}</h3>
                      <Badge variant={config.variant} pulse={config.pulse}>
                        <span className="flex items-center gap-1"><Icon className="h-3 w-3" /> {config.label}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{c.subject}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.state === 'done' && (
                      <div className="flex gap-6 text-center">
                        <div><p className="text-lg font-bold dark:text-gray-100">{c.stat_sent}</p><p className="text-xs text-gray-500 dark:text-gray-400">Sent</p></div>
                        <div><p className="text-lg font-bold text-amber-600 dark:text-amber-400">{c.stat_opened}</p><p className="text-xs text-gray-500 dark:text-gray-400">Opened</p></div>
                        <div><p className="text-lg font-bold text-green-600 dark:text-green-400">{c.stat_clicked}</p><p className="text-xs text-gray-500 dark:text-gray-400">Clicked</p></div>
                      </div>
                    )}
                    <DropdownMenu items={getMenuItems(c)} />
                  </div>
                </div>
                {c.failure_reason && c.state === 'draft' && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400">{c.failure_reason}</p>
                  </div>
                )}
                <div className="mt-3 text-xs text-gray-400">
                  {c.state === 'scheduled' && c.schedule_date
                    ? `Scheduled for ${new Date(c.schedule_date).toLocaleString()}`
                    : c.sent_date
                      ? `Sent ${new Date(c.sent_date).toLocaleString()}`
                      : `Created ${new Date(c.created_at).toLocaleString()}`}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <CampaignWizard isOpen={showWizard} onClose={() => { setShowWizard(false); setEditCampaign(null); }} onSaved={fetchCampaigns} campaign={editCampaign} />

      <ABTestWizard isOpen={showAbWizard} onClose={() => setShowAbWizard(false)} onSaved={fetchCampaigns} />

      {statsTarget && (
        <CampaignStatsModal isOpen={!!statsTarget} onClose={() => setStatsTarget(null)} campaignId={statsTarget.id} campaignName={statsTarget.name || statsTarget.subject} />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Campaign" message={`Are you sure you want to delete "${deleteTarget?.name || deleteTarget?.subject}"?`}
        confirmLabel="Delete" variant="danger" loading={deleting} />
    </div>
  );
}
