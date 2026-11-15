import { useState } from 'react';
import { Sparkles, ThumbsUp, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';
import { aiCampaignInsights, aiErrorMessage, type CampaignInsights } from '../../api/ai';
import AiCreditsLine from './AiCreditsLine';

interface Props {
  campaignId: string;
  initial: CampaignInsights | string | null | undefined;
  initialAt?: string | null;
  canRun: boolean;
}

function parse(value: Props['initial']): CampaignInsights | null {
  if (!value) return null;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } }
  return value;
}

/** Rabbit AI's plain-language read of a sent campaign, cached on the campaign. */
export default function CampaignInsightsPanel({ campaignId, initial, initialAt, canRun }: Props) {
  const [insights, setInsights] = useState<CampaignInsights | null>(parse(initial));
  const [at, setAt] = useState<string | null>(initialAt || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState(0);

  const run = async () => {
    setBusy(true); setError('');
    try {
      const res = await aiCampaignInsights(campaignId);
      setInsights(res);
      setAt(res.generated_at || new Date().toISOString());
    } catch (err) {
      setError(aiErrorMessage(err));
    } finally {
      setBusy(false); setRuns((n) => n + 1);
    }
  };

  const section = (title: string, items: string[], Icon: typeof ThumbsUp, color: string) =>
    items.length > 0 && (
      <div>
        <p className={`flex items-center gap-1.5 text-sm font-semibold ${color}`}><Icon className="h-4 w-4" /> {title}</p>
        <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
          {items.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </div>
    );

  return (
    <div className="mb-8 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-rose-900 dark:text-rose-100">
          <Sparkles className="h-5 w-5 text-rose-600" /> Rabbit AI insights
        </h2>
        {canRun && (
          <button type="button" onClick={run} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            {insights ? <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Analysing...' : insights ? 'Refresh' : 'Explain my results'}
          </button>
        )}
      </div>

      {!insights && !busy && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {canRun ? 'Get a plain-language summary of how this campaign did and what to try next.' : 'Insights are available once the campaign has been sent.'}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {insights && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{insights.headline}</p>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{insights.summary}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {section('What worked', insights.wins, ThumbsUp, 'text-green-700 dark:text-green-400')}
            {section('Watch out for', insights.issues, AlertTriangle, 'text-amber-700 dark:text-amber-400')}
            {section('Try next', insights.recommendations, Lightbulb, 'text-rose-700 dark:text-rose-300')}
          </div>
          {at && <p className="text-xs text-gray-500">Generated {new Date(at).toLocaleString()}</p>}
        </div>
      )}
      {canRun && <div className="mt-3"><AiCreditsLine refreshKey={runs} /></div>}
    </div>
  );
}
