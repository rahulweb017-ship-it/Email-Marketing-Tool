import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, Loader2, Filter, Workflow, Mail, Check, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import AiCreditsLine from '../components/ai/AiCreditsLine';
import { useToastStore } from '../stores/toast.store';
import { aiCopilot, aiCopilotDraft, aiErrorMessage, type CopilotDraft, type CopilotReply } from '../api/ai';

interface Turn { role: 'user' | 'assistant'; content: string; reply?: CopilotReply }
type Created = { id: string; name: string; url: string; notes: string[]; count?: number };

const STARTERS = [
  'How did my email campaigns do in the last 3 months?',
  'Which contacts are at risk of going quiet, and how do I win them back?',
  'What should I send next week to get more sales?',
  'Where are my leads coming from, and which ones should I follow up first?',
];

const DRAFT_INFO = {
  segment: { label: 'Segment', icon: Filter },
  automation: { label: 'Automation', icon: Workflow },
  email_campaign: { label: 'Email campaign', icon: Mail },
} as const;

function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{l.replace(/^\s*[-*•]\s+/, '')}</li>)}</ul>;
        }
        return <p key={i} className="whitespace-pre-wrap">{b}</p>;
      })}
    </div>
  );
}

function DraftCard({ draft }: { draft: CopilotDraft }) {
  const addToast = useToastStore((s) => s.addToast);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const info = DRAFT_INFO[draft.kind];
  const Icon = info.icon;
  const create = async () => {
    setBusy(true);
    try { setCreated(await aiCopilotDraft(draft)); }
    catch (err) { addToast(aiErrorMessage(err, 'Could not create the draft'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-800 p-3">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-rose-100 dark:bg-rose-900/40 p-2 text-rose-700 dark:text-rose-200"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-rose-600 dark:text-rose-300">{info.label} draft</p>
          <p className="font-medium text-gray-900 dark:text-white">{draft.title}</p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{draft.brief}</p>
          {created ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex items-center gap-1.5 text-green-700 dark:text-green-400"><Check className="h-4 w-4" /> Created "{created.name}"{created.count !== undefined ? ` (${created.count.toLocaleString()} contacts)` : ''}</p>
              {created.notes.map((n) => <p key={n} className="text-amber-700 dark:text-amber-300">{n}</p>)}
              <Link to={created.url} className="font-medium text-primary-600 hover:underline">Open it</Link>
            </div>
          ) : (
            <button onClick={create} disabled={busy} className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {busy ? 'Creating...' : 'Create draft'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CopilotPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // Scroll only the chat pane; scrollIntoView would also scroll the page layout.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next); setInput(''); setBusy(true); setError('');
    try {
      const reply = await aiCopilot(next.map((t) => ({ role: t.role, content: t.content })));
      setTurns([...next, { role: 'assistant', content: reply.answer, reply }]);
    } catch (err) {
      setError(aiErrorMessage(err, 'Rabbit AI could not answer. Try again.'));
      setTurns(turns);
      setInput(q);
    } finally {
      setBusy(false);
    }
  };

  const lastReply = [...turns].reverse().find((t) => t.reply)?.reply;

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-4xl flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"><Sparkles className="h-6 w-6 text-rose-600" /> Rabbit AI Copilot</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ask about your results and get drafts you can review. Nothing is sent without you.</p>
        </div>
        {turns.length > 0 && (
          <button onClick={() => { setTurns([]); setError(''); }} className="flex items-center gap-1.5 rounded-lg border dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
            <RotateCcw className="h-4 w-4" /> New chat
          </button>
        )}
      </div>

      <div ref={scroller} className="mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
        {turns.length === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 text-left text-sm text-gray-700 dark:text-gray-200 hover:border-rose-300 hover:bg-rose-50/50 dark:hover:bg-rose-900/10">
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={clsx('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={clsx('max-w-[85%] rounded-2xl px-4 py-3 text-sm', t.role === 'user'
              ? 'bg-primary-600 text-white'
              : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200')}>
              {t.role === 'user' ? <p className="whitespace-pre-wrap">{t.content}</p> : <Answer text={t.content} />}
              {t.reply && t.reply.drafts.length > 0 && (
                <div className="mt-3 space-y-2">{t.reply.drafts.map((d, j) => <DraftCard key={j} draft={d} />)}</div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Rabbit AI is looking at your account...</div>
        )}
      </div>

      {lastReply && lastReply.follow_ups.length > 0 && !busy && (
        <div className="mb-2 flex flex-wrap gap-2">
          {lastReply.follow_ups.map((f) => (
            <button key={f} onClick={() => ask(f)} className="rounded-full border border-rose-200 dark:border-rose-800 px-3 py-1 text-xs text-rose-700 dark:text-rose-300">{f}</button>
          ))}
        </div>
      )}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-end gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} maxLength={4000}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          placeholder="Ask anything about your marketing, or ask for a campaign, segment or automation..."
          aria-label="Ask Rabbit AI"
          className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-gray-900 dark:text-gray-100 outline-none" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="rounded-lg bg-rose-600 p-2.5 text-white disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
      <div className="mt-2"><AiCreditsLine refreshKey={turns.length} /></div>
    </div>
  );
}
