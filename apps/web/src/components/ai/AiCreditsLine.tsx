import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getAiUsage, type AiUsage } from '../../api/ai';

/** Small "x of y AI credits left" line; refreshes whenever `refreshKey` changes. */
export default function AiCreditsLine({ refreshKey = 0 }: { refreshKey?: number }) {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  useEffect(() => { getAiUsage().then(setUsage).catch(() => setUsage(null)); }, [refreshKey]);
  if (!usage) return null;
  const left = Math.max(0, usage.limit - usage.used);
  return (
    <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <Sparkles className="h-3.5 w-3.5 text-rose-500" />
      {usage.limit > 0 ? `${left.toLocaleString()} of ${usage.limit.toLocaleString()} AI credits left this month` : 'AI is not included in your plan'}
    </p>
  );
}
