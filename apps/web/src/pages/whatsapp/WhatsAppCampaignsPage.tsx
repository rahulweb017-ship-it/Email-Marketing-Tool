import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Megaphone, Pause, Play, XCircle, Pencil, Trash2, BarChart3 } from 'lucide-react';
import WhatsAppTabs from '../../components/whatsapp/WhatsAppTabs';
import WhatsAppCampaignWizard from '../../components/whatsapp/WhatsAppCampaignWizard';
import { CampaignStateBadge } from '../../components/whatsapp/WaBadges';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useToastStore } from '../../stores/toast.store';
import {
  apiError, cancelWaCampaign, deleteWaCampaign, getWaCampaign, listWaCampaigns, pauseWaCampaign, resumeWaCampaign,
  type WaCampaign,
} from '../../api/whatsapp';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

export default function WhatsAppCampaignsPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [params, setParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(params.get('new') === '1');
  const [editing, setEditing] = useState<WaCampaign | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'cancel' | 'delete'; c: WaCampaign } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listWaCampaigns({ page, per_page: 20 });
      setCampaigns(res.data); setTotal(res.total);
    } catch (err) { addToast(apiError(err, 'Failed to load campaigns'), 'error'); } finally { setLoading(false); }
  }, [page, addToast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!campaigns.some((c) => ['sending', 'queued'].includes(c.state))) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [campaigns, load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); addToast(ok, 'success'); load(); } catch (err) { addToast(apiError(err, 'Action failed'), 'error'); }
  };

  const edit = async (c: WaCampaign) => {
    try { setEditing(await getWaCampaign(c.id)); setWizardOpen(true); } catch (err) { addToast(apiError(err, 'Failed to open'), 'error'); }
  };

  const closeWizard = () => { setWizardOpen(false); setEditing(null); if (params.get('new')) { params.delete('new'); setParams(params); } };

  const doConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'cancel') await act(() => cancelWaCampaign(confirm.c.id), 'Campaign cancelled');
    else await act(() => deleteWaCampaign(confirm.c.id), 'Campaign deleted');
    setConfirm(null);
  };

  return (
    <div>
      <WhatsAppTabs title="WhatsApp campaigns" subtitle="Send one message to many contacts, safely paced"
        actions={<button onClick={() => { setEditing(null); setWizardOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"><Plus className="h-4 w-4" /> New campaign</button>} />

      {loading ? <TableSkeleton /> : campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No WhatsApp campaigns yet" description="Pick a list, write or choose a template, and Rabbit Growth sends at a safe pace."
          action={{ label: 'Create a campaign', onClick: () => setWizardOpen(true) }} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Progress</th>
                <th className="px-4 py-3 font-medium">Delivered</th>
                <th className="px-4 py-3 font-medium">Read</th>
                <th className="px-4 py-3 font-medium">Replied</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const done = c.stat_sent + c.stat_failed;
                return (
                  <tr key={c.id} className="border-b last:border-0 border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">
                      <button onClick={() => navigate(`/whatsapp/campaigns/${c.id}`)} className="font-medium text-gray-900 dark:text-gray-100 hover:text-green-600 text-left">{c.name}</button>
                      <div className="text-xs text-gray-500">{c.account_name} · {c.schedule_at ? new Date(c.schedule_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <CampaignStateBadge state={c.state} />
                      {c.failure_reason && ['failed', 'paused'].includes(c.state) && <div className="text-xs text-red-600 mt-1 max-w-xs">{c.failure_reason}</div>}
                    </td>
                    <td className="px-4 py-3 w-40">
                      {c.stat_total ? (
                        <>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{done.toLocaleString('en-IN')} / {c.stat_total.toLocaleString('en-IN')}</div>
                          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${(done / c.stat_total) * 100}%` }} /></div>
                        </>
                      ) : <span className="text-xs text-gray-400">–</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pct(c.stat_delivered, c.stat_sent)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pct(c.stat_read, c.stat_sent)}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.stat_replied.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button title="Report" onClick={() => navigate(`/whatsapp/campaigns/${c.id}`)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><BarChart3 className="h-4 w-4" /></button>
                        {['draft', 'scheduled'].includes(c.state) && <button title="Edit" onClick={() => edit(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Pencil className="h-4 w-4" /></button>}
                        {c.state === 'sending' && <button title="Pause" onClick={() => act(() => pauseWaCampaign(c.id), 'Campaign paused')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-amber-600"><Pause className="h-4 w-4" /></button>}
                        {c.state === 'paused' && <button title="Resume" onClick={() => act(() => resumeWaCampaign(c.id), 'Campaign resumed')} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600"><Play className="h-4 w-4" /></button>}
                        {['scheduled', 'queued', 'sending', 'paused'].includes(c.state) && <button title="Cancel" onClick={() => setConfirm({ kind: 'cancel', c })} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"><XCircle className="h-4 w-4" /></button>}
                        {['draft', 'done', 'cancelled', 'failed'].includes(c.state) && <button title="Delete" onClick={() => setConfirm({ kind: 'delete', c })} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-3"><Pagination page={page} total={total} perPage={20} onPageChange={setPage} /></div>
        </div>
      )}

      <WhatsAppCampaignWizard open={wizardOpen} campaign={editing} onClose={closeWizard} onSaved={() => { closeWizard(); load(); }} />
      <ConfirmDialog isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={doConfirm} variant="danger"
        title={confirm?.kind === 'cancel' ? 'Cancel this campaign?' : 'Delete this campaign?'}
        confirmLabel={confirm?.kind === 'cancel' ? 'Cancel campaign' : 'Delete'}
        message={confirm?.kind === 'cancel' ? 'Messages not yet sent will not go out. Messages already sent are not recalled.' : 'The campaign and its report will be removed. Conversations stay in the inbox.'} />
    </div>
  );
}
