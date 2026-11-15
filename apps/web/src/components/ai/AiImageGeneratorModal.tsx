import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import AiCreditsLine from './AiCreditsLine';
import { aiGenerateImage, aiErrorMessage, type ImageSize, type ImageStyle } from '../../api/ai';
import type { MediaAsset } from '../../api/media';

const SIZES: { value: ImageSize; label: string }[] = [
  { value: 'landscape', label: 'Banner (3:2)' },
  { value: 'square', label: 'Square (1:1)' },
  { value: 'portrait', label: 'Portrait (2:3)' },
];
const STYLES: { value: ImageStyle; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'illustration', label: 'Illustration' },
  { value: '3d', label: '3D render' },
  { value: 'minimal', label: 'Minimal' },
];
const EXAMPLES = [
  'A cosy cafe table with a latte and fresh croissants, warm morning light',
  'Festive Diwali sale banner background with diyas and marigold flowers',
  'Smiling woman unboxing a parcel at home, bright and cheerful',
];

/** Describe an image and Rabbit AI creates it straight into the media library. */
export default function AiImageGeneratorModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean; onClose: () => void; onCreated: (asset: MediaAsset) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<ImageSize>('landscape');
  const [style, setStyle] = useState<ImageStyle>('photo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState(0);

  const run = async () => {
    setBusy(true); setError('');
    try {
      const asset = await aiGenerateImage({ prompt: prompt.trim(), size, style });
      onCreated(asset);
      onClose();
    } catch (err) {
      setError(aiErrorMessage(err, 'Could not create the image'));
    } finally {
      setBusy(false); setRuns((n) => n + 1);
    }
  };

  const chip = (active: boolean) => `px-3 py-1.5 rounded-lg border text-sm ${active
    ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`;

  return (
    <Modal isOpen={isOpen} onClose={busy ? () => {} : onClose} title="Create an image with Rabbit AI" size="lg" footer={
      <div className="flex items-center justify-between gap-3">
        <AiCreditsLine refreshKey={runs} />
        <div className="flex gap-3">
          <button onClick={onClose} disabled={busy} className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm dark:text-gray-300 disabled:opacity-50">Cancel</button>
          <button onClick={run} disabled={busy || prompt.trim().length < 5}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Creating (up to a minute)...' : 'Create image'}
          </button>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label htmlFor="ai-image-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Describe the image</label>
          <textarea id="ai-image-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={2000}
            placeholder="What should be in the picture? Mention the subject, setting, colours and mood."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm" />
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => setPrompt(e)}
                className="rounded-full border border-rose-200 dark:border-rose-800 px-3 py-1 text-xs text-rose-700 dark:text-rose-300 text-left">
                {e.split(',')[0]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shape</p>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => <button key={s.value} type="button" onClick={() => setSize(s.value)} className={chip(size === s.value)}>{s.label}</button>)}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Style</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => <button key={s.value} type="button" onClick={() => setStyle(s.value)} className={chip(style === s.value)}>{s.label}</button>)}
          </div>
        </div>
        <p className="text-xs text-gray-500">Images come without text, so you can add your own headline in the email or post. The image is saved to your media library.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
