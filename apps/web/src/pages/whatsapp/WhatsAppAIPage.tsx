import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Bot, Plus, Trash2, Pencil, Send, GraduationCap, BookOpen, User } from 'lucide-react';
import WhatsAppTabs from '../../components/whatsapp/WhatsAppTabs';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { SelectInput, TextArea, TextInput } from '../../components/ui/FormField';
import { useToastStore } from '../../stores/toast.store';
import {
  apiError, createKnowledge, deleteKnowledge, listKnowledge, listWaAccounts, testWaBot, updateKnowledge, updateWaAccount,
  type WaAccount, type WaKnowledge,
} from '../../api/whatsapp';

function BotSettings({ account, onSaved }: { account: WaAccount; onSaved: () => void }) {
  const addToast = useToastStore((s) => s.addToast);
  const [s, setS] = useState({
    business_name: account.ai_settings?.business_name || '',
    business_profile: account.ai_settings?.business_profile || '',
    tone: account.ai_settings?.tone || '',
    language: account.ai_settings?.language || '',
    handoff: (account.ai_settings?.handoff_keywords || []).join(', '),
  });
  const [saving, setSaving] = useState(false);

  const save = async (enabled = account.ai_enabled) => {
    setSaving(true);
    try {
      await updateWaAccount(account.id, {
        ai_enabled: enabled,
        ai_settings: {
          business_name: s.business_name, business_profile: s.business_profile, tone: s.tone, language: s.language,
          handoff_keywords: s.handoff.split(',').map((k) => k.trim()).filter(Boolean),
        },
      });
      addToast(enabled !== account.ai_enabled ? (enabled ? 'AI auto-replies are on for this number' : 'AI auto-replies are off') : 'Saved', 'success');
      onSaved();
    } catch (err) { addToast(apiError(err, 'Could not save'), 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{account.name}</h3>
          <p className="text-xs text-gray-500">When on, the AI answers customer messages from your knowledge base, and hands the chat to a person when it isn't sure.</p>
        </div>
        <button onClick={() => save(!account.ai_enabled)} disabled={saving}
          className={clsx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', account.ai_enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600')}>
          <span className={clsx('inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform', account.ai_enabled ? 'translate-x-5' : 'translate-x-0.5')} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Business name" name="bn" value={s.business_name} onChange={(v) => setS({ ...s, business_name: v })} placeholder="Sharma Sarees, Pune" />
        <TextInput label="Tone" name="tone" value={s.tone} onChange={(v) => setS({ ...s, tone: v })} placeholder="Warm and polite, like a helpful shop owner" />
      </div>
      <TextArea label="About the business (what the AI should always know)" name="profile" rows={4} value={s.business_profile} onChange={(v) => setS({ ...s, business_profile: v })}
        placeholder="We sell handloom sarees. Open 10am–8pm, Mon–Sat. Free delivery within Pune on orders over ₹999. Payment by UPI or cash on delivery. Returns within 7 days." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Default reply language" name="lang" value={s.language} onChange={(v) => setS({ ...s, language: v })} placeholder="Match the customer (default)" />
        <TextInput label="Hand to a person when a customer says (comma separated)" name="handoff" value={s.handoff} onChange={(v) => setS({ ...s, handoff: v })} placeholder="agent, human, complaint, call me" />
      </div>
      <div className="flex justify-end">
        <button onClick={() => save()} disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">Save settings</button>
      </div>
    </div>
  );
}

export default function WhatsAppAIPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [knowledge, setKnowledge] = useState<WaKnowledge[]>([]);
  const [editing, setEditing] = useState<Partial<WaKnowledge> | null>(null);
  const [deleting, setDeleting] = useState<WaKnowledge | null>(null);
  const [testAccount, setTestAccount] = useState('');
  const [chat, setChat] = useState<{ role: 'customer' | 'business'; text: string; note?: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, k] = await Promise.all([listWaAccounts(), listKnowledge()]);
      setAccounts(a); setKnowledge(k);
      setTestAccount((cur) => cur || a[0]?.id || '');
    } catch (err) { addToast(apiError(err, 'Failed to load AI settings'), 'error'); }
  }, [addToast]);
  useEffect(() => { load(); }, [load]);

  const saveEntry = async () => {
    if (!editing?.title || !editing.content) return;
    try {
      if (editing.id) await updateKnowledge(editing.id, { title: editing.title, content: editing.content, account_id: editing.account_id ?? null });
      else await createKnowledge({ title: editing.title, content: editing.content, account_id: editing.account_id ?? null });
      setEditing(null); load();
    } catch (err) { addToast(apiError(err, 'Could not save'), 'error'); }
  };

  const toggle = async (k: WaKnowledge) => {
    try { await updateKnowledge(k.id, { is_active: !k.is_active }); load(); } catch (err) { addToast(apiError(err, 'Failed'), 'error'); }
  };

  const ask = async () => {
    if (!chatInput.trim() || !testAccount) return;
    const next = [...chat, { role: 'customer' as const, text: chatInput.trim() }];
    setChat(next); setChatInput(''); setThinking(true);
    try {
      const r = await testWaBot(testAccount, next.map(({ role, text }) => ({ role, text })));
      setChat([...next, r.action === 'handoff'
        ? { role: 'business', text: '→ Handed to a person', note: r.reason }
        : { role: 'business', text: r.reply, note: r.reason }]);
    } catch (err) {
      addToast(apiError(err, 'The AI test failed'), 'error');
    } finally { setThinking(false); }
  };

  return (
    <div>
      <WhatsAppTabs title="AI assistant" subtitle="Teach the AI about your business, then let it answer customers on WhatsApp" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {accounts.length === 0 && <p className="text-sm text-gray-500">Connect a WhatsApp number to turn on AI replies.</p>}
          {accounts.map((a) => <BotSettings key={a.id} account={a} onSaved={load} />)}

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Knowledge base</h2>
                <p className="text-xs text-gray-500">The AI only answers from what's here. Add FAQs, products and prices, delivery and return policies. In the inbox, click "Teach AI" on your own reply to add it here.</p>
              </div>
              <button onClick={() => setEditing({ title: '', content: '', account_id: null })} className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg shrink-0"><Plus className="h-4 w-4" /> Add</button>
            </div>
            {knowledge.length === 0 ? (
              <p className="p-6 text-sm text-center text-gray-500">Nothing yet. Start with your 5 most common customer questions.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {knowledge.map((k) => (
                  <li key={k.id} className={clsx('p-4 flex gap-3', !k.is_active && 'opacity-50')}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{k.title}</span>
                        {k.source === 'taught_from_reply' && <span className="flex items-center gap-0.5 text-[10px] text-rose-600"><GraduationCap className="h-3 w-3" /> taught</span>}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap line-clamp-3">{k.content}</p>
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      <button onClick={() => toggle(k)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">{k.is_active ? 'On' : 'Off'}</button>
                      <button onClick={() => setEditing(k)} className="p-1.5 text-gray-500 hover:text-gray-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleting(k)} className="p-1.5 text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Test chat */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col h-[36rem]">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-2">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Bot className="h-4 w-4" /> Test the bot</h2>
            <p className="text-xs text-gray-500">Chat as a customer. Nothing is sent on WhatsApp.</p>
            {accounts.length > 1 && (
              <SelectInput label="" name="test-account" value={testAccount} onChange={(v) => { setTestAccount(v); setChat([]); }}
                options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#efeae2] dark:bg-gray-900">
            {chat.map((m, i) => (
              <div key={i} className={clsx('flex', m.role === 'customer' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm', m.role === 'customer' ? 'bg-[#d9fdd3] dark:bg-green-900/60' : 'bg-white dark:bg-gray-800')}>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5">{m.role === 'customer' ? <><User className="h-3 w-3" /> Customer</> : <><Bot className="h-3 w-3" /> AI</>}</div>
                  <div className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">{m.text}</div>
                  {m.note && <div className="text-[10px] text-gray-400 mt-1 italic">{m.note}</div>}
                </div>
              </div>
            ))}
            {thinking && <div className="text-xs text-gray-500">AI is typing…</div>}
          </div>
          <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="e.g. Do you deliver to Baner?" className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100" />
            <button onClick={ask} disabled={thinking || !testAccount} className="p-2 rounded-lg bg-green-600 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </div>
          {chat.length > 0 && <button onClick={() => setChat([])} className="text-xs text-gray-500 pb-2">Clear chat</button>}
        </div>
      </div>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit knowledge' : 'Add knowledge'} size="lg"
        footer={<div className="flex justify-end gap-2">
          <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
          <button onClick={saveEntry} disabled={!editing?.title || !editing?.content} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">Save</button>
        </div>}>
        {editing && (
          <div className="space-y-4">
            <TextInput label="Topic or question" name="title" value={editing.title || ''} onChange={(v) => setEditing({ ...editing, title: v })} placeholder="Delivery charges" />
            <TextArea label="Answer / details" name="content" rows={6} value={editing.content || ''} onChange={(v) => setEditing({ ...editing, content: v })}
              placeholder="Free delivery in Pune for orders over ₹999, otherwise ₹60. Other cities: ₹120, 3–5 days." />
            {accounts.length > 1 && (
              <SelectInput label="Use for" name="acc" value={editing.account_id || ''} onChange={(v) => setEditing({ ...editing, account_id: v || null })}
                placeholder="All numbers" options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
            )}
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={!!deleting} onClose={() => setDeleting(null)} variant="danger" title="Delete this entry?" confirmLabel="Delete"
        message="The AI will no longer use this information."
        onConfirm={async () => { if (deleting) { await deleteKnowledge(deleting.id).catch(() => {}); setDeleting(null); load(); } }} />
    </div>
  );
}
