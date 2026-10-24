import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CampaignStateBadge } from '../../components/whatsapp/WaBadges';
import Pagination from '../../components/ui/Pagination';
import { PageLoader } from '../../components/ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { apiError, formatPhone, getWaCampaignMessages, getWaCampaignStats, type WaCampaign } from '../../api/whatsapp';

const STATUS_FILTERS = ['', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled'];

export default function WhatsAppCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const addToast = useToastStore((s) => s.addToast);
  const [campaign, setCampaign] = useState<WaCampaign | null>(null);
  const [readsByHour, setReadsByHour] = useState<{ hour: number; count: number }[]>([]);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getWaCampaignMessages>>['data']>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, m] = await Promise.all([getWaCampaignStats(id), getWaCampaignMessages(id, { page, per_page: 25, status: status || undefined })]);
      setCampaign(s.campaign);
      setReadsByHour(Array.from({ length: 24 }, (_, h) => ({ hour: h, count: s.reads_by_hour.find((r) => r.hour === h)?.count || 0 })));
      setRows(m.data); setTotal(m.total);
    } catch (err) { addToast(apiError(err, 'Failed to load the report'), 'error'); }
  }, [id, page, status, addToast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!campaign || !['sending', 'queued'].includes(campaign.state)) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [campaign, load]);

  if (!campaign) return <PageLoader />;
  const c = campaign;
  const rate = (a: number) => (c.stat_sent ? `${Math.round((a / c.stat_sent) * 100)}%` : '–');
  const tiles = [
    { label: 'Recipients', value: c.stat_total.toLocaleString('en-IN') },
    { label: 'Sent', value: c.stat_sent.toLocaleString('en-IN') },
    { label: 'Delivered', value: rate(c.stat_delivered) },
    { label: 'Read', value: rate(c.stat_read) },
    { label: 'Replied', value: c.stat_replied.toLocaleString('en-IN') },
    { label: 'Failed', value: c.stat_failed.toLocaleString('en-IN') },
    { label: 'Opted out', value: c.stat_opted_out.toLocaleString('en-IN') },
    { label: 'Skipped', value: c.stat_skipped.toLocaleString('en-IN') },
  ];

  return (
    <div>
      <Link to="/whatsapp/campaigns" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"><ArrowLeft className="h-4 w-4" /> Campaigns</Link>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{c.name}</h1>
        <CampaignStateBadge state={c.state} />
      </div>
      <p className="text-sm text-gray-500 mb-6">{c.account_name}{c.started_at ? ` · started ${new Date(c.started_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}{c.failure_reason ? ` · ${c.failure_reason}` : ''}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.value}</div>
            <div className="text-xs text-gray-500">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Message</h2>
          <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300 bg-[#d9fdd3]/40 dark:bg-green-900/20 rounded-lg p-3">{c.template_body || c.message_body || '—'}</p>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">When people read it (hour of day, IST)</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={readsByHour} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={(h: number) => `${h}`} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${h}:00–${h}:59`} />
                <Bar dataKey="count" name="Reads" fill="#16a34a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-1 p-3 border-b border-gray-100 dark:border-gray-700">
          {STATUS_FILTERS.map((s) => (
            <button key={s || 'all'} onClick={() => { setStatus(s); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded-full ${status === s ? 'bg-green-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Recipient</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sent</th>
                <th className="px-4 py-2 font-medium">Read</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 border-gray-100 dark:border-gray-700">
                  <td className="px-4 py-2">
                    <div className="text-gray-900 dark:text-gray-100">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</div>
                    <div className="text-xs text-gray-500">{formatPhone(r.phone_e164)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="capitalize text-gray-700 dark:text-gray-300">{r.status}</span>
                    {r.error && <div className="text-xs text-red-600">{r.error}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.sent_at ? new Date(r.sent_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '–'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.read_at ? new Date(r.read_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '–'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No messages with this status.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-3"><Pagination page={page} total={total} perPage={25} onPageChange={setPage} /></div>
      </div>
    </div>
  );
}
