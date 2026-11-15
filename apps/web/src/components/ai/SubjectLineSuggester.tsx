import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { aiSubjectLines, aiErrorMessage, type SubjectSuggestion } from '../../api/ai';
import AiCreditsLine from './AiCreditsLine';

interface Props {
  currentSubject: string;
  contentHtml: string;
  onPick: (s: SubjectSuggestion) => void;
}

/** "Suggest with AI" button plus a panel of scored subject lines. */
export default function SubjectLineSuggester({ currentSubject, contentHtml, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<SubjectSuggestion[]>([]);
  const [credits, setCredits] = useState(0);
  const hasContext = !!(contentHtml.trim() || currentSubject.trim());

  const run = async () => {
    setBusy(true); setError('');
    try {
      const res = await aiSubjectLines({ topic: topic || undefined, content_html: contentHtml || undefined, current_subject: currentSubject || undefined });
      setItems(res.suggestions);
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(false); setCredits((c) => c + 1);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400">
        <Sparkles className="h-3.5 w-3.5" /> Suggest subject lines with AI
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-800 dark:text-rose-200"><Sparkles className="h-4 w-4" /> AI subject lines</p>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-2">
        <input value={topic} onChange={(e) => setTopic(e.target.value)}
          placeholder={hasContext ? 'Optional: anything to focus on' : 'What is this email about?'}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
        <button type="button" onClick={run} disabled={busy || (!hasContext && topic.trim().length < 3)}
          className="shrink-0 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? 'Thinking...' : items.length ? 'Try again' : 'Suggest'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s.subject}>
              <button type="button" onClick={() => onPick(s)} className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-left hover:border-rose-400">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.subject}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${s.score >= 8 ? 'bg-green-100 text-green-700' : s.score >= 6 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{s.score}/10</span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{s.preview_text}</p>
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{s.reason}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      <AiCreditsLine refreshKey={credits} />
    </div>
  );
}
