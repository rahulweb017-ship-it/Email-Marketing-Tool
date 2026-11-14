import { useEffect, useState } from 'react';
import { Save, Sparkles } from 'lucide-react';
import { getAiUsage, getBrandProfile, saveBrandProfile, aiErrorMessage, type AiUsage, type BrandProfile } from '../../api/ai';
import { useToastStore } from '../../stores/toast.store';
import { Spinner } from '../ui/Spinner';

const FIELDS: { key: keyof BrandProfile; label: string; placeholder: string; rows?: number }[] = [
  { key: 'business_name', label: 'Business name', placeholder: 'e.g. Bite for Deals' },
  { key: 'website', label: 'Website', placeholder: 'https://' },
  { key: 'industry', label: 'Industry', placeholder: 'e.g. Restaurant deals, fashion, coaching' },
  { key: 'tone', label: 'Tone of voice', placeholder: 'e.g. Friendly, upbeat, never pushy' },
  { key: 'language', label: 'Default language', placeholder: 'e.g. English, Hindi, Hinglish' },
  { key: 'description', label: 'About your business', placeholder: 'What you do and what makes you different', rows: 3 },
  { key: 'products', label: 'Products and services', placeholder: 'Main products, price ranges, current offers', rows: 4 },
  { key: 'audience', label: 'Target audience', placeholder: 'Who your customers are and what they care about', rows: 3 },
  { key: 'words_to_use', label: 'Words and phrases to use', placeholder: 'e.g. "fresh", "handmade", your slogan', rows: 2 },
  { key: 'words_to_avoid', label: 'Words and phrases to avoid', placeholder: 'e.g. "cheap", competitor names', rows: 2 },
  { key: 'sample_copy', label: 'Example of your writing', placeholder: 'Paste an email or post you liked. The AI copies its style.', rows: 4 },
];

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500';

export default function BrandVoicePanel() {
  const addToast = useToastStore((s) => s.addToast);
  const [form, setForm] = useState<Partial<BrandProfile> | null>(null);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBrandProfile().then(setForm).catch(() => { setForm({}); addToast('Failed to load brand profile', 'error'); });
    getAiUsage().then(setUsage).catch(() => undefined);
  }, [addToast]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      setForm(await saveBrandProfile(form));
      addToast('Brand voice saved. Every AI feature will use it.', 'success');
    } catch (err) {
      addToast(aiErrorMessage(err, 'Failed to save brand voice'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="flex justify-center py-12"><Spinner /></div>;
  const pct = usage && usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/30 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Rabbit AI credits</h3>
        </div>
        {usage ? (
          usage.limit > 0 ? (
            <>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {usage.used.toLocaleString()} of {usage.limit.toLocaleString()} credits used in {usage.period}. Credits reset on the 1st of each month.
              </p>
              <div className="mt-3 h-2 rounded-full bg-white/70 dark:bg-gray-800 overflow-hidden">
                <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : 'bg-violet-600'}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Costs: full email {usage.costs.email_write}, subject lines {usage.costs.subject_lines}, social posts {usage.costs.social_write}, rewrite or WhatsApp reply {usage.costs.email_rewrite}.
              </p>
            </>
          ) : <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">AI features are not included in your current plan. Contact us to upgrade.</p>
        ) : <p className="mt-2 text-sm text-gray-500">Loading usage...</p>}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Brand voice</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tell Rabbit AI about your business once. It uses this for emails, subject lines, social posts and WhatsApp messages. The AI never invents prices or offers that are not written here.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className={f.rows ? 'md:col-span-2 block' : 'block'}>
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{f.label}</span>
              {f.rows ? (
                <textarea rows={f.rows} className={input} placeholder={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              ) : (
                <input className={input} placeholder={f.placeholder} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />} Save brand voice
          </button>
        </div>
      </div>
    </div>
  );
}
