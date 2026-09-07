import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Database, UserCheck, Trash2, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { getTenant, updateTenant, updateTenantStatus, getTenantUsers, getTenantUsage, impersonateTenant, listPlans, resetUserPassword, updateUserStatus, deleteTenant } from '../../api/super-admin';
import { useAuthStore } from '../../stores/auth.store';
import { useToastStore } from '../../stores/toast.store';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startImpersonation } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [tenant, setTenant] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usage, setUsage] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'usage' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Limits override state
  const [limitsOverride, setLimitsOverride] = useState<Record<string, number | null>>({});
  const [savingLimits, setSavingLimits] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getTenant(id).then(({ data }) => {
        setTenant(data);
        setLimitsOverride(data.limits_override || {});
      }),
      getTenantUsers(id).then(({ data }) => setUsers(data.data)),
      getTenantUsage(id).then(({ data }) => setUsage(data.data)),
      listPlans().then(({ data }) => setPlans(data.data)),
    ])
      .catch(() => addToast('Failed to load tenant details', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusToggle = async () => {
    if (!tenant) return;
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      const { data } = await updateTenantStatus(tenant.id, { status: newStatus, reason: newStatus === 'suspended' ? 'Suspended by admin' : undefined });
      setTenant(data);
      addToast(`Tenant ${newStatus}`, 'success');
    } catch {
      addToast('Failed to update status', 'error');
    }
  };

  const handleImpersonate = async () => {
    if (!id) return;
    try {
      const { data } = await impersonateTenant(id);
      startImpersonation(
        { access_token: data.access_token, refresh_token: data.refresh_token },
        data.user,
      );
      navigate('/');
    } catch {
      addToast('Failed to impersonate tenant', 'error');
    }
  };

  const handlePlanChange = async (planId: string) => {
    if (!id) return;
    try {
      const { data } = await updateTenant(id, { plan_id: planId });
      setTenant(data);
      addToast('Plan updated', 'success');
    } catch {
      addToast('Failed to update plan', 'error');
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!id) return;
    try {
      const { data } = await resetUserPassword(id, userId);
      setTempPassword(data.temp_password);
      addToast('Password reset successfully', 'success');
    } catch {
      addToast('Failed to reset password', 'error');
    }
  };

  const handleUserStatusToggle = async (userId: string, currentActive: boolean) => {
    if (!id) return;
    try {
      const { data } = await updateUserStatus(id, userId, !currentActive);
      setUsers(users.map((u) => u.id === userId ? data : u));
      addToast(`User ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
    } catch {
      addToast('Failed to update user status', 'error');
    }
  };

  const handleSaveLimits = async () => {
    if (!id) return;
    setSavingLimits(true);
    try {
      // Filter out empty overrides
      const filtered: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(limitsOverride)) {
        if (v !== null && v !== undefined && String(v) !== '') {
          filtered[k] = v;
        }
      }
      const { data } = await updateTenant(id, { limits_override: Object.keys(filtered).length > 0 ? filtered : {} });
      setTenant(data);
      addToast('Limits override saved', 'success');
    } catch {
      addToast('Failed to save limits', 'error');
    } finally {
      setSavingLimits(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!id || !tenant) return;
    if (!confirm(`Are you sure you want to permanently delete "${tenant.name}"? This cannot be undone.`)) return;
    try {
      await deleteTenant(id);
      addToast('Tenant deleted', 'success');
      navigate('/super-admin/tenants');
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to delete tenant', 'error');
    }
  };

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!tenant) return <div className="text-gray-500">Tenant not found</div>;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'users', label: `Users (${users.length})` },
    { key: 'usage', label: 'Usage History' },
    { key: 'settings', label: 'Settings' },
  ] as const;

  const limitFields = [
    { key: 'max_contacts', label: 'Max Contacts', planValue: tenant.plan_max_contacts },
    { key: 'max_emails_per_month', label: 'Max Emails/Month', planValue: tenant.plan_max_emails_per_month },
    { key: 'max_users', label: 'Max Users', planValue: tenant.plan_max_users },
  ];

  return (
    <div>
      <button onClick={() => navigate('/super-admin/tenants')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Tenants
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tenant.name}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
            tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {tenant.status}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleImpersonate} className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" /> Impersonate
          </button>
          <button onClick={handleStatusToggle} className={`px-3 py-2 text-sm rounded-lg ${
            tenant.status === 'active' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
          }`}>
            {tenant.status === 'active' ? 'Suspend' : 'Activate'}
          </button>
          <button onClick={handleDeleteTenant} className="px-3 py-2 text-sm bg-red-800 hover:bg-red-900 text-white rounded-lg flex items-center gap-1.5">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-red-500 text-red-600 dark:text-red-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Database} label="Contacts" value={tenant.usage?.contacts_stored || 0} limit={tenant.plan_max_contacts} />
          <StatCard icon={Mail} label="Emails This Month" value={tenant.usage?.emails_sent || 0} limit={tenant.plan_max_emails_per_month} />
          <StatCard icon={Users} label="Users" value={tenant.usage?.active_users || 0} limit={tenant.plan_max_users} />
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Plan</span>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-1">{tenant.plan_name || 'None'}</div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-4 py-3"><span className="capitalize text-gray-600 dark:text-gray-300">{u.role}</span></td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleResetPassword(u.id)}
                        className="p-1.5 text-gray-400 hover:text-blue-600"
                        title="Reset Password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleUserStatusToggle(u.id, u.is_active)}
                        className={`p-1.5 ${u.is_active ? 'text-gray-400 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {u.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'usage' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Period</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Emails Sent</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Contacts</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Campaigns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {usage.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No usage data</td></tr>
              ) : usage.map((u: any) => (
                <tr key={u.period}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{u.period}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{u.emails_sent?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{u.contacts_stored?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{u.campaigns_created}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-6 max-w-lg">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Plan Assignment</h3>
            <select
              value={tenant.plan_id || ''}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">No Plan</option>
              {plans.map((p: any) => (
                <option key={p.id} value={p.id}>{p.display_name} - {p.max_contacts} contacts, {p.max_emails_per_month} emails/mo</option>
              ))}
            </select>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Limits Override</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Override plan defaults for this tenant. Leave empty to use plan defaults.</p>
            <div className="space-y-3">
              {limitFields.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="text-sm text-gray-700 dark:text-gray-300 w-40">{field.label}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder={field.planValue != null ? `Plan: ${field.planValue}` : 'No limit'}
                    value={limitsOverride[field.key] ?? ''}
                    onChange={(e) => setLimitsOverride({ ...limitsOverride, [field.key]: e.target.value === '' ? null : parseInt(e.target.value) || 0 })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  {limitsOverride[field.key] != null && (
                    <button
                      onClick={() => { const next = { ...limitsOverride }; delete next[field.key]; setLimitsOverride(next); }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Clear
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveLimits}
              disabled={savingLimits}
              className="mt-4 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
            >
              {savingLimits ? 'Saving...' : 'Save Limits'}
            </button>
          </div>
        </div>
      )}

      {/* Temp Password Modal */}
      {tempPassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Password Reset</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">New temporary password:</p>
            <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-lg font-mono text-sm text-gray-900 dark:text-white select-all break-all">
              {tempPassword}
            </div>
            <p className="text-xs text-gray-400 mt-2">Make sure to copy this password. It won't be shown again.</p>
            <button
              onClick={() => setTempPassword(null)}
              className="mt-4 w-full px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, limit }: { icon: any; label: string; value: number; limit?: number }) {
  const pct = limit ? Math.min(100, (value / limit) * 100) : 0;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">
        {value.toLocaleString()}
        {limit && <span className="text-sm font-normal text-gray-400"> / {limit.toLocaleString()}</span>}
      </div>
      {limit && (
        <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
