import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Send, Eye, MousePointerClick, FileText, UserPlus,
  TrendingUp, TrendingDown, AlertTriangle, Rocket,
  Sun, CloudSun, Sunset, Moon, Flame,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../api/client';
import { useAuthStore } from '../stores/auth.store';
import { useCountUp } from '../hooks/useCountUp';
import Sparkline from '../components/ui/Sparkline';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import { AnimatedCard, StaggerContainer, cardVariants } from '../components/ui/AnimatedComponents';

interface OverviewStats {
  contacts: number;
  mailing_lists: number;
  campaigns_total: number;
  campaigns_sent: number;
  total_emails_sent: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  avg_open_rate: string;
  avg_click_rate: string;
}

interface CampaignStats {
  id: string;
  name: string;
  sent_date: string;
  stat_sent: number;
  stat_opened: number;
  stat_clicked: number;
}

interface ActivityItem {
  id: string;
  event_type: 'sent' | 'opened' | 'clicked' | 'bounced';
  email: string;
  campaign_name: string;
  timestamp: string;
}

interface Trends {
  contacts: number[];
  emails_sent: number[];
  opens: number[];
  clicks: number[];
}

function StatCard({ label, value, icon: Icon, gradient, sparkData, sparkColor, index }: {
  label: string; value: number; icon: typeof Users; gradient: string;
  sparkData: number[]; sparkColor: string; index: number;
}) {
  const animated = useCountUp(value);

  return (
    <AnimatedCard index={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1 tracking-tight dark:text-gray-100">{animated.toLocaleString()}</p>
        </div>
        <div className={`p-2.5 rounded-lg bg-gradient-to-br ${gradient}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {sparkData.length >= 2 && (
        <div className="mt-2">
          <Sparkline data={sparkData} color={sparkColor} width={200} height={32} />
        </div>
      )}
    </AnimatedCard>
  );
}

const activityIcons = {
  sent: { icon: Send, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  opened: { icon: Eye, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
  clicked: { icon: MousePointerClick, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  bounced: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
};

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return { greeting: 'Good morning', icon: Sun, gradient: 'from-amber-700 via-orange-700 to-yellow-700' };
  if (h < 17) return { greeting: 'Good afternoon', icon: CloudSun, gradient: 'from-slate-600 via-blue-700 to-indigo-700' };
  if (h < 21) return { greeting: 'Good evening', icon: Sunset, gradient: 'from-stone-700 via-rose-800 to-purple-900' };
  return { greeting: 'Good night', icon: Moon, gradient: 'from-slate-800 via-indigo-900 to-zinc-900' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-3 text-sm">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }) => (
        <div key={entry.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600 dark:text-gray-400">{entry.name}: <strong>{entry.value.toLocaleString()}</strong></span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [trends, setTrends] = useState<Trends>({ contacts: [], emails_sent: [], opens: [], clicks: [] });
  const [engagementDist, setEngagementDist] = useState<{ cold: number; warm: number; hot: number; very_hot: number } | null>(null);

  useEffect(() => {
    api.get('/analytics/overview').then(({ data }) => setStats(data));
    api.get('/analytics/campaigns?days=30').then(({ data }) => setCampaigns(data.data));
    api.get('/analytics/activity').then(({ data }) => setActivities(data.data)).catch(() => {});
    api.get('/analytics/trends').then(({ data }) => setTrends(data)).catch(() => {});
    api.get('/contacts/engagement-distribution').then(({ data }) => setEngagementDist(data)).catch(() => {});
  }, []);

  if (!stats) return <DashboardSkeleton />;

  const statCards = [
    { label: 'Total Contacts', value: stats.contacts, icon: Users, gradient: 'from-blue-500 to-blue-600', sparkData: trends.contacts, sparkColor: '#3b82f6' },
    { label: 'Emails Sent', value: stats.total_emails_sent, icon: Send, gradient: 'from-green-500 to-emerald-600', sparkData: trends.emails_sent, sparkColor: '#10b981' },
    { label: 'Total Opens', value: stats.total_opened, icon: Eye, gradient: 'from-amber-500 to-orange-500', sparkData: trends.opens, sparkColor: '#f59e0b' },
    { label: 'Total Clicks', value: stats.total_clicked, icon: MousePointerClick, gradient: 'from-purple-500 to-violet-600', sparkData: trends.clicks, sparkColor: '#8b5cf6' },
  ];

  const quickActions = [
    { label: 'New Campaign', desc: 'Create & send emails', icon: Rocket, path: '/campaigns', gradient: 'from-primary-500 to-primary-600' },
    { label: 'New Template', desc: 'Design email templates', icon: FileText, path: '/templates', gradient: 'from-emerald-500 to-green-600' },
    { label: 'Add Contact', desc: 'Grow your audience', icon: UserPlus, path: '/contacts', gradient: 'from-amber-500 to-orange-500' },
  ];

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const { greeting, icon: TimeIcon, gradient: bannerGradient } = getTimeOfDay();

  return (
    <div className="space-y-6">
      {/* Welcome Banner + Quick Actions -- merged into one row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${bannerGradient} px-6 py-4 text-white flex items-center justify-between`}
      >
        <div className="relative z-10">
          <h1 className="text-lg font-bold flex items-center gap-2"><TimeIcon className="h-5 w-5" />{greeting}, {firstName}!</h1>
          <p className="text-primary-100 text-sm">Here's what's happening with your campaigns</p>
        </div>
        <div className="relative z-10 flex gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-2 px-3 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-lg text-sm font-medium transition-colors"
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
        </div>
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10" />
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      {/* Chart + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AnimatedCard index={0} hover={false} className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold mb-4 dark:text-gray-100">Campaign Performance</h2>
          {campaigns.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-10 text-sm">No campaigns sent yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={campaigns.slice(0, 10)}>
                <defs>
                  <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradClicked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:opacity-20" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="stat_sent" stroke="#6366f1" fill="url(#gradSent)" strokeWidth={2} name="Sent" />
                <Area type="monotone" dataKey="stat_opened" stroke="#f59e0b" fill="url(#gradOpened)" strokeWidth={2} name="Opened" />
                <Area type="monotone" dataKey="stat_clicked" stroke="#10b981" fill="url(#gradClicked)" strokeWidth={2} name="Clicked" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </AnimatedCard>

        <AnimatedCard index={1} hover={false} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold mb-4 dark:text-gray-100">Recent Activity</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">No activity yet</p>
          ) : (
            <StaggerContainer className="space-y-1 max-h-[280px] overflow-y-auto">
              {activities.slice(0, 12).map((item, i) => {
                const cfg = activityIcons[item.event_type] || activityIcons.sent;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={item.id}
                    variants={cardVariants}
                    custom={i}
                    className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className={`p-1.5 rounded-md ${cfg.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate font-medium">{item.email}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.campaign_name}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                      {item.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : '\u2014'}
                    </span>
                  </motion.div>
                );
              })}
            </StaggerContainer>
          )}
        </AnimatedCard>
      </div>

      {/* Bottom Stats + Engagement Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {[
          { label: 'Campaigns Sent', value: stats.campaigns_sent, icon: TrendingUp, color: 'text-primary-600 dark:text-primary-400' },
          { label: 'Bounced', value: stats.total_bounced, icon: TrendingDown, color: 'text-red-500 dark:text-red-400' },
          { label: 'Unsubscribes', value: stats.total_unsubscribed, icon: AlertTriangle, color: 'text-amber-500 dark:text-amber-400' },
        ].map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-5 py-4 flex items-center gap-4"
            >
              <Icon className={`h-5 w-5 ${item.color}`} />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.label}</p>
                <p className="text-xl font-bold dark:text-gray-100">{item.value.toLocaleString()}</p>
              </div>
            </motion.div>
          );
        })}

        {/* Engagement Distribution Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm px-5 py-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-orange-500" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Engagement Distribution</p>
          </div>
          {engagementDist ? (
            <div className="space-y-2">
              {[
                { label: 'Cold (0-20)', value: engagementDist.cold, color: 'bg-gray-400' },
                { label: 'Warm (21-50)', value: engagementDist.warm, color: 'bg-yellow-400' },
                { label: 'Hot (51-80)', value: engagementDist.hot, color: 'bg-green-500' },
                { label: 'Very Hot (81+)', value: engagementDist.very_hot, color: 'bg-emerald-500' },
              ].map((tier) => {
                const total = engagementDist.cold + engagementDist.warm + engagementDist.hot + engagementDist.very_hot;
                const pct = total > 0 ? (tier.value / total) * 100 : 0;
                return (
                  <div key={tier.label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-24 shrink-0">{tier.label}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${tier.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{tier.value}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
