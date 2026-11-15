import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Send, CheckCheck, Eye, MessageCircle, Reply, UserX, Bot, Inbox, Plus, AlertTriangle, Smartphone,
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import WhatsAppTabs from '../../components/whatsapp/WhatsAppTabs';
import { AccountStatusBadge, ProviderBadge } from '../../components/whatsapp/WaBadges';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useToastStore } from '../../stores/toast.store';
import {
  getWaAccountHealth, getWaDaily, getWaOverview, formatPhone,
  type WaAccountHealth, type WaDaily, type WaOverview,
} from '../../api/whatsapp';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => v.toLocaleString('en-IN');

function Kpi({ icon: Icon, label, value, hint, tone, delay }: {
  icon: typeof Send; label: string; value: string; hint?: string; tone: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${tone}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export default function WhatsAppDashboardPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<WaOverview | null>(null);
  const [daily, setDaily] = useState<WaDaily[]>([]);
  const [health, setHealth] = useState<WaAccountHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [o, d, h] = await Promise.all([getWaOverview(days), getWaDaily(days), getWaAccountHealth()]);
      setOverview(o); setDaily(d); setHealth(h);
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Failed to load WhatsApp stats', 'error');
    } finally {
      setLoading(false);
    }
  }, [days, addToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  const actions = (
    <>
      <select value={days} onChange={(e) => setDays(Number(e.target.value))}
        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
      </select>
      <button onClick={() => navigate('/whatsapp/campaigns?new=1')}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
        <Plus className="h-4 w-4" /> New campaign
      </button>
    </>
  );

  if (!health.length) {
    return (
      <div>
        <WhatsAppTabs title="WhatsApp" subtitle="Campaigns, conversations and AI replies on WhatsApp" />
        <EmptyState icon={Smartphone} title="Connect your first WhatsApp number"
          description="Use the official Meta Cloud API for bulk campaigns, or link a WhatsApp Business app by QR for conversations."
          action={{ label: 'Connect a number', onClick: () => navigate('/whatsapp/accounts') }} />
      </div>
    );
  }

  const o = overview!;
  const funnel = [
    { label: 'Sent', value: o.sent },
    { label: 'Delivered', value: o.delivered },
    { label: 'Read', value: o.read },
    { label: 'Replied', value: o.conversations_with_replies },
  ];
  const usagePct = o.monthly_limit ? Math.min(1, o.usage_this_month / o.monthly_limit) : 0;

  return (
    <div>
      <WhatsAppTabs title="WhatsApp" subtitle="Everything sent and received on your WhatsApp numbers" actions={actions} />

      {o.needs_human > 0 && (
        <button onClick={() => navigate('/whatsapp/inbox?status=needs_human')}
          className="w-full mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300 text-left">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {o.needs_human} conversation{o.needs_human === 1 ? '' : 's'} need a person to reply. Open the inbox →
        </button>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={Send} label="Messages sent" value={num(o.sent)} hint={o.queued ? `${num(o.queued)} waiting in queue` : undefined} tone="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" delay={0} />
        <Kpi icon={CheckCheck} label="Delivered" value={pct(o.delivery_rate)} hint={`${num(o.delivered)} messages`} tone="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" delay={0.03} />
        <Kpi icon={Eye} label="Read" value={pct(o.read_rate)} hint={`${num(o.read)} messages`} tone="bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" delay={0.06} />
        <Kpi icon={MessageCircle} label="Messages received" value={num(o.received)} hint={`${num(o.conversations_with_replies)} people wrote in`} tone="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" delay={0.09} />
        <Kpi icon={Reply} label="Campaign reply rate" value={pct(o.campaign_reply_rate)} tone="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400" delay={0.12} />
        <Kpi icon={Bot} label="AI replies sent" value={num(o.ai_replies)} tone="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400" delay={0.15} />
        <Kpi icon={Inbox} label="Open conversations" value={num(o.open_conversations)} hint={o.unread_conversations ? `${o.unread_conversations} unread` : undefined} tone="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" delay={0.18} />
        <Kpi icon={UserX} label="Opted out" value={num(o.opted_out)} hint="replied STOP" tone="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" delay={0.21} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Sent vs received per day</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="sent" name="Sent" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="read" name="Read" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="received" name="Received" stroke="#0d9488" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" name="Failed" stroke="#dc2626" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">From sent to reply</h2>
          <div className="space-y-3">
            {funnel.map((f, i) => {
              const share = funnel[0].value ? f.value / funnel[0].value : 0;
              return (
                <div key={f.label}>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>{f.label}</span>
                    <span>{num(f.value)}{i > 0 && funnel[0].value ? ` · ${pct(share)}` : ''}</span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.max(share * 100, f.value ? 2 : 0)}%`, opacity: 1 - i * 0.18 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span>Plan usage this month</span>
              <span>{num(o.usage_this_month)} / {num(o.monthly_limit)}</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${usagePct > 0.9 ? 'bg-red-500' : usagePct > 0.7 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${usagePct * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 px-4 pt-4 pb-2">Number health</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sent today</th>
                <th className="px-4 py-2 font-medium">Queued</th>
                <th className="px-4 py-2 font-medium">Failure rate (7 days)</th>
              </tr>
            </thead>
            <tbody>
              {health.map((h) => {
                const used = h.daily_cap ? h.sent_today / h.daily_cap : 0;
                return (
                  <tr key={h.id} className="border-b last:border-0 border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{h.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">{formatPhone(h.phone_e164)} <ProviderBadge provider={h.provider} /></div>
                    </td>
                    <td className="px-4 py-3">
                      <AccountStatusBadge status={h.status} />
                      {h.last_error && h.status !== 'connected' && <div className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs">{h.last_error}</div>}
                    </td>
                    <td className="px-4 py-3 w-56">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>{num(h.sent_today)} / {num(h.daily_cap)}</span>
                        {h.warmup_day && <span>warm-up day {h.warmup_day}</span>}
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${used >= 1 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(used, 1) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{num(h.queued)}</td>
                    <td className={`px-4 py-3 ${h.failure_rate_7d > 0.1 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                      {h.sent_7d ? pct(h.failure_rate_7d) : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
