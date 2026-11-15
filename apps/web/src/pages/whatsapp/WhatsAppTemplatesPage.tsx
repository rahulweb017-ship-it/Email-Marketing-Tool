import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, FileText, Sparkles } from 'lucide-react';
import WhatsAppTabs from '../../components/whatsapp/WhatsAppTabs';
import { TemplateStatusBadge } from '../../components/whatsapp/WaBadges';
import AiComposeModal from '../../components/whatsapp/AiComposeModal';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { SelectInput, TextArea, TextInput, CheckboxInput } from '../../components/ui/FormField';
import { useToastStore } from '../../stores/toast.store';
import {
  apiError, createWaTemplate, deleteWaTemplate, listWaAccounts, listWaTemplates, syncWaTemplates,
  type WaAccount, type WaTemplate,
} from '../../api/whatsapp';

export default function WhatsAppTemplatesPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [deleting, setDeleting] = useState<WaTemplate | null>(null);
  const [form, setForm] = useState({ account_id: '', name: '', body: '', language: 'en', category: 'MARKETING', submit_to_meta: false });

  const load = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([listWaAccounts(), listWaTemplates()]);
      setAccounts(a); setTemplates(t);
    } catch (err) { addToast(apiError(err, 'Failed to load templates'), 'error'); } finally { setLoading(false); }
  }, [addToast]);
  useEffect(() => { load(); }, [load]);

  const selectedAccount = accounts.find((a) => a.id === form.account_id);
  const isMeta = selectedAccount?.provider === 'meta_cloud';

  const sync = async (id: string) => {
    setSyncing(id);
    try { const r = await syncWaTemplates(id); addToast(`Synced ${r.synced} templates from Meta`, 'success'); load(); }
    catch (err) { addToast(apiError(err, 'Sync failed'), 'error'); } finally { setSyncing(null); }
  };

  const openCreate = () => {
    setForm({ account_id: accounts[0]?.id || '', name: '', body: '', language: 'en', category: 'MARKETING', submit_to_meta: accounts[0]?.provider === 'meta_cloud' });
    setCreateOpen(true);
  };

  const create = async () => {
    try {
      const body = isMeta && form.submit_to_meta
        ? form.body.replace(/\{\{\s*[\w.|]+\s*\}\}/g, (() => { let n = 0; return () => `{{${++n}}}`; })())
        : form.body;
      await createWaTemplate({ ...form, body, submit_to_meta: isMeta && form.submit_to_meta });
      addToast(isMeta && form.submit_to_meta ? 'Sent to Meta for approval. This usually takes a few minutes.' : 'Template saved', 'success');
      setCreateOpen(false); load();
    } catch (err) { addToast(apiError(err, 'Could not save the template'), 'error'); }
  };

  const remove = async () => {
    if (!deleting) return;
    try { await deleteWaTemplate(deleting.id); setDeleting(null); load(); } catch (err) { addToast(apiError(err, 'Delete failed'), 'error'); }
  };

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name || 'All numbers';

  const actions = (
    <>
      {accounts.filter((a) => a.provider === 'meta_cloud').map((a) => (
        <button key={a.id} onClick={() => sync(a.id)} disabled={syncing === a.id}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">
          <RefreshCw className={`h-4 w-4 ${syncing === a.id ? 'animate-spin' : ''}`} /> Sync {a.name}
        </button>
      ))}
      <button onClick={openCreate} disabled={!accounts.length} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50">
        <Plus className="h-4 w-4" /> New template
      </button>
    </>
  );

  return (
    <div>
      <WhatsAppTabs title="WhatsApp templates" subtitle="Meta-approved templates for campaigns, and saved messages for QR numbers" actions={actions} />
      {loading ? <ListSkeleton /> : templates.length === 0 ? (
        <EmptyState icon={FileText} title="No templates yet"
          description="Meta numbers need an approved template to start a conversation. Sync them, or create one and submit it for approval."
          action={accounts.length ? { label: 'Create a template', onClick: openCreate } : undefined} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</h3>
                  <p className="text-xs text-gray-500">{accountName(t.account_id)} · {t.language}{t.category ? ` · ${t.category.toLowerCase()}` : ''} · {t.source === 'meta' ? 'Meta' : 'Saved message'}</p>
                </div>
                <TemplateStatusBadge status={t.status} />
              </div>
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-6 flex-1 bg-[#d9fdd3]/40 dark:bg-green-900/20 rounded-lg p-3">{t.body || '(no body text)'}</p>
              {t.rejection_reason && <p className="mt-2 text-xs text-red-600">Rejected: {t.rejection_reason}</p>}
              <div className="mt-3 flex justify-end">
                <button onClick={() => setDeleting(t)} className="flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New WhatsApp template" size="lg"
        footer={<div className="flex justify-end gap-2">
          <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={create} disabled={!form.account_id || !form.name || !form.body} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
            {isMeta && form.submit_to_meta ? 'Submit to Meta' : 'Save'}
          </button>
        </div>}>
        <div className="space-y-4">
          <SelectInput label="Number" name="account" value={form.account_id} onChange={(v) => setForm({ ...form, account_id: v, submit_to_meta: accounts.find((a) => a.id === v)?.provider === 'meta_cloud' })}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.provider === 'meta_cloud' ? 'Meta' : 'QR'})` }))} />
          <TextInput label={isMeta && form.submit_to_meta ? 'Template name (lowercase_with_underscores)' : 'Name'} name="name" value={form.name}
            onChange={(v) => setForm({ ...form, name: isMeta && form.submit_to_meta ? v.toLowerCase().replace(/[^a-z0-9_]/g, '_') : v })} placeholder="diwali_offer" />
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</span>
              <button onClick={() => setAiOpen(true)} className="flex items-center gap-1 text-xs text-rose-600 hover:underline"><Sparkles className="h-3.5 w-3.5" /> Write with AI</button>
            </div>
            <TextArea label="" name="body" rows={7} value={form.body} onChange={(v) => setForm({ ...form, body: v })}
              placeholder="Hi {{first_name|there}}! Our Diwali sale is live: 20% off everything until Sunday. Reply YES to get the catalogue." />
            <p className="text-xs text-gray-500 mt-1">
              Personalise with {'{{first_name}}'}, {'{{company_name}}'} or {'{{custom.city}}'}.
              {isMeta && form.submit_to_meta && ' For Meta they become {{1}}, {{2}}… and you map them to contact fields when you create a campaign.'}
            </p>
          </div>
          {isMeta && (
            <>
              <CheckboxInput label="Submit to Meta for approval" checked={form.submit_to_meta} onChange={(v) => setForm({ ...form, submit_to_meta: v })}
                description="Required before a Meta number can use this template to start conversations." />
              {form.submit_to_meta && (
                <div className="grid grid-cols-2 gap-4">
                  <SelectInput label="Category" name="category" value={form.category} onChange={(v) => setForm({ ...form, category: v })}
                    options={[{ value: 'MARKETING', label: 'Marketing' }, { value: 'UTILITY', label: 'Utility (orders, updates)' }]} />
                  <SelectInput label="Language" name="language" value={form.language} onChange={(v) => setForm({ ...form, language: v })}
                    options={[{ value: 'en', label: 'English' }, { value: 'en_US', label: 'English (US)' }, { value: 'hi', label: 'Hindi' }, { value: 'mr', label: 'Marathi' }, { value: 'gu', label: 'Gujarati' }, { value: 'ta', label: 'Tamil' }, { value: 'te', label: 'Telugu' }, { value: 'bn', label: 'Bengali' }]} />
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <AiComposeModal open={aiOpen} forTemplate={isMeta && form.submit_to_meta} onClose={() => setAiOpen(false)}
        onUse={(message) => { setForm((f) => ({ ...f, body: message })); setAiOpen(false); }} />

      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} variant="danger" title="Delete template?" confirmLabel="Delete"
        message={deleting?.source === 'meta' ? 'It will also be deleted from your Meta WhatsApp account.' : 'This saved message will be removed.'} />
    </div>
  );
}
