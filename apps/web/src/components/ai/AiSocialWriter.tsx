import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { aiWriteSocial, aiErrorMessage, type SocialPlatform } from '../../api/ai';
import PlatformIcon from '../social/PlatformIcon';
import AiCreditsLine from './AiCreditsLine';

const ALL: SocialPlatform[] = ['twitter', 'facebook', 'linkedin', 'instagram'];

export default function AiSocialWriter({ platforms, onUse }: { platforms: string[]; onUse: (text: string) => void }) {
  const [brief, setBrief] = useState('');
  const [hashtags, setHashtags] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState<{ platform: SocialPlatform; text: string }[]>([]);
  const [credits, setCredits] = useState(0);
  const targets = (platforms.filter((p) => ALL.includes(p as SocialPlatform)) as SocialPlatform[]);
  const chosen = targets.length ? targets : (['twitter', 'facebook', 'linkedin'] as SocialPlatform[]);

  const run = async () => {
    setBusy(true); setError('');
    try {
      setPosts((await aiWriteSocial({ brief, platforms: chosen, include_hashtags: hashtags })).posts);
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(false); setCredits((c) => c + 1);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-violet-200 dark:border-violet-800 p-5 space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-800 dark:text-violet-200"><Sparkles className="h-4 w-4" /> Write with Rabbit AI</p>
      <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
        placeholder="e.g. Announce our new weekend brunch menu, 15% off for first-time visitors this month"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={hashtags} onChange={(e) => setHashtags(e.target.checked)} /> Include hashtags
        </label>
        <span className="text-xs text-gray-500">For: {chosen.join(', ')}{targets.length ? '' : ' (pick accounts to change)'}</span>
      </div>
      <button onClick={run} disabled={busy || brief.trim().length < 5} className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Writing...' : posts.length ? 'Write again' : 'Write posts'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {posts.map((p) => (
        <div key={p.platform} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <PlatformIcon platform={p.platform} size={14} showLabel />
            <button onClick={() => onUse(p.text)} className="text-xs font-medium text-primary-600 hover:text-primary-700">Use this</button>
          </div>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{p.text}</p>
          <p className="mt-1 text-right text-[11px] text-gray-400">{p.text.length} characters</p>
        </div>
      ))}
      <AiCreditsLine refreshKey={credits} />
    </div>
  );
}
