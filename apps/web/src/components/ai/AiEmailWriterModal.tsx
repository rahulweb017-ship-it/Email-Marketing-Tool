import { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import Modal from '../ui/Modal';
import { aiRewrite, aiWriteEmail, aiErrorMessage } from '../../api/ai';
import AiCreditsLine from './AiCreditsLine';

const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500';
const REWRITES = ['Make it shorter', 'Make it friendlier', 'Make it more persuasive', 'Fix grammar and spelling', 'Translate to Hindi', 'Translate to Hinglish'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Text of the selected element, if it is a text block */
  selectedText: string | null;
  onInsert: (html: string, mode: 'replace' | 'append', subject: string) => void;
  onReplaceText: (text: string) => void;
}

export default function AiEmailWriterModal({ isOpen, onClose, selectedText, onInsert, onReplaceText }: Props) {
  const [tab, setTab] = useState<'write' | 'rewrite'>('write');
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState('');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [ctaUrl, setCtaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<{ subject: string; preview_text: string; html: string } | null>(null);
  const [instruction, setInstruction] = useState('');
  const [rewritten, setRewritten] = useState('');
  const [credits, setCredits] = useState(0);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (err) { setError(aiErrorMessage(err)); } finally { setBusy(false); setCredits((c) => c + 1); }
  };

  const write = () => run(async () => {
    setDraft(await aiWriteEmail({ brief, tone: tone || undefined, length, cta_url: ctaUrl || undefined }));
  });

  const rewrite = (text: string) => run(async () => {
    if (!selectedText) return;
    setRewritten((await aiRewrite({ text: selectedText, instruction: text })).text);
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Write with Rabbit AI" size="xl">
      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {(['write', 'rewrite'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('px-4 py-2 text-sm font-medium border-b-2 -mb-px', tab === t ? 'border-rose-600 text-rose-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t === 'write' ? 'Write a full email' : 'Rewrite selected text'}
          </button>
        ))}
      </div>

      {tab === 'write' ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">What is this email about?</span>
              <textarea rows={5} className={field} value={brief} onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. Diwali sale: 20% off all sweets boxes until 3 November, free delivery over Rs 999. Goal: get people to order online." />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Tone (optional)</span>
                <input className={field} value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Uses your brand voice" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Length</span>
                <select className={field} value={length} onChange={(e) => setLength(e.target.value as typeof length)}>
                  <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Button link (optional)</span>
              <input className={field} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://yourshop.com/sale" />
            </label>
            <button onClick={write} disabled={busy || brief.trim().length < 5}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              <Sparkles className="h-4 w-4" /> {busy ? 'Writing...' : draft ? 'Write again' : 'Write my email'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <AiCreditsLine refreshKey={credits} />
          </div>
          <div className="min-h-[320px] rounded-lg border border-gray-200 bg-gray-50">
            {draft ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm">
                  <p><span className="text-gray-500">Subject:</span> <span className="font-medium">{draft.subject}</span></p>
                  <p className="text-gray-500 text-xs mt-0.5">{draft.preview_text}</p>
                </div>
                <iframe title="AI email preview" sandbox="" srcDoc={draft.html} className="h-[340px] w-full bg-white" />
                <div className="flex flex-wrap gap-2 border-t border-gray-200 bg-white p-3">
                  <button onClick={() => onInsert(draft.html, 'replace', draft.subject)} className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">Replace my email</button>
                  <button onClick={() => onInsert(draft.html, 'append', draft.subject)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Add to the end</button>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-6 text-center text-sm text-gray-500">
                <Sparkles className="mb-2 h-8 w-8 text-rose-400" />
                Your AI draft appears here. You can edit everything in the editor afterwards.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedText ? (
            <>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-700">Selected text</p>
                <p className="max-h-32 overflow-auto rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">{selectedText}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {REWRITES.map((r) => (
                  <button key={r} onClick={() => rewrite(r)} disabled={busy} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50">{r}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className={field} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Or type your own instruction, e.g. add urgency about the weekend" />
                <button onClick={() => rewrite(instruction)} disabled={busy || instruction.trim().length < 2} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  <Wand2 className="h-4 w-4" /> Rewrite
                </button>
              </div>
              {busy && <p className="text-sm text-gray-500">Rewriting...</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {rewritten && (
                <div className="rounded-lg border border-rose-200 bg-white p-3">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{rewritten}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { onReplaceText(rewritten); setRewritten(''); }} className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white">Use this text</button>
                    <button onClick={() => setRewritten('')} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700">Discard</button>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">Bold, italic and links inside this block are replaced with plain text.</p>
                </div>
              )}
              <AiCreditsLine refreshKey={credits} />
            </>
          ) : (
            <p className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">Close this window, click a text block in your email, then open Write with AI again.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
