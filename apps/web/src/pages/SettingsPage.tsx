import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TestTube, Trash2, Settings, Shield, ShieldCheck, FileText, Key, Webhook, Eye, Edit, ListChecks, Download } from 'lucide-react';
import clsx from 'clsx';
import api from '../api/client';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { Spinner } from '../components/ui/Spinner';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';
import AddProviderModal from '../components/settings/AddProviderModal';
import EditProviderModal from '../components/settings/EditProviderModal';
import DomainAuthWizard from '../components/settings/DomainAuthWizard';
import AuditLogPanel from '../components/settings/AuditLogPanel';
import ApiKeysPanel from '../components/settings/ApiKeysPanel';
import OutgoingWebhooksPanel from '../components/settings/OutgoingWebhooksPanel';
import CustomFieldsPanel from '../components/settings/CustomFieldsPanel';
import { getConsentOverview, getRecentConsentChanges, exportConsent } from '../api/consent';

type SettingsTab = 'providers' | 'api-keys' | 'webhooks' | 'custom-fields' | 'consent' | 'audit';

const settingsTabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: 'providers', label: 'Providers', icon: Shield },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'custom-fields', label: 'Custom Fields', icon: ListChecks },
  { id: 'consent', label: 'Consent', icon: ShieldCheck },
  { id: 'audit', label: 'Audit Log', icon: FileText },
];

interface SendingConfig {
  id: string;
  name: string;
  provider: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

const providerGradients: Record<string, string> = {
  smtp: 'from-gray-500 to-gray-600',
  sendgrid: 'from-blue-500 to-blue-600',
  ses: 'from-amber-500 to-orange-500',
  mailgun: 'from-red-500 to-red-600',
  postmark: 'from-yellow-500 to-yellow-600',
};

export default function SettingsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');
  const [configs, setConfigs] = useState<SendingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SendingConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [domainAuthTarget, setDomainAuthTarget] = useState<SendingConfig | null>(null);
  const [viewTarget, setViewTarget] = useState<SendingConfig | null>(null);
  const [editTarget, setEditTarget] = useState<SendingConfig | null>(null);

  // Consent state
  const [consentOverview, setConsentOverview] = useState<{ total_contacts: number; with_consent: number; without_consent: number } | null>(null);
  const [recentChanges, setRecentChanges] = useState<Array<{ id: string; email: string; consent_type: string; status: string; source: string; updated_at: string }>>([]);
  const [loadingConsent, setLoadingConsent] = useState(false);
  const [exportingConsent, setExportingConsent] = useState(false);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sending-configs');
      setConfigs(data.data);
    } catch {
      addToast('Failed to load providers', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  const fetchConsentData = useCallback(async () => {
    setLoadingConsent(true);
    try {
      const [overviewRes, changesRes] = await Promise.all([
        getConsentOverview(),
        getRecentConsentChanges(),
      ]);
      setConsentOverview(overviewRes.data);
      setRecentChanges(changesRes.data);
    } catch {
      addToast('Failed to load consent data', 'error');
    } finally {
      setLoadingConsent(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (activeTab === 'consent') {
      fetchConsentData();
    }
  }, [activeTab, fetchConsentData]);

  const handleExportConsent = async () => {
    setExportingConsent(true);
    try {
      const { data } = await exportConsent();
      // Convert to CSV
      if (data.length === 0) {
        addToast('No consent records to export', 'info');
        return;
      }
      const headers = ['email', 'first_name', 'last_name', 'consent_type', 'status', 'source', 'ip_address', 'granted_at', 'revoked_at', 'created_at'];
      const csvRows = [headers.join(',')];
      for (const row of data) {
        csvRows.push(headers.map((h) => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`).join(','));
      }
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent_records_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Consent records exported', 'success');
    } catch {
      addToast('Failed to export consent records', 'error');
    } finally {
      setExportingConsent(false);
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResults((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      const { data } = await api.post(`/sending-configs/${id}/test`);
      setTestResults((prev) => ({ ...prev, [id]: data }));
      addToast(data.success ? 'Connection successful' : 'Connection failed', data.success ? 'success' : 'error');
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Test failed' } }));
      addToast('Test failed', 'error');
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/sending-configs/${deleteTarget.id}`);
      addToast('Provider deleted', 'success');
      setDeleteTarget(null);
      fetchConfigs();
    } catch {
      addToast('Failed to delete provider', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 dark:text-gray-100">Settings</h1>

      {/* Tabs */}
      <div className="border-b dark:border-gray-700 mb-6">
        <nav className="flex gap-6">
          {settingsTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="settings-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Providers Tab */}
      {activeTab === 'providers' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold dark:text-gray-100">Email Sending Providers</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure SMTP, SendGrid, Amazon SES, Mailgun, or Postmark</p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              <Plus className="h-4 w-4" /> Add Provider
            </button>
          </div>

          {loading ? <ListSkeleton count={3} /> : configs.length === 0 ? (
            <EmptyState icon={Settings} title="No providers configured" description="Add an email provider to start sending campaigns"
              action={{ label: 'Add Provider', onClick: () => setShowAdd(true) }} />
          ) : (
            <div className="space-y-4">
              {configs.map((config, i) => {
                const gradient = providerGradients[config.provider] || 'from-gray-500 to-gray-600';
                return (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className="border dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 bg-gradient-to-br ${gradient} rounded-lg`}>
                            <Shield className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium dark:text-gray-100">{config.name}</h3>
                              <Badge variant="neutral">{config.provider.toUpperCase()}</Badge>
                              {config.is_default && <Badge variant="info">Default</Badge>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Added {new Date(config.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewTarget(config)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                            title="View details">
                            <Eye className="h-4 w-4" /> View
                          </button>
                          <button onClick={() => setEditTarget(config)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                            title="Edit provider">
                            <Edit className="h-4 w-4" /> Edit
                          </button>
                          <button onClick={() => setDomainAuthTarget(config)}
                            className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                            title="Configure domain authentication">
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleTest(config.id)} disabled={testing === config.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 dark:text-gray-300"
                            title="Test connection">
                            {testing === config.id ? <Spinner size="sm" /> : <TestTube className="h-4 w-4" />}
                          </button>
                          <button onClick={() => setDeleteTarget(config)}
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete provider">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <AnimatePresence>
                        {testResults[config.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className={`mt-3 p-2.5 rounded-lg text-sm ${testResults[config.id].success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                              {testResults[config.id].message}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <ApiKeysPanel />
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <OutgoingWebhooksPanel />
        </div>
      )}

      {/* Custom Fields Tab */}
      {activeTab === 'custom-fields' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <CustomFieldsPanel />
        </div>
      )}

      {/* Consent Tab */}
      {activeTab === 'consent' && (
        <div className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {loadingConsent ? '-' : consentOverview?.total_contacts ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total Contacts</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-green-600">
                {loadingConsent ? '-' : consentOverview?.with_consent ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">With Email Marketing Consent</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-amber-600">
                {loadingConsent ? '-' : consentOverview?.without_consent ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Without Consent</p>
            </div>
          </div>

          {/* Export + Recent Changes */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold dark:text-gray-100">GDPR Consent Audit</h2>
              <button
                onClick={handleExportConsent}
                disabled={exportingConsent}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {exportingConsent ? 'Exporting...' : 'Export Consent Records'}
              </button>
            </div>

            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Consent Changes</h3>
            {loadingConsent ? (
              <ListSkeleton count={5} />
            ) : recentChanges.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No consent changes recorded yet</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {recentChanges.map((change) => (
                    <tr key={change.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{change.email}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {change.consent_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={change.status === 'granted' ? 'success' : 'danger'}>
                          {change.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{change.source}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(change.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && <AuditLogPanel />}

      <AddProviderModal isOpen={showAdd} onClose={() => setShowAdd(false)} onSaved={fetchConfigs} />

      <EditProviderModal
        isOpen={!!viewTarget}
        onClose={() => setViewTarget(null)}
        onSaved={fetchConfigs}
        config={viewTarget}
        viewOnly={true}
      />

      <EditProviderModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={fetchConfigs}
        config={editTarget}
        viewOnly={false}
      />

      {domainAuthTarget && (
        <DomainAuthWizard
          isOpen={!!domainAuthTarget}
          onClose={() => setDomainAuthTarget(null)}
          configId={domainAuthTarget.id}
          configName={domainAuthTarget.name}
        />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Provider" message={`Are you sure you want to delete "${deleteTarget?.name}"? Campaigns using this provider will need to be reconfigured.`}
        confirmLabel="Delete" variant="danger" loading={deleting} />
    </div>
  );
}
