import { useState, useEffect } from 'react';
import { Building2, Users, Mail, AlertTriangle } from 'lucide-react';
import { getDashboard } from '../../api/super-admin';
import { useToastStore } from '../../stores/toast.store';

interface DashboardStats {
  total_organizations: number;
  total_users: number;
  active_organizations: number;
  suspended_organizations: number;
  emails_sent_this_month: number;
  organizations_by_plan: { plan: string; count: number }[];
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    getDashboard()
      .then(({ data }) => setStats(data))
      .catch(() => addToast('Failed to load dashboard', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading dashboard...</div>;
  }

  if (!stats) return null;

  const cards = [
    { label: 'Total Organizations', value: stats.total_organizations, icon: Building2, color: 'text-blue-500' },
    { label: 'Active Organizations', value: stats.active_organizations, icon: Building2, color: 'text-green-500' },
    { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-indigo-500' },
    { label: 'Emails Sent (This Month)', value: stats.emails_sent_this_month.toLocaleString(), icon: Mail, color: 'text-purple-500' },
    { label: 'Suspended', value: stats.suspended_organizations, icon: AlertTriangle, color: 'text-red-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Super Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <Icon className={`h-5 w-5 ${card.color}`} />
                <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Organizations by Plan</h2>
        <div className="space-y-3">
          {stats.organizations_by_plan.map((item) => (
            <div key={item.plan} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">{item.plan}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (item.count / Math.max(stats.total_organizations, 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">{item.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
