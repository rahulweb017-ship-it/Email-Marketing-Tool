import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Search, Send, Sparkles, Bot, User, Check, CheckCheck, Clock, AlertCircle, GraduationCap, UserPlus,
  PauseCircle, PlayCircle, XCircle, MessagesSquare, FileText, Flame,
} from 'lucide-react';
import WhatsAppTabs from '../../components/whatsapp/WhatsAppTabs';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { TextInput, CheckboxInput } from '../../components/ui/FormField';
import { useToastStore } from '../../stores/toast.store';
import {
  apiError, formatPhone, getConversation, getConversationMessages, listConversations, listWaTemplates, replyToConversation,
  saveConversationContact, suggestReplies, teachWaAi, updateConversation,
  type WaConversation, type WaMessage, type WaTemplate,
} from '../../api/whatsapp';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'hot', label: 'Hot leads' },
  { key: 'needs_human', label: 'Needs a person' },
  { key: 'closed', label: 'Closed' },
];

// Must match INBOX_INTENTS in apps/api/src/modules/ai/inbox.service.ts
const INTENT_LABELS: Record<string, string> = {
  sales_enquiry: 'Sales enquiry', pricing: 'Pricing', order_status: 'Order status', booking: 'Booking',
  support: 'Support', complaint: 'Complaint', feedback: 'Feedback', spam: 'Spam', other: 'Other',
};

function displayName(c: Pick<WaConversation, 'first_name' | 'last_name' | 'profile_name' | 'phone_e164'>) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ');
  return n || c.profile_name || formatPhone(c.phone_e164);
}

function timeLabel(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Ticks({ m }: { m: WaMessage }) {
  if (m.status === 'queued' || m.status === 'sending') return <Clock className="h-3.5 w-3.5" />;
  if (m.status === 'failed' || m.status === 'skipped' || m.status === 'cancelled') return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  if (m.status === 'read') return <CheckCheck className="h-3.5 w-3.5 text-sky-500" />;
  if (m.status === 'delivered') return <CheckCheck className="h-3.5 w-3.5" />;
  return <Check className="h-3.5 w-3.5" />;
}

export default function WhatsAppInboxPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c');
  const [filter, setFilter] = useState(params.get('status') || '');
  const [search, setSearch] = useState('');
  const [intent, setIntent] = useState('');
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [active, setActive] = useState<WaConversation | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ email: '', first_name: '', consent: false });
  const bottom = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const q: Record<string, unknown> = { per_page: 50, search: search || undefined };
      if (filter === 'unread') q.unread = true;
      else if (filter === 'hot') q.hot = true;
      else if (filter) q.status = filter;
      if (intent) q.intent = intent;
      const res = await listConversations(q);
      setConversations(res.data);
    } catch (err) {
      addToast(apiError(err, 'Failed to load conversations'), 'error');
    }
  }, [filter, search, intent, addToast]);

  const loadThread = useCallback(async (id: string, scroll = false) => {
    try {
      const [c, m] = await Promise.all([getConversation(id), getConversationMessages(id)]);
      setActive(c);
      setMessages((prev) => {
        if (scroll || m.length !== prev.length) setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        return m;
      });
    } catch (err) {
      addToast(apiError(err, 'Failed to load messages'), 'error');
    }
  }, [addToast]);

  useEffect(() => { const t = setTimeout(loadList, 250); return () => clearTimeout(t); }, [loadList]);
  useEffect(() => {
    if (!selectedId) { setActive(null); setMessages([]); return; }
    setSuggestions([]);
    loadThread(selectedId, true);
  }, [selectedId, loadThread]);
  useEffect(() => {
    const t = setInterval(() => { loadList(); if (selectedId) loadThread(selectedId); }, 5000);
    return () => clearInterval(t);
  }, [loadList, loadThread, selectedId]);
  useEffect(() => {
    if (active?.account_id) listWaTemplates(active.account_id).then(setTemplates).catch(() => {});
  }, [active?.account_id]);

  const select = (id: string) => { const p = new URLSearchParams(params); p.set('c', id); setParams(p); };

  const metaWindowClosed = active?.account_provider === 'meta_cloud' && !active.within_service_window;

  const send = async (body?: string, templateId?: string) => {
    if (!active) return;
    setSending(true);
    try {
      await replyToConversation(active.id, templateId ? { template_id: templateId } : { body: body ?? text });
      setText(''); setSuggestions([]);
      await loadThread(active.id, true);
      loadList();
    } catch (err) {
      addToast(apiError(err, 'Message not sent'), 'error');
    } finally {
      setSending(false);
    }
  };

  const suggest = async () => {
    if (!active) return;
    setSuggesting(true);
    try { setSuggestions(await suggestReplies(active.id)); } catch (err) { addToast(apiError(err, 'AI suggestions unavailable'), 'error'); } finally { setSuggesting(false); }
  };

  const teach = async (m: WaMessage) => {
    try { await teachWaAi(m.id); addToast('Saved to the AI knowledge base. The bot will use this answer next time.', 'success'); }
    catch (err) { addToast(apiError(err, 'Could not save this answer'), 'error'); }
  };

  const patch = async (body: { status?: string; ai_paused?: boolean }) => {
    if (!active) return;
    try { setActive({ ...(await updateConversation(active.id, body)) }); loadList(); } catch (err) { addToast(apiError(err, 'Update failed'), 'error'); }
  };

  const saveContact = async () => {
    if (!active) return;
    try {
      await saveConversationContact(active.id, { email: saveForm.email || undefined, first_name: saveForm.first_name || undefined, whatsapp_consent: saveForm.consent });
      addToast('Contact saved', 'success');
      setSaveOpen(false);
      loadThread(active.id);
    } catch (err) { addToast(apiError(err, 'Could not save contact'), 'error'); }
  };

  const approvedTemplates = useMemo(() => templates.filter((t) => t.status === 'APPROVED' && (t.source === 'meta' || active?.account_provider === 'web_qr')), [templates, active]);

  return (
    <div>
      <WhatsAppTabs title="WhatsApp inbox" subtitle="Every customer conversation across your numbers" />
      <div className="flex h-[calc(100vh-15rem)] min-h-[480px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Conversation list */}
        <div className={clsx('w-full md:w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col', selectedId && 'hidden md:flex')}>
          <div className="p-3 space-y-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or number"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={clsx('px-2.5 py-1 text-xs rounded-full whitespace-nowrap', filter === f.key ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>
                  {f.label}
                </button>
              ))}
            </div>
            <select aria-label="Filter by topic" value={intent} onChange={(e) => setIntent(e.target.value)}
              className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300">
              <option value="">All topics (AI-labelled)</option>
              {Object.entries(INTENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-6 text-sm text-center text-gray-500">No conversations here yet.</p>
            ) : conversations.map((c) => (
              <button key={c.id} onClick={() => select(c.id)}
                className={clsx('w-full text-left px-3 py-3 border-b border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/40',
                  selectedId === c.id && 'bg-green-50 dark:bg-green-900/20')}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{displayName(c)}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{timeLabel(c.last_message_at)}</span>
                </div>
                <div className="flex justify-between gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.last_message_preview || '—'}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {c.status === 'needs_human' && <User className="h-3.5 w-3.5 text-amber-500" />}
                    {c.unread_count > 0 && <span className="px-1.5 min-w-[1.25rem] text-center text-[11px] rounded-full bg-green-600 text-white">{c.unread_count}</span>}
                  </span>
                </div>
                {(c.ai_intent || c.ai_hot_lead) && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {c.ai_hot_lead && <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"><Flame className="h-3 w-3" /> Hot lead</span>}
                    {c.ai_intent && <span className="px-1.5 py-0.5 text-[10px] rounded bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{INTENT_LABELS[c.ai_intent] || c.ai_intent}</span>}
                    {c.ai_sentiment === 'negative' && <span className="px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Unhappy</span>}
                  </div>
                )}
                <div className="text-[11px] text-gray-400 mt-0.5">{c.account_name}</div>              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className={clsx('flex-1 flex flex-col min-w-0', !selectedId && 'hidden md:flex')}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessagesSquare} title="Pick a conversation" description="Replies from customers appear here in real time." />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <button className="md:hidden text-xs text-green-600 mb-1" onClick={() => { const p = new URLSearchParams(params); p.delete('c'); setParams(p); }}>← Back</button>
                  <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName(active)}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                    {formatPhone(active.phone_e164)} · {active.account_name}
                    {active.contact_id
                      ? <Link to={`/contacts/${active.contact_id}`} className="text-green-600 hover:underline">View contact</Link>
                      : <button onClick={() => { setSaveForm({ email: '', first_name: active.profile_name || '', consent: false }); setSaveOpen(true); }} className="flex items-center gap-1 text-green-600 hover:underline"><UserPlus className="h-3 w-3" /> Save as contact</button>}
                    {active.whatsapp_opt_out && <span className="text-red-500">Opted out</span>}
                    {active.ai_summary && <span className="flex items-center gap-1 text-rose-600 dark:text-rose-300"><Sparkles className="h-3 w-3" /> {active.ai_summary}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {active.account_provider === 'meta_cloud' && (
                    <span className={clsx('text-[11px] px-2 py-0.5 rounded-full', active.within_service_window ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300')}>
                      {active.within_service_window ? '24h window open' : 'Template needed'}
                    </span>
                  )}
                  {active.ai_enabled && (
                    <button onClick={() => patch({ ai_paused: !active.ai_paused, ...(active.ai_paused && active.status === 'needs_human' ? { status: 'open' } : {}) })}
                      className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                      {active.ai_paused ? <><PlayCircle className="h-3.5 w-3.5" /> Let AI reply</> : <><PauseCircle className="h-3.5 w-3.5" /> Pause AI</>}
                    </button>
                  )}
                  <button onClick={() => patch({ status: active.status === 'closed' ? 'open' : 'closed' })}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
                    <XCircle className="h-3.5 w-3.5" /> {active.status === 'closed' ? 'Reopen' : 'Close'}
                  </button>
                </div>
              </div>

              {active.status === 'needs_human' && (
                <div className="px-4 py-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-b border-amber-100 dark:border-amber-900">
                  The AI handed this chat to a person. Reply below; the AI stays paused here until you turn it back on.
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#efeae2] dark:bg-gray-900">
                {messages.map((m) => (
                  <div key={m.id} className={clsx('flex group', m.direction === 'out' ? 'justify-end' : 'justify-start')}>
                    <div className={clsx('max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm',
                      m.direction === 'out' ? 'bg-[#d9fdd3] dark:bg-green-900/60 text-gray-900 dark:text-gray-100' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100')}>
                      {m.sent_by === 'ai' && <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-300 mb-0.5"><Bot className="h-3 w-3" /> AI reply</div>}
                      {m.sent_by === 'campaign' && <div className="text-[10px] text-gray-500 mb-0.5">Campaign</div>}
                      {m.media && <div className="text-xs text-gray-500 mb-1">[{m.media.type}{m.media.filename ? `: ${m.media.filename}` : ''}]</div>}
                      <div className="whitespace-pre-wrap break-words">{m.body || (!m.media ? `[${m.type}]` : '')}</div>
                      <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-500">
                        {m.direction === 'out' && m.sent_by === 'user' && m.body && (
                          <button onClick={() => teach(m)} title="Teach the AI this answer"
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 mr-1 text-rose-600 dark:text-rose-300">
                            <GraduationCap className="h-3 w-3" /> Teach AI
                          </button>
                        )}
                        {timeLabel(m.created_at)}
                        {m.direction === 'out' && <Ticks m={m} />}
                      </div>
                      {m.error && m.direction === 'out' && <div className="text-[10px] text-red-600 mt-0.5">{m.error}</div>}
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>

              {suggestions.length > 0 && (
                <div className="px-3 pt-2 flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setText(s)} className="text-left text-xs px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 hover:bg-rose-100 max-w-full truncate">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                {active.whatsapp_opt_out ? (
                  <p className="text-sm text-gray-500 text-center py-2">This contact replied STOP. You can't message them unless they opt in again.</p>
                ) : metaWindowClosed ? (
                  <div className="flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span>This customer hasn't written in the last 24 hours. Meta only allows an approved template here.</span>
                    <button onClick={() => setTemplateOpen(true)} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-sm shrink-0"><FileText className="h-4 w-4" /> Send template</button>
                  </div>
                ) : (
                  <div className="flex items-end gap-2">
                    <button onClick={suggest} disabled={suggesting} title="Suggest replies with AI"
                      className="p-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 disabled:opacity-50">
                      <Sparkles className={clsx('h-5 w-5', suggesting && 'animate-pulse')} />
                    </button>
                    <button onClick={() => setTemplateOpen(true)} title="Use a template" className="p-2.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                      <FileText className="h-5 w-5" />
                    </button>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Type a message"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && text.trim()) { e.preventDefault(); send(); } }}
                      className="flex-1 resize-none max-h-40 px-3 py-2.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
                    <button onClick={() => send()} disabled={sending || !text.trim()} className="p-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal isOpen={templateOpen} onClose={() => setTemplateOpen(false)} title="Send a template" size="lg">
        {approvedTemplates.length === 0 ? (
          <p className="text-sm text-gray-500">No approved templates for this number yet. Add or sync them on the Templates tab.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {approvedTemplates.map((t) => (
              <button key={t.id} onClick={() => { setTemplateOpen(false); send(undefined, t.id); }}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-green-400">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name} <span className="text-xs text-gray-400">({t.language})</span></div>
                <div className="text-xs text-gray-500 mt-1 line-clamp-3 whitespace-pre-wrap">{t.body}</div>
              </button>
            ))}
            <p className="text-xs text-gray-500">Template variables are filled from this contact's details. Missing values are sent as "-".</p>
          </div>
        )}
      </Modal>

      <Modal isOpen={saveOpen} onClose={() => setSaveOpen(false)} title="Save as contact"
        footer={<div className="flex justify-end gap-2">
          <button onClick={() => setSaveOpen(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={saveContact} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">Save</button>
        </div>}>
        <div className="space-y-4">
          <TextInput label="Email (optional)" name="email" type="email" value={saveForm.email} onChange={(v) => setSaveForm({ ...saveForm, email: v })} />
          <TextInput label="First name" name="first_name" value={saveForm.first_name} onChange={(v) => setSaveForm({ ...saveForm, first_name: v })} />
          <CheckboxInput label="This person agreed to receive WhatsApp marketing" checked={saveForm.consent}
            onChange={(v) => setSaveForm({ ...saveForm, consent: v })} description="Only tick this if they actually opted in. Campaigns only go to consented contacts by default." />
        </div>
      </Modal>
    </div>
  );
}
