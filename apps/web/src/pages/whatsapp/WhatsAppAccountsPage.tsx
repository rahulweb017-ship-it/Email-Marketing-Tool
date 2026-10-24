import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus, Smartphone, ShieldCheck, QrCode, RefreshCw, LogOut, Trash2, Settings2, AlertTriangle, CheckCircle,
} from 'lucide-react';
import WhatsAppTabs from '../../components/whatsapp/WhatsAppTabs';
import { AccountStatusBadge, ProviderBadge } from '../../components/whatsapp/WaBadges';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { CardGridSkeleton } from '../../components/ui/Skeleton';
import { TextInput } from '../../components/ui/FormField';
import { useToastStore } from '../../stores/toast.store';
import {
  apiError, connectWaAccount, createMetaAccount, createQrAccount, deleteWaAccount, formatPhone, getWaQr,
  listWaAccounts, logoutWaAccount, updateWaAccount, type WaAccount,
} from '../../api/whatsapp';

function ConnectMetaModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const [form, setForm] = useState({ name: '', access_token: '', phone_number_id: '', waba_id: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v.trim() === '' ? '' : (k === 'name' ? v : v.trim()) }));

  const submit = async () => {
    setSaving(true);
    try {
      await createMetaAccount(form);
      addToast('WhatsApp number connected. Approved templates were synced.', 'success');
      setForm({ name: '', access_token: '', phone_number_id: '', waba_id: '' });
      onDone();
    } catch (err) {
      addToast(apiError(err, 'Could not connect this number'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Connect with Meta Cloud API" size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={submit} disabled={saving || !form.name || !form.access_token || !form.phone_number_id || !form.waba_id}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Checking with Meta…' : 'Connect number'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-sm text-green-800 dark:text-green-300 flex gap-2">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <span>The official API is the safe way to run bulk campaigns. Find these values in <b>Meta Business Suite → WhatsApp Manager → API Setup</b>. Use a permanent System User token, not the 24-hour test token.</span>
        </div>
        <TextInput label="Display name in Rabbit Growth" name="name" value={form.name} onChange={set('name')} placeholder="Main sales number" required />
        <TextInput label="Permanent access token" name="access_token" type="password" value={form.access_token} onChange={set('access_token')} placeholder="EAAG…" required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TextInput label="Phone number ID" name="phone_number_id" value={form.phone_number_id} onChange={set('phone_number_id')} placeholder="1234567890" required />
          <TextInput label="WhatsApp Business Account ID" name="waba_id" value={form.waba_id} onChange={set('waba_id')} placeholder="9876543210" required />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Also set the webhook in your Meta app to <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">{window.location.origin}/webhooks/whatsapp</code> and
          subscribe to <b>messages</b> and <b>message_template_status_update</b>, so delivery, read receipts and replies show up here.
        </p>
      </div>
    </Modal>
  );
}

function QrLinkModal({ open, account, onClose, onDone }: { open: boolean; account: WaAccount | null; onClose: () => void; onDone: () => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState<'risk' | 'qr'>('risk');
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('pending_qr');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setQr(null); setError(null); setStatus('pending_qr');
    if (account) { setAccountId(account.id); setStep('qr'); } else { setAccountId(null); setStep('risk'); setName(''); setAccepted(false); }
  }, [open, account]);

  useEffect(() => {
    if (!open || step !== 'qr' || !accountId) return;
    const poll = async () => {
      try {
        const r = await getWaQr(accountId);
        setQr(r.qr); setStatus(r.status); setError(r.last_error);
        if (r.status === 'connected') {
          addToast(`Linked ${formatPhone(r.phone_e164)} successfully`, 'success');
          onDone();
        }
      } catch { /* keep polling */ }
    };
    poll();
    timer.current = setInterval(poll, 2000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [open, step, accountId, addToast, onDone]);

  const start = async () => {
    try {
      const acc = await createQrAccount(name);
      setAccountId(acc.id);
      setStep('qr');
    } catch (err) {
      addToast(apiError(err, 'Could not start linking'), 'error');
    }
  };

  const retry = async () => {
    if (!accountId) return;
    setError(null); setQr(null);
    try { await connectWaAccount(accountId); } catch (err) { addToast(apiError(err, 'Could not restart'), 'error'); }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={step === 'risk' ? 'Link a WhatsApp number by QR' : 'Scan with your phone'} size="lg"
      footer={step === 'risk' ? (
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={start} disabled={!accepted || !name.trim()}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">Show QR code</button>
        </div>
      ) : undefined}>
      {step === 'risk' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Read this before linking</div>
            <p>QR linking works like WhatsApp Web, but it is <b>not an official WhatsApp API</b> and is against WhatsApp's terms for automated sending. WhatsApp can restrict or ban a number, and <b>no tool can guarantee it won't happen</b>.</p>
            <p>To keep the risk low, Rabbit Growth:</p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>sends one message every 8–20 seconds, never in bursts</li>
              <li>starts new numbers at 30 messages a day and raises the limit slowly (max 250/day)</li>
              <li>by default only sends campaigns to contacts who gave WhatsApp consent</li>
              <li>skips numbers that aren't on WhatsApp, pauses at night, and stops at the first sign of trouble</li>
              <li>honours STOP replies immediately</li>
            </ul>
            <p>Use a number you can afford to lose, never your only business number. For bulk marketing, use the Meta Cloud API instead.</p>
          </div>
          <TextInput label="Name for this number" name="qr-name" value={name} onChange={setName} placeholder="Shop WhatsApp" required />
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 rounded" />
            I understand the number may be restricted by WhatsApp, and I will only message people who agreed to hear from us.
          </label>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="w-64 h-64 flex items-center justify-center bg-white rounded-xl border border-gray-200 p-3">
            {status === 'connected' ? (
              <CheckCircle className="h-20 w-20 text-green-600" />
            ) : qr ? (
              <QRCodeSVG value={qr} size={232} />
            ) : error ? (
              <button onClick={retry} className="flex flex-col items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="h-8 w-8" /> Get a new QR
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 text-sm text-gray-500"><RefreshCw className="h-6 w-6 animate-spin" /> Generating QR…</div>
            )}
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open <b>WhatsApp Business</b> on your phone</li>
              <li>Tap <b>⋮ Menu</b> (or Settings) → <b>Linked devices</b></li>
              <li>Tap <b>Link a device</b> and point the phone at this code</li>
            </ol>
            <p className="text-xs text-gray-500">The code refreshes automatically. Keep the phone connected to the internet.</p>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

function LimitsModal({ account, onClose, onSaved }: { account: WaAccount | null; onClose: () => void; onSaved: () => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const [form, setForm] = useState({ name: '', daily_limit: '', min: '', max: '', quietOn: true, quietStart: '21:00', quietEnd: '09:00' });
  useEffect(() => {
    if (!account) return;
    setForm({
      name: account.name,
      daily_limit: account.daily_limit?.toString() ?? '',
      min: account.min_interval_sec?.toString() ?? '',
      max: account.max_interval_sec?.toString() ?? '',
      quietOn: account.quiet_hours ? account.quiet_hours.start !== account.quiet_hours.end : true,
      quietStart: account.quiet_hours?.start ?? '21:00',
      quietEnd: account.quiet_hours?.end ?? '09:00',
    });
  }, [account]);
  if (!account) return null;
  const isQr = account.provider === 'web_qr';

  const save = async () => {
    try {
      await updateWaAccount(account.id, {
        name: form.name,
        daily_limit: form.daily_limit ? Number(form.daily_limit) : null,
        min_interval_sec: form.min ? Number(form.min) : null,
        max_interval_sec: form.max ? Number(form.max) : null,
        quiet_hours: form.quietOn ? { start: form.quietStart, end: form.quietEnd, tz: 'Asia/Kolkata' } : { start: '00:00', end: '00:00', tz: 'Asia/Kolkata' },
      });
      addToast('Sending limits saved', 'success');
      onSaved();
    } catch (err) {
      addToast(apiError(err, 'Could not save'), 'error');
    }
  };

  return (
    <Modal isOpen={!!account} onClose={onClose} title={`Sending limits: ${account.name}`}
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
        <button onClick={save} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Save</button>
      </div>}>
      <div className="space-y-4">
        <TextInput label="Name" name="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <TextInput label={isQr ? 'Daily limit (leave empty for the automatic warm-up ramp)' : 'Daily limit (your Meta messaging tier, e.g. 1000)'}
          name="daily_limit" type="number" value={form.daily_limit} onChange={(v) => setForm({ ...form, daily_limit: v })}
          placeholder={isQr ? `Now ${account.daily_cap}/day (warm-up day ${account.warmup_day})` : '1000'} />
        {isQr && <p className="text-xs text-gray-500 -mt-2">A higher number here never skips the warm-up. It only caps it lower.</p>}
        <div className="grid grid-cols-2 gap-4">
          <TextInput label="Min seconds between messages" name="min" type="number" value={form.min} onChange={(v) => setForm({ ...form, min: v })} placeholder={isQr ? '8' : '0.1'} />
          <TextInput label="Max seconds between messages" name="max" type="number" value={form.max} onChange={(v) => setForm({ ...form, max: v })} placeholder={isQr ? '20' : '0.5'} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={form.quietOn} onChange={(e) => setForm({ ...form, quietOn: e.target.checked })} className="rounded" />
          Don't send campaign messages at night (India time). Replies to customers still go out.
        </label>
        {form.quietOn && (
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Quiet from" name="qs" type="time" value={form.quietStart} onChange={(v) => setForm({ ...form, quietStart: v })} />
            <TextInput label="Quiet until" name="qe" type="time" value={form.quietEnd} onChange={(v) => setForm({ ...form, quietEnd: v })} />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function WhatsAppAccountsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaOpen, setMetaOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrAccount, setQrAccount] = useState<WaAccount | null>(null);
  const [limitsFor, setLimitsFor] = useState<WaAccount | null>(null);
  const [deleting, setDeleting] = useState<WaAccount | null>(null);

  const load = useCallback(async () => {
    try { setAccounts(await listWaAccounts()); } catch (err) { addToast(apiError(err, 'Failed to load numbers'), 'error'); } finally { setLoading(false); }
  }, [addToast]);
  useEffect(() => { load(); }, [load]);

  const reconnect = async (a: WaAccount) => {
    try {
      await connectWaAccount(a.id);
      if (a.provider === 'web_qr') { setQrAccount(a); setQrOpen(true); } else addToast('Token verified, number reconnected', 'success');
      load();
    } catch (err) { addToast(apiError(err, 'Reconnect failed'), 'error'); }
  };

  const logout = async (a: WaAccount) => {
    try { await logoutWaAccount(a.id); addToast('Number disconnected', 'success'); load(); } catch (err) { addToast(apiError(err, 'Failed'), 'error'); }
  };

  const remove = async () => {
    if (!deleting) return;
    try { await deleteWaAccount(deleting.id); addToast('Number removed', 'success'); setDeleting(null); load(); } catch (err) { addToast(apiError(err, 'Failed'), 'error'); }
  };

  const actions = (
    <>
      <button onClick={() => { setQrAccount(null); setQrOpen(true); }}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
        <QrCode className="h-4 w-4" /> Link by QR
      </button>
      <button onClick={() => setMetaOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
        <Plus className="h-4 w-4" /> Connect Meta API
      </button>
    </>
  );

  return (
    <div>
      <WhatsAppTabs title="WhatsApp numbers" subtitle="Connect numbers and control how fast each one sends" actions={actions} />
      {loading ? <CardGridSkeleton count={2} /> : accounts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => setMetaOpen(true)} className="text-left p-6 rounded-xl border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10 hover:border-green-400">
            <ShieldCheck className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Meta Cloud API (recommended)</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Official and safe for bulk campaigns. Uses Meta-approved templates, and Meta charges per conversation.</p>
          </button>
          <button onClick={() => { setQrAccount(null); setQrOpen(true); }} className="text-left p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400">
            <QrCode className="h-8 w-8 text-gray-600 dark:text-gray-400 mb-3" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Link WhatsApp Business app by QR</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Quick to set up, with no Meta approval needed. Good for conversations and small volumes. Unofficial, so there is a risk of a ban.</p>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((a) => (
            <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30"><Smartphone className="h-5 w-5 text-green-600" /></div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{a.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatPhone(a.phone_e164) || 'Not linked yet'}{a.display_name ? ` · ${a.display_name}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1"><AccountStatusBadge status={a.status} /><ProviderBadge provider={a.provider} /></div>
              </div>

              {a.last_error && a.status !== 'connected' && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">{a.last_error}</div>
              )}

              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>Sent today: {a.sent_today} / {a.daily_cap}</span>
                  {a.warmup_day != null && <span>Warm-up day {a.warmup_day}</span>}
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(1, a.daily_cap ? a.sent_today / a.daily_cap : 0) * 100}%` }} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {a.status !== 'connected' && (
                  <button onClick={() => reconnect(a)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700">
                    <RefreshCw className="h-3.5 w-3.5" /> {a.status === 'paused' ? 'Resume' : 'Reconnect'}
                  </button>
                )}
                <button onClick={() => setLimitsFor(a)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                  <Settings2 className="h-3.5 w-3.5" /> Limits
                </button>
                {a.status === 'connected' && (
                  <button onClick={() => logout(a)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                    <LogOut className="h-3.5 w-3.5" /> Disconnect
                  </button>
                )}
                <button onClick={() => setDeleting(a)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && accounts.length === 0 && (
        <div className="mt-6"><EmptyState icon={Smartphone} title="No WhatsApp numbers yet" description="Pick a connection type above to get started." /></div>
      )}

      <ConnectMetaModal open={metaOpen} onClose={() => setMetaOpen(false)} onDone={() => { setMetaOpen(false); load(); }} />
      <QrLinkModal open={qrOpen} account={qrAccount} onClose={() => { setQrOpen(false); load(); }} onDone={() => { setQrOpen(false); load(); }} />
      <LimitsModal account={limitsFor} onClose={() => setLimitsFor(null)} onSaved={() => { setLimitsFor(null); load(); }} />
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} onConfirm={remove} variant="danger"
        title="Remove this number?" confirmLabel="Remove"
        message="Its conversations, messages and campaigns in Rabbit Growth will be deleted. QR-linked numbers are also logged out of the linked device." />
    </div>
  );
}
