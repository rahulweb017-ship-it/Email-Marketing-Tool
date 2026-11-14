import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import AiCreditsLine from './AiCreditsLine';
import { aiBuildAutomation, aiErrorMessage } from '../../api/ai';

const EXAMPLES = [
  'Welcome series: a welcome email right away, a tips email 2 days later, and if they opened it, a 10% first-order offer; if not, a short reminder.',
  'Win back inactive customers: a "we miss you" email, wait 5 days, and tag anyone who clicked as "re-engaged".',
];

/** Describe a workflow in plain words and Rabbit AI drafts the steps and emails as a draft automation. */
export default function AiAutomationBuilderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [description, setDescription] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ id: string; name: string; summary: string; notes: string[] } | null>(null);
  const [runs, setRuns] = useState(0);

  const close = () => { setResult(null); setError(''); onClose(); };

  const run = async () => {
    setBusy(true); setError('');
    try {
      setResult(await aiBuildAutomation({ description: description.trim(), cta_url: ctaUrl.trim() || undefined }));
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(false); setRuns((n) => n + 1);
    }
  };

  const footer = result ? (
    <div className="flex justify-end gap-3">
      <button onClick={() => setResult(null)} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm dark:text-gray-300">Build another</button>
      <button onClick={() => navigate(`/automations/${result.id}/edit`)} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm">Review workflow</button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <AiCreditsLine refreshKey={runs} />
      <div className="flex gap-3">
        <button onClick={close} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm dark:text-gray-300">Cancel</button>
        <button onClick={run} disabled={busy || description.trim().length < 10}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-50">
          <Sparkles className="h-4 w-4" /> {busy ? 'Building (about 30s)...' : 'Build workflow'}
        </button>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={close} title="Build an automation with Rabbit AI" size="lg" footer={footer}>
      {result ? (
        <div className="space-y-3">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{result.name}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{result.summary}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            It was saved as a draft with its emails as templates. Review each email, choose the audience and sender, then start it.
          </p>
          {result.notes.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Needs your attention</p>
              <ul className="mt-1 list-disc pl-5">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="ai-automation-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">What should this automation do?</label>
            <textarea id="ai-automation-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} maxLength={2000}
              placeholder="Describe the emails, the waits between them and what should happen when someone opens or clicks."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => setDescription(e)}
                  className="rounded-full border border-violet-200 dark:border-violet-800 px-3 py-1 text-xs text-violet-700 dark:text-violet-300 text-left">
                  {e.split(':')[0]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="ai-automation-cta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Button link (optional)</label>
            <input id="ai-automation-cta" type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://yourshop.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
