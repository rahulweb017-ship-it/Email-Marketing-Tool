import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Send, MessageCircle, Share2, Target, Workflow, Rocket, UserPlus, PenSquare,
  Sun, CloudSun, Sunset, Moon, AlertTriangle, RefreshCw,
} from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../stores/auth.store';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import KpiCards, { type Kpi } from '../components/dashboard/KpiCards';
import ActivityChart from '../components/dashboard/ActivityChart';
import RecentFeed from '../components/dashboard/RecentFeed';
import { ChannelMix, EmailFunnel, EngagementPanel, LeadsPanel, SocialPanel, WhatsAppFunnel } from '../components/dashboard/ChannelPanels';
import { num, pct, type EngagementDist, type HubData } from '../components/dashboard/types';

const PERIODS = [7, 30, 90] as const;

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return { greeting: 'Good morning', icon: Sun };
  if (h < 17) return { greeting: 'Good afternoon', icon: CloudSun };
  if (h < 21) return { greeting: 'Good evening', icon: Sunset };
  return { greeting: 'Good night', icon: Moon };
}

function buildKpis(hub: HubData): Kpi[] {
  const { contacts, email, whatsapp, social, leads, automations } = hub;
  return [
    {
      title: 'Contacts', hint: 'Everyone in your audience', value: num(contacts?.total),
      secondary: `+${num(contacts?.new_in_period).toLocaleString()} new this period`,
      icon: Users, iconClass: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200', to: '/contacts',
    },
    {
      title: 'Emails sent', hint: 'Campaign emails that left your account', value: num(email?.sent),
      secondary: `${pct(email?.opened, email?.sent)}% opened at least once`,
      icon: Send, iconClass: 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300', to: '/campaigns',
    },
    {
      title: 'WhatsApp messages', hint: 'Messages sent to contacts on WhatsApp', value: num(whatsapp?.sent),
      secondary: `${pct(whatsapp?.read, whatsapp?.sent)}% read, ${num(whatsapp?.inbound).toLocaleString()} replies`,
      icon: MessageCircle, iconClass: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300', to: '/whatsapp',
    },
    {
      title: 'Social posts', hint: 'Posts published to your social accounts', value: num(social?.published),
      secondary: `${num(social?.scheduled).toLocaleString()} scheduled`,
      icon: Share2, iconClass: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300', to: '/social',
    },
    {
      title: 'New leads', hint: 'People who showed interest in buying', value: num(leads?.new),
      secondary: `${num(leads?.hot).toLocaleString()} hot, ready to contact`,
      icon: Target, iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300', to: '/leads',
    },
    {
      title: 'Active automations', hint: 'Workflows running on autopilot', value: num(automations?.active),
      secondary: `${num(automations?.contacts_in_progress).toLocaleString()} contacts in progress`,
      icon: Workflow, iconClass: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300', to: '/automations',
    },
  ];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [days, setDays] = useState<number>(30);
  const [hub, setHub] = useState<HubData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementDist | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get(`/analytics/hub?days=${days}`)
      .then(({ data }) => setHub(data && typeof data === 'object' ? data : {}))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/contacts/engagement-distribution').then(({ data }) => setEngagement(data ?? null)).catch(() => {});
  }, []);

  if (!hub && loading) return <DashboardSkeleton />;

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const { greeting, icon: TimeIcon } = getTimeOfDay();
  const quickActions = [
    { label: 'New campaign', icon: Rocket, path: '/campaigns' },
    { label: 'Add contacts', icon: UserPlus, path: '/contacts' },
    { label: 'WhatsApp campaign', icon: MessageCircle, path: '/whatsapp/campaigns' },
    { label: 'New post', icon: PenSquare, path: '/social/compose' },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-5 text-white"
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><TimeIcon className="h-5 w-5" />{greeting}, {firstName}</h1>
            <p className="text-primary-100 text-sm mt-0.5">Everything happening across email, WhatsApp, social and leads</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-white/15 p-0.5" role="group" aria-label="Period">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setDays(p)}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${days === p ? 'bg-white text-primary-700' : 'text-white hover:bg-white/10'}`}
                >
                  {p} days
                </button>
              ))}
            </div>
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors"
              >
                <a.icon className="h-4 w-4" />{a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
      </motion.div>

      {error ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-primary-600 mx-auto" />
          <p className="mt-3 font-medium text-gray-900 dark:text-gray-100">We couldn't load your dashboard</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Check your connection and try again.</p>
          <button onClick={load} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium">
            <RefreshCw className="h-4 w-4" />Retry
          </button>
        </div>
      ) : hub && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <KpiCards items={buildKpis(hub)} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ActivityChart daily={hub.daily ?? []} />
            <ChannelMix mix={hub.channel_mix} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <EmailFunnel email={hub.email} transactional={hub.transactional} />
            <WhatsAppFunnel whatsapp={hub.whatsapp} />
            <SocialPanel social={hub.social} />
            <LeadsPanel leads={hub.leads} />
            <EngagementPanel dist={engagement} />
            <RecentFeed items={hub.recent ?? []} />
          </div>
        </div>
      )}
    </div>
  );
}
