import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Plus, Search, MessageCircle, Mail, Globe, Share2, Megaphone, PenLine, Webhook, Sparkles, Flame,
  X, Loader2, UserPlus, Trash2, Copy, Send, RefreshCw, ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../api/client';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import AiCreditsLine from '../components/ai/AiCreditsLine';
import { useToastStore } from '../stores/toast.store';
import { aiErrorMessage } from '../api/ai';
import {
  listLeads, getLeadStats, getLead, createLead, updateLead, deleteLead, addLeadNote, convertLead, qualifyLead,
  replyLeadWhatsApp, getLeadWebhook, rotateLeadWebhook,
  type Lead, type LeadDetail, type LeadSource, type LeadStatus, type LeadStats,
} from '../api/leads';

const SOURCES: Record<LeadSource, { label: string; icon: typeof Inbox; color: string }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600 bg-green-50 dark:bg-green-900/30' },
  email: { label: 'Email marketing', icon: Mail, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
  website: { label: 'Website', icon: Globe, color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30' },
  social: { label: 'Social', icon: Share2, color: 'text-pink-600 bg-pink-50 dark:bg-pink-900/30' },
  ads: { label: 'Ads', icon: Megaphone, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30' },
  manual: { label: 'Added by team', icon: PenLine, color: 'text-gray-600 bg-gray-100 dark:bg-gray-700' },
  api: { label: 'Webhook / API', icon: Webhook, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' },
};

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200' },
  { value: 'qualified', label: 'Qualified', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' },
  { value: 'unqualified', label: 'Unqualified', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  { value: 'converted', label: 'Converted', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200' },
];
const statusInfo = (s: LeadStatus) => STATUSES.find((x) => x.value === s) || STATUSES[0];

const TEMP: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  warm: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
  cold: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
};

const errMsg = (err: unknown, fallback: string) => aiErrorMessage(err, fallback);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const leadName = (l: Pick<Lead, 'name' | 'email' | 'phone'>) => l.name || l.email || l.phone || 'Unknown';

function SourceBadge({ source, detail }: { source: LeadSource; detail?: string | null }) {
  const s = SOURCES[source] || SOURCES.api;
  const Icon = s.icon;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.color)} title={detail || undefined}>
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

function ScorePill({ lead }: { lead: Pick<Lead, 'score' | 'temperature'> }) {
  if (lead.score === null || !lead.temperature) return <span className="text-xs text-gray-400">Not scored</span>;
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', TEMP[lead.temperature])}>
      {lead.temperature === 'hot' && <Flame className="h-3 w-3" />}{lead.score} · {lead.temperature}
    </span>
  );
}

export default function LeadsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [temperature, setTemperature] = useState('');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, st] = await Promise.all([
        listLeads({ page, status: status || undefined, source: source || undefined, temperature: temperature || undefined, search: search || undefined }),
        getLeadStats(),
      ]);
      setLeads(res.data); setTotal(res.total); setStats(st);
    } catch (err) {
      addToast(errMsg(err, 'Could not load leads'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, status, source, temperature, search, addToast]);

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t); }, [load, search]);

  const totalAll = stats ? Object.values(stats.by_status).reduce((s, n) => s + (n || 0), 0) : 0;
  const tab = (value: string, label: string, count?: number) => (
    <button key={value || 'all'} onClick={() => { setStatus(value); setPage(1); }}
      className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap', status === value
        ? 'bg-primary-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')}>
      {label}{count !== undefined && <span className="ml-1.5 opacity-75">{count}</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leads</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Every enquiry from WhatsApp, email, your website, social and ads in one place. Rabbit AI scores each lead and drafts the follow-up.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setSourcesOpen(true)} className="flex items-center gap-2 px-4 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Webhook className="h-4 w-4" /> Connect sources
          </button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
            <Plus className="h-4 w-4" /> Add lead
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'New leads', value: stats.by_status.new || 0 },
            { label: 'Hot and open', value: stats.hot_open, hot: true },
            { label: 'Qualified', value: stats.by_status.qualified || 0 },
            { label: 'Converted', value: stats.by_status.converted || 0 },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">{c.hot && <Flame className="h-3.5 w-3.5 text-red-500" />}{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{c.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex gap-1 overflow-x-auto">
            {tab('', 'All', totalAll)}
            {STATUSES.map((s) => tab(s.value, s.label, stats?.by_status[s.value] || 0))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <select aria-label="Source" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-200">
              <option value="">All sources</option>
              {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select aria-label="Temperature" value={temperature} onChange={(e) => { setTemperature(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-200">
              <option value="">Any score</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search leads..."
                className="pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-200" />
            </div>
          </div>
        </div>

        {loading && leads.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center px-6">
            <Inbox className="h-10 w-10 text-gray-300" />
            <p className="mt-3 font-semibold text-gray-900 dark:text-white">No leads yet</p>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
              Buying conversations on WhatsApp and signup form submissions appear here automatically. Connect ads, social tools or your own forms with the lead webhook.
            </p>
            <button onClick={() => setSourcesOpen(true)} className="mt-4 text-sm font-medium text-primary-600 hover:underline">Connect sources</button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {leads.map((l) => (
              <li key={l.id}>
                <button onClick={() => setActiveId(l.id)} className="flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{leadName(l)}</span>
                      {l.company && <span className="text-sm text-gray-500">· {l.company}</span>}
                      <SourceBadge source={l.source} detail={l.source_detail} />
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', statusInfo(l.status).color)}>{statusInfo(l.status).label}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-gray-600 dark:text-gray-400">{l.ai_summary || l.message || [l.email, l.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ScorePill lead={l} />
                    <span className="text-xs text-gray-400">{when(l.last_activity_at)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {total > 25 && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <Pagination page={page} total={total} perPage={25} onPageChange={setPage} />
          </div>
        )}
      </div>

      {activeId && <LeadDrawer id={activeId} onClose={() => setActiveId(null)} onChanged={load} />}
      <AddLeadModal isOpen={addOpen} onClose={() => setAddOpen(false)} onCreated={(l) => { load(); setActiveId(l.id); }} />
      <SourcesModal isOpen={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  );
}

function LeadDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [convertOpen, setConvertOpen] = useState(false);
  const [runs, setRuns] = useState(0);

  useEffect(() => {
    setLead(null);
    getLead(id).then((l) => { setLead(l); setReply(l.ai_qualification?.reply_draft || ''); })
      .catch((err) => { addToast(errMsg(err, 'Could not load the lead'), 'error'); onClose(); });
  }, [id, addToast, onClose]);

  const act = async (key: string, fn: () => Promise<LeadDetail>, ok?: string) => {
    setBusy(key);
    try {
      const l = await fn();
      setLead(l);
      if (key === 'qualify') { setReply(l.ai_qualification?.reply_draft || ''); setRuns((n) => n + 1); }
      if (ok) addToast(ok, 'success');
      onChanged();
    } catch (err) {
      addToast(errMsg(err, 'Something went wrong'), 'error');
    } finally {
      setBusy('');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this lead and its history?')) return;
    try { await deleteLead(id); onChanged(); onClose(); } catch (err) { addToast(errMsg(err, 'Could not delete the lead'), 'error'); }
  };

  const q = lead?.ai_qualification;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col bg-white dark:bg-gray-800 shadow-2xl" aria-label="Lead details">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 dark:border-gray-700 p-5">
          {lead ? (
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">{leadName(lead)}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <SourceBadge source={lead.source} detail={lead.source_detail} />
                {lead.source_detail && <span>{lead.source_detail}</span>}
                <ScorePill lead={lead} />
              </div>
            </div>
          ) : <div className="h-10" />}
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        {!lead ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Email', lead.email], ['Phone', lead.phone], ['Company', lead.company], ['First seen', when(lead.created_at)]].map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500">{k}</p><p className="truncate text-gray-900 dark:text-gray-100">{v || '-'}</p></div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Status" value={lead.status} onChange={(e) => act('status', () => updateLead(id, { status: e.target.value as LeadStatus }))}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-gray-200">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {lead.contact_id ? (
                <Link to={`/contacts/${lead.contact_id}`} className="flex items-center gap-1.5 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200">
                  <ExternalLink className="h-4 w-4" /> View contact
                </Link>
              ) : null}
              {lead.status !== 'converted' && (
                <button onClick={() => setConvertOpen(true)} className="flex items-center gap-1.5 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200">
                  <UserPlus className="h-4 w-4" /> {lead.contact_id ? 'Mark converted' : 'Convert to contact'}
                </button>
              )}
              {lead.conversation_id && (
                <Link to={`/whatsapp/inbox?c=${lead.conversation_id}`} className="flex items-center gap-1.5 px-3 py-2 border dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-200">
                  <MessageCircle className="h-4 w-4" /> Open chat
                </Link>
              )}
              <button onClick={remove} aria-label="Delete lead" className="ml-auto rounded-lg p-2 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>

            {lead.message && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Latest message</p>
                <p className="whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-800 dark:text-gray-200">{lead.message}</p>
              </div>
            )}

            <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800 dark:text-rose-200"><Sparkles className="h-4 w-4" /> AI qualification</p>
                <button onClick={() => act('qualify', () => qualifyLead(id), 'Lead qualified')} disabled={!!busy}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  {busy === 'qualify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {q ? 'Re-qualify' : 'Qualify now'}
                </button>
              </div>
              {q ? (
                <div className="mt-3 space-y-3 text-sm text-gray-800 dark:text-gray-200">
                  <p>{q.summary}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[['Need', q.need], ['Budget', q.budget], ['Timeline', q.timeline]].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-white dark:bg-gray-800 p-2"><p className="text-gray-500">{k}</p><p className="font-medium">{v || 'Unknown'}</p></div>
                    ))}
                  </div>
                  <p><span className="font-medium">Next step:</span> {q.next_step}</p>
                  {q.missing_info.length > 0 && (
                    <div><p className="font-medium">Still to find out</p><ul className="mt-1 list-disc pl-5">{q.missing_info.map((m) => <li key={m}>{m}</li>)}</ul></div>
                  )}
                  {q.suggested_status !== lead.status && lead.status !== 'converted' && (
                    <button onClick={() => act('status', () => updateLead(id, { status: q.suggested_status }))}
                      className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline">
                      Rabbit AI suggests: mark as {statusInfo(q.suggested_status).label.toLowerCase()}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Rabbit AI reads the enquiry, scores how likely they are to buy and drafts your reply. New leads with a message are qualified automatically.</p>
              )}
              <div className="mt-2"><AiCreditsLine refreshKey={runs} /></div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Reply</p>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder="Write a follow-up message..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm dark:text-gray-100" />
              <div className="mt-2 flex flex-wrap gap-2">
                {lead.conversation_id && (
                  <button disabled={!reply.trim() || !!busy} onClick={() => act('reply', () => replyLeadWhatsApp(id, reply.trim()), 'Reply queued on WhatsApp')}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                    <Send className="h-4 w-4" /> Send on WhatsApp
                  </button>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}?body=${encodeURIComponent(reply)}`}
                    className="flex items-center gap-1.5 rounded-lg border dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                    <Mail className="h-4 w-4" /> Open in email
                  </a>
                )}
                <button disabled={!reply.trim()} onClick={() => { navigator.clipboard.writeText(reply).catch(() => {}); addToast('Reply copied', 'success'); }}
                  className="flex items-center gap-1.5 rounded-lg border dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50">
                  <Copy className="h-4 w-4" /> Copy
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Activity</p>
              <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) act('note', () => addLeadNote(id, note.trim())).then(() => setNote('')); }}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm dark:text-gray-100" />
                <button disabled={!note.trim() || !!busy} onClick={() => act('note', () => addLeadNote(id, note.trim())).then(() => setNote(''))}
                  className="rounded-lg border dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50">Add</button>
              </div>
              <ol className="mt-3 space-y-3">
                {lead.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-xs text-gray-500">{eventLabel(e.type, e.body)} · {when(e.created_at)}{e.user_name ? ` · ${e.user_name}` : ''}</p>
                    {e.body && e.type !== 'status' && <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{e.body}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </aside>
      {lead && (
        <ConvertModal isOpen={convertOpen} onClose={() => setConvertOpen(false)} hasContact={!!lead.contact_id}
          onConvert={(lists) => act('convert', () => convertLead(id, lists), 'Lead converted').then(() => setConvertOpen(false))} />
      )}
    </div>
  );
}

function eventLabel(type: string, body: string | null) {
  switch (type) {
    case 'created': return 'Lead created';
    case 'message': return 'New message';
    case 'status': return `Status changed to ${statusInfo((body || 'new') as LeadStatus).label.toLowerCase()}`;
    case 'qualified': return 'Qualified by Rabbit AI';
    case 'note': return 'Note';
    case 'converted': return 'Converted to contact';
    default: return type;
  }
}

function ConvertModal({ isOpen, onClose, onConvert, hasContact }: { isOpen: boolean; onClose: () => void; onConvert: (lists: string[]) => void; hasContact: boolean }) {
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => {
    if (!isOpen || hasContact) return;
    api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => setLists(data.data || data || [])).catch(() => setLists([]));
  }, [isOpen, hasContact]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={hasContact ? 'Mark as converted' : 'Convert to contact'} footer={
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm dark:text-gray-300">Cancel</button>
        <button onClick={() => onConvert(chosen)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">{hasContact ? 'Mark converted' : 'Convert'}</button>
      </div>
    }>
      {hasContact ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">This lead is already linked to a contact. It will be marked as converted.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">Creates a contact from this lead, or links the existing contact with the same email or phone. Only add them to marketing lists if they agreed to receive marketing.</p>
          {lists.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {lists.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input type="checkbox" checked={chosen.includes(l.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, l.id] : c.filter((x) => x !== l.id)))} />
                  {l.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AddLeadModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (l: LeadDetail) => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const empty = { name: '', email: '', phone: '', company: '', message: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const lead = await createLead(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || undefined])));
      setForm(empty); onClose(); onCreated(lead);
    } catch (err) {
      addToast(errMsg(err, 'Could not add the lead'), 'error');
    } finally {
      setSaving(false);
    }
  };
  const field = (key: keyof typeof empty, label: string, placeholder: string) => (
    <div>
      <label htmlFor={`lead-${key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {key === 'message' ? (
        <textarea id={`lead-${key}`} rows={3} value={form[key]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm dark:text-gray-100" />
      ) : (
        <input id={`lead-${key}`} value={form[key]} placeholder={placeholder} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm dark:text-gray-100" />
      )}
    </div>
  );
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a lead" footer={
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm dark:text-gray-300">Cancel</button>
        <button onClick={save} disabled={saving || !(form.name.trim() || form.email.trim() || form.phone.trim())}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Add lead'}</button>
      </div>
    }>
      <div className="space-y-3">
        {field('name', 'Name', 'Asha Rao')}
        <div className="grid grid-cols-2 gap-3">{field('email', 'Email', 'asha@example.com')}{field('phone', 'Phone', '+91 98765 43210')}</div>
        {field('company', 'Company', 'Optional')}
        {field('message', 'What do they want?', 'e.g. Asked for a quote for 50 units, delivery in December')}
      </div>
    </Modal>
  );
}

function SourcesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (isOpen) getLeadWebhook().then((r) => setUrl(r.url)).catch((err) => addToast(errMsg(err, 'Could not load the webhook'), 'error'));
  }, [isOpen, addToast]);
  const rotate = async () => {
    if (!window.confirm('Create a new webhook link? The old link stops working straight away.')) return;
    try { setUrl((await rotateLeadWebhook()).url); addToast('New webhook link created', 'success'); }
    catch (err) { addToast(errMsg(err, 'Only admins can change the webhook link'), 'error'); }
  };
  const example = `curl -X POST ${url || 'https://.../webhooks/leads/TOKEN'} \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Asha Rao","email":"asha@example.com","phone":"+919876543210","message":"Need a quote","source":"ads","campaign":"Diwali offer"}'`;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Where leads come from" size="lg">
      <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
        <div className="space-y-2">
          <p className="flex items-start gap-2"><MessageCircle className="mt-0.5 h-4 w-4 text-green-600" /><span><b>WhatsApp:</b> automatic. Conversations Smart Inbox marks as a sales enquiry, pricing question, booking or hot lead become leads.</span></p>
          <p className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-blue-600" /><span><b>Email marketing:</b> automatic. Every signup form submission is added as a lead.</span></p>
          <p className="flex items-start gap-2"><Megaphone className="mt-0.5 h-4 w-4 text-orange-600" /><span><b>Ads, social and website forms:</b> send them to the webhook below, directly or through Zapier, Make or your website. Facebook and Google lead ads work through Zapier or Make today.</span></p>
        </div>
        <div>
          <p className="mb-1 font-medium text-gray-900 dark:text-white">Your lead webhook</p>
          <div className="flex gap-2">
            <input readOnly value={url} aria-label="Lead webhook URL" className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 font-mono text-xs" />
            <button onClick={() => { navigator.clipboard.writeText(url).catch(() => {}); addToast('Webhook link copied', 'success'); }} className="rounded-lg border dark:border-gray-600 px-3 py-2"><Copy className="h-4 w-4" /></button>
            <button onClick={rotate} title="Create a new link" className="rounded-lg border dark:border-gray-600 px-3 py-2"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <p className="mt-1 text-xs text-gray-500">Keep this link private. Anyone with it can add leads to your account.</p>
        </div>
        <div>
          <p className="mb-1 font-medium text-gray-900 dark:text-white">What to send</p>
          <p className="text-xs text-gray-500 mb-2">POST JSON with any of: name (or first_name and last_name), email, phone, company, message, source (website, social, ads or api), campaign, external_id. Re-sending the same external_id updates the lead instead of adding a new one.</p>
          <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{example}</pre>
        </div>
      </div>
    </Modal>
  );
}
