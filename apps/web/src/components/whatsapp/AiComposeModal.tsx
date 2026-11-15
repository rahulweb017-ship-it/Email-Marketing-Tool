import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import Modal from '../ui/Modal';
import { SelectInput, TextArea } from '../ui/FormField';
import { useToastStore } from '../../stores/toast.store';
import { apiError, composeWaMessage } from '../../api/whatsapp';

/** "Write with AI": describe the goal, pick tone and language, get a ready WhatsApp message. */
export default function AiComposeModal({ open, forTemplate, onClose, onUse }: {
  open: boolean; forTemplate?: boolean; onClose: () => void; onUse: (message: string) => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const [goal, setGoal] = useState('');
  const [tone, setTone] = useState('friendly');
  const [language, setLanguage] = useState('English');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('short');
  const [result, setResult] = useState<{ message: string; notes: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await composeWaMessage({ goal, tone, language, length, for_template: forTemplate });
      setResult({ message: r.message, notes: r.notes });
    } catch (err) {
      addToast(apiError(err, 'The AI could not write this message'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Write with AI" size="lg"
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
        {result && <button onClick={generate} disabled={busy} className="flex items-center gap-1 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"><RefreshCw className="h-4 w-4" /> Try again</button>}
        {result
          ? <button onClick={() => onUse(result.message)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg">Use this message</button>
          : <button onClick={generate} disabled={busy || goal.trim().length < 3} className="flex items-center gap-1 px-4 py-2 text-sm bg-rose-600 text-white rounded-lg disabled:opacity-50">
              <Sparkles className="h-4 w-4" /> {busy ? 'Writing…' : 'Write it'}
            </button>}
      </div>}>
      <div className="space-y-4">
        <TextArea label="What should the message do?" name="goal" rows={3} value={goal} onChange={setGoal}
          placeholder="Tell customers about our Diwali sale: 20% off sarees until 3 Nov, free delivery in Pune. Ask them to reply YES for the catalogue." />
        <div className="grid grid-cols-3 gap-3">
          <SelectInput label="Tone" name="tone" value={tone} onChange={setTone}
            options={['friendly', 'professional', 'festive', 'urgent but polite', 'warm and personal'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
          <SelectInput label="Language" name="language" value={language} onChange={setLanguage}
            options={['English', 'Hindi', 'Hinglish', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali'].map((v) => ({ value: v, label: v }))} />
          <SelectInput label="Length" name="length" value={length} onChange={(v) => setLength(v as 'short' | 'medium' | 'long')}
            options={[{ value: 'short', label: 'Short' }, { value: 'medium', label: 'Medium' }, { value: 'long', label: 'Long' }]} />
        </div>
        {result && (
          <div className="space-y-2">
            <TextArea label="Draft (you can edit it)" name="draft" rows={7} value={result.message} onChange={(v) => setResult({ ...result, message: v })} />
            {result.notes && <p className="text-xs text-gray-500 dark:text-gray-400">Tip: {result.notes}</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
