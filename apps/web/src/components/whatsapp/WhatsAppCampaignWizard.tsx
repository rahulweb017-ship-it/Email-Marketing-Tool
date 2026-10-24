import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, Sparkles, AlertTriangle, ShieldCheck, Send, Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import { SelectInput, TextArea, TextInput, CheckboxInput } from '../ui/FormField';
import AiComposeModal from './AiComposeModal';
import { useToastStore } from '../../stores/toast.store';
import api from '../../api/client';
import {
  apiError, createWaCampaign, getWaAudience, listWaAccounts, listWaTemplates, previewWaMessage, scheduleWaCampaign,
  testWaCampaign, updateWaCampaign, type CampaignBody, type WaAccount, type WaCampaign, type WaTemplate,
} from '../../api/whatsapp';

const STEPS = ['Number', 'Audience', 'Message', 'Review & send'];

const FIELD_OPTIONS = [
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'full_name', label: 'Full name' },
  { value: 'company_name', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: '=', label: 'Fixed text…' },
];

interface MailingList { id: string; name: string; contact_count_active?: number }

export default function WhatsAppCampaignWizard({ open, campaign, onClose, onSaved }: {
  open: boolean; campaign?: WaCampaign | null; onClose: () => void; onSaved: () => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [lists, setLists] = useState<MailingList[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [audience, setAudience] = useState<Awaited<ReturnType<typeof getWaAudience>> | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [aiOpen, setAiOpen] = useState(false);
  const [testPhones, setTestPhones] = useState('');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CampaignBody>({ name: '', account_id: '', template_id: null, message_body: '', media: null, variable_mapping: {}, list_ids: [], require_consent: true });

  useEffect(() => {
    if (!open) return;
    setStep(0); setAudience(null); setPreview(''); setTestPhones(''); setWhen('now'); setScheduleAt('');
    setSavedId(campaign?.id ?? null);
    setForm(campaign ? {
      name: campaign.name, account_id: campaign.account_id, template_id: campaign.template_id, message_body: campaign.message_body || '',
      media: campaign.media, variable_mapping: campaign.variable_mapping || {}, list_ids: campaign.list_ids || [], require_consent: campaign.require_consent,
    } : { name: '', account_id: '', template_id: null, message_body: '', media: null, variable_mapping: {}, list_ids: [], require_consent: true });
    Promise.all([listWaAccounts(), api.get('/lists', { params: { per_page: 100 } })])
      .then(([a, l]) => {
        setAccounts(a);
        setLists(l.data.data);
        if (!campaign && a.length) setForm((f) => ({ ...f, account_id: a.find((x) => x.status === 'connected')?.id || a[0].id }));
      })
      .catch((err) => addToast(apiError(err, 'Failed to load numbers or lists'), 'error'));
  }, [open, campaign, addToast]);

  const account = accounts.find((a) => a.id === form.account_id);
  const isMeta = account?.provider === 'meta_cloud';

  useEffect(() => {
    if (form.account_id) listWaTemplates(form.account_id).then(setTemplates).catch(() => {});
  }, [form.account_id]);

  const usableTemplates = useMemo(() => templates.filter((t) => t.status === 'APPROVED' && (isMeta ? t.source === 'meta' : t.source === 'local')), [templates, isMeta]);
  const template = templates.find((t) => t.id === form.template_id);
  const metaVars = useMemo(() => (template?.source === 'meta' ? [...new Set([...template.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]))].sort((a, b) => Number(a) - Number(b)) : []), [template]);

  // Live phone preview
  useEffect(() => {
    if (step !== 2 || !form.account_id || (!form.template_id && !form.message_body)) { setPreview(''); return; }
    const t = setTimeout(() => {
      previewWaMessage({ account_id: form.account_id, template_id: form.template_id, message_body: form.message_body, variable_mapping: form.variable_mapping })
        .then((r) => setPreview(r.body || '')).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [step, form.account_id, form.template_id, form.message_body, form.variable_mapping]);

  const canNext = [
    !!form.name && !!form.account_id,
    form.list_ids.length > 0,
    isMeta ? !!form.template_id : !!(form.template_id || form.message_body?.trim() || form.media),
    true,
  ][step];

  const save = async (): Promise<string | null> => {
    const body: CampaignBody = {
      ...form,
      template_id: form.template_id || null,
      message_body: form.template_id ? null : (form.message_body || null),
      media: form.media?.url ? form.media : null,
    };
    try {
      const saved = savedId ? await updateWaCampaign(savedId, body) : await createWaCampaign(body);
      setSavedId(saved.id);
      return saved.id;
    } catch (err) {
      addToast(apiError(err, 'Could not save the campaign'), 'error');
      return null;
    }
  };

  const next = async () => {
    if (step === 2) {
      setBusy(true);
      const id = await save();
      if (id) {
        try { setAudience(await getWaAudience(id)); } catch { setAudience(null); }
        setStep(3);
      }
      setBusy(false);
      return;
    }
    setStep((s) => s + 1);
  };

  const sendTest = async () => {
    const id = savedId || await save();
    if (!id) return;
    const phones = testPhones.split(/[,\n]/).map((p) => p.trim()).filter(Boolean).slice(0, 3);
    try {
      const results = await testWaCampaign(id, phones);
      const bad = results.filter((r) => !r.ok);
      addToast(bad.length ? `Test failed for ${bad.map((b) => `${b.phone} (${b.error})`).join(', ')}` : 'Test queued. Check your phone in a few seconds.', bad.length ? 'error' : 'success');
    } catch (err) { addToast(apiError(err, 'Test failed'), 'error'); }
  };

  const launch = async () => {
    setBusy(true);
    const id = await save();
    if (!id) { setBusy(false); return; }
    try {
      await scheduleWaCampaign(id, when === 'later' && scheduleAt ? new Date(scheduleAt).toISOString() : undefined);
      addToast(when === 'later' ? 'Campaign scheduled' : 'Campaign started. Messages go out at a safe pace.', 'success');
      onSaved();
    } catch (err) { addToast(apiError(err, 'Could not start the campaign'), 'error'); } finally { setBusy(false); }
  };

  const saveDraft = async () => { setBusy(true); if (await save()) { addToast('Draft saved', 'success'); onSaved(); } setBusy(false); };

  const setVar = (n: string, value: string) => setForm((f) => ({ ...f, variable_mapping: { ...(f.variable_mapping || {}), [n]: value } }));

  const minSchedule = new Date(Date.now() + 5 * 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <Modal isOpen={open} onClose={onClose} title={campaign ? 'Edit WhatsApp campaign' : 'New WhatsApp campaign'} size="xl"
      footer={
        <div className="flex justify-between">
          <button onClick={() => (step ? setStep(step - 1) : onClose())} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{step ? 'Back' : 'Cancel'}</button>
          <div className="flex gap-2">
            {step === 3 && <button onClick={saveDraft} disabled={busy} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Save draft</button>}
            {step < 3 ? (
              <button onClick={next} disabled={!canNext || busy} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">{busy ? 'Saving…' : 'Next'}</button>
            ) : (
              <button onClick={launch} disabled={busy || !audience?.eligible || (when === 'later' && !scheduleAt)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
                {when === 'later' ? <Clock className="h-4 w-4" /> : <Send className="h-4 w-4" />} {when === 'later' ? 'Schedule' : 'Start sending'}
              </button>
            )}
          </div>
        </div>
      }>
      {/* Steps */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className={clsx('flex items-center gap-2 text-sm', i <= step ? 'text-green-700 dark:text-green-400' : 'text-gray-400')}>
              <span className={clsx('h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold',
                i < step ? 'bg-green-600 text-white' : i === step ? 'border-2 border-green-600' : 'border-2 border-gray-300 dark:border-gray-600')}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={clsx('flex-1 h-0.5 mx-2', i < step ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700')} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <TextInput label="Campaign name" name="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Diwali offer 2026" required />
          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send from</span>
            {accounts.length === 0 && <p className="text-sm text-gray-500">Connect a WhatsApp number first.</p>}
            {accounts.map((a) => (
              <label key={a.id} className={clsx('flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
                form.account_id === a.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700',
                a.status !== 'connected' && 'opacity-60')}>
                <input type="radio" checked={form.account_id === a.id} onChange={() => setForm({ ...form, account_id: a.id, template_id: null, variable_mapping: {} })} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.name}</div>
                  <div className="text-xs text-gray-500">{a.provider === 'meta_cloud' ? 'Meta Cloud API · approved templates' : `QR linked · up to ${a.daily_cap} messages today`} · {a.status}</div>
                </div>
              </label>
            ))}
          </div>
          {account && !isMeta && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> QR numbers send slowly (one message every 8–20 s, max {account.daily_cap} today) to protect the number. Large lists continue over several days.
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {lists.map((l) => (
              <label key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer">
                <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                  <input type="checkbox" className="rounded" checked={form.list_ids.includes(l.id)}
                    onChange={(e) => setForm({ ...form, list_ids: e.target.checked ? [...form.list_ids, l.id] : form.list_ids.filter((x) => x !== l.id) })} />
                  {l.name}
                </span>
                <span className="text-xs text-gray-500">{l.contact_count_active ?? 0} contacts</span>
              </label>
            ))}
            {!lists.length && <p className="text-sm text-gray-500">No lists yet. Create one on the Lists page.</p>}
          </div>
          <CheckboxInput label="Only send to contacts with WhatsApp consent (recommended)" checked={!!form.require_consent}
            onChange={(v) => setForm({ ...form, require_consent: v })}
            description="Messaging people who never agreed is the fastest way to get a number reported and blocked. Contacts also need a valid mobile number." />
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            {(isMeta || usableTemplates.length > 0) && (
              <SelectInput label={isMeta ? 'Approved template (required by Meta)' : 'Saved message (optional)'} name="template" value={form.template_id || ''}
                onChange={(v) => setForm({ ...form, template_id: v || null, variable_mapping: {} })}
                placeholder={isMeta ? 'Pick a template' : 'Write a new message instead'}
                options={usableTemplates.map((t) => ({ value: t.id, label: `${t.name} (${t.language})` }))} />
            )}
            {isMeta && !usableTemplates.length && <p className="text-sm text-amber-600">No approved templates yet. Sync or submit one on the Templates tab.</p>}

            {metaVars.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fill the template variables</span>
                {metaVars.map((n) => {
                  const v = form.variable_mapping?.[n] || '';
                  const isFixed = v.startsWith('=');
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs font-mono w-10 text-gray-500">{`{{${n}}}`}</span>
                      <select value={isFixed ? '=' : v} onChange={(e) => setVar(n, e.target.value === '=' ? '=' : e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
                        <option value="">Choose a field</option>
                        {FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {isFixed && <input value={v.slice(1)} onChange={(e) => setVar(n, '=' + e.target.value)} placeholder="Text"
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />}
                    </div>
                  );
                })}
              </div>
            )}

            {!isMeta && !form.template_id && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Message</span>
                  <button onClick={() => setAiOpen(true)} className="flex items-center gap-1 text-xs text-purple-600 hover:underline"><Sparkles className="h-3.5 w-3.5" /> Write with AI</button>
                </div>
                <TextArea label="" name="message" rows={7} value={form.message_body || ''} onChange={(v) => setForm({ ...form, message_body: v })}
                  placeholder="Hi {{first_name|there}}, …" />
                <p className="text-xs text-gray-500 mt-1">Personalise with {'{{first_name}}'}. Personal, relevant messages get fewer reports.</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <SelectInput label="Attachment" name="media_type" value={form.media?.type || ''}
                onChange={(v) => setForm({ ...form, media: v ? { type: v as 'image' | 'document' | 'video', url: form.media?.url || '' } : null })}
                placeholder="None" options={[{ value: 'image', label: 'Image' }, { value: 'document', label: 'PDF / document' }, { value: 'video', label: 'Video' }]} />
              {form.media && (
                <div className="col-span-2">
                  <TextInput label="Public file URL" name="media_url" value={form.media.url} onChange={(v) => setForm({ ...form, media: { ...form.media!, url: v } })} placeholder="https://…/offer.jpg" />
                </div>
              )}
            </div>
          </div>

          {/* Phone preview */}
          <div className="flex justify-center">
            <div className="w-64 rounded-[2rem] border-8 border-gray-800 dark:border-gray-600 bg-[#efeae2] dark:bg-gray-900 h-[26rem] overflow-hidden flex flex-col">
              <div className="bg-[#075e54] text-white text-xs px-3 py-2">{account?.display_name || account?.name || 'Your business'}</div>
              <div className="flex-1 p-3">
                {(preview || form.media?.url) && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-xs text-gray-900 dark:text-gray-100 shadow-sm max-w-[90%] whitespace-pre-wrap break-words">
                    {form.media?.url && <div className="mb-1 text-[10px] text-gray-500">[{form.media.type}]</div>}
                    {preview}
                    <div className="text-right text-[9px] text-gray-400 mt-1">10:30</div>
                  </div>
                )}
                {!preview && !form.media?.url && <p className="text-xs text-gray-500 text-center mt-10">Preview appears here</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          {audience ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{audience.eligible.toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">will receive it</div>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{audience.skipped.toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">skipped (no mobile, opted out{form.require_consent ? ', or no consent' : ''})</div>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{audience.estimated_days === 1 ? 'Today' : `${audience.estimated_days} days`}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">to finish at {audience.daily_cap}/day</div>
              </div>
            </div>
          ) : <p className="text-sm text-gray-500">Calculating audience…</p>}
          {audience && audience.eligible === 0 && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> Nobody on these lists can receive this yet. Add mobile numbers{form.require_consent ? ' and record WhatsApp consent on contacts' : ''}.
            </div>
          )}

          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Send a test first</span>
            <div className="flex gap-2 mt-2">
              <input value={testPhones} onChange={(e) => setTestPhones(e.target.value)} placeholder="+91 98765 43210, up to 3 numbers"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
              <button onClick={sendTest} disabled={!testPhones.trim()} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 disabled:opacity-50">Send test</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(['now', 'later'] as const).map((w) => (
              <label key={w} className={clsx('p-3 rounded-lg border cursor-pointer text-sm', when === w ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700')}>
                <input type="radio" className="mr-2" checked={when === w} onChange={() => setWhen(w)} />
                {w === 'now' ? 'Start now' : 'Schedule for later'}
              </label>
            ))}
          </div>
          {when === 'later' && <TextInput label="Send at" name="schedule" type="datetime-local" value={scheduleAt} onChange={setScheduleAt} />}
          {when === 'later' && scheduleAt && scheduleAt < minSchedule && <p className="text-xs text-amber-600">Pick a time at least 5 minutes from now.</p>}

          <p className="flex items-center gap-1.5 text-xs text-gray-500"><ShieldCheck className="h-4 w-4 text-green-600" /> Campaign messages pause at night (India time), and stop automatically if the number shows problems.</p>
        </div>
      )}

      <AiComposeModal open={aiOpen} onClose={() => setAiOpen(false)} onUse={(m) => { setForm((f) => ({ ...f, message_body: m })); setAiOpen(false); }} />
    </Modal>
  );
}
