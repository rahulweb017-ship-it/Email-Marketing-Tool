import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import api from '../api/client';
import { useToastStore } from '../stores/toast.store';
import PlatformIcon from '../components/social/PlatformIcon';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { CardGridSkeleton } from '../components/ui/Skeleton';

interface SocialAccount {
  id: string;
  platform: string;
  platform_account_id: string;
  account_name: string;
  account_avatar_url?: string;
  account_type?: string;
  is_active: boolean;
  last_error?: string;
  last_verified_at?: string;
  token_expires_at?: string;
  created_at: string;
}

const PLATFORMS = [
  { id: 'twitter', name: 'Twitter / X', description: 'Post tweets to your timeline' },
  { id: 'facebook', name: 'Facebook', description: 'Publish to your Facebook Page' },
  { id: 'instagram', name: 'Instagram', description: 'Share photos to your Business account' },
  { id: 'linkedin', name: 'LinkedIn', description: 'Post to your LinkedIn profile' },
];

export default function SocialAccountsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToast = useToastStore((s) => s.addToast);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/social/accounts');
      setAccounts(data.data);
    } catch {
      addToast('Failed to load accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Handle OAuth callback results
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      const platform = searchParams.get('platform') || '';
      const reconnected = searchParams.get('reconnected') === 'true';
      addToast(reconnected ? `${platform} account reconnected` : `${platform} account connected successfully`, 'success');
      fetchAccounts();
    }
    if (searchParams.get('error')) {
      addToast(searchParams.get('message') || 'Failed to connect account', 'error');
    }
  }, [searchParams]);

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    try {
      const { data } = await api.post('/social/accounts/connect', { platform });
      // Redirect to OAuth URL
      window.location.href = data.auth_url;
    } catch {
      addToast('Failed to initiate connection', 'error');
      setConnecting(null);
    }
  };

  const handleVerify = async (account: SocialAccount) => {
    setVerifying(account.id);
    try {
      const { data } = await api.post(`/social/accounts/${account.id}/verify`);
      addToast(data.is_active ? 'Account verified successfully' : 'Account token is invalid', data.is_active ? 'success' : 'warning');
      fetchAccounts();
    } catch {
      addToast('Verification failed', 'error');
    } finally {
      setVerifying(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/social/accounts/${deleteTarget.id}`);
      addToast('Account disconnected', 'success');
      setDeleteTarget(null);
      fetchAccounts();
    } catch {
      addToast('Failed to disconnect account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/social')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Social Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Connect and manage your social media accounts</p>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Plus className="h-4 w-4" /> Connect Account
        </button>
      </div>

      {loading ? <CardGridSkeleton /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account, i) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {account.account_avatar_url ? (
                    <img src={account.account_avatar_url} alt="" className="w-12 h-12 rounded-full" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <PlatformIcon platform={account.platform} size={24} />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{account.account_name}</p>
                    <PlatformIcon platform={account.platform} size={14} showLabel />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {account.is_active ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>

              {account.last_error && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-xs text-red-600 dark:text-red-400">{account.last_error}</p>
                </div>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                <p>Type: {account.account_type || 'personal'}</p>
                <p>Connected: {new Date(account.created_at).toLocaleDateString()}</p>
                {account.last_verified_at && (
                  <p>Last verified: {new Date(account.last_verified_at).toLocaleDateString()}</p>
                )}
                {account.token_expires_at && (
                  <p>Token expires: {new Date(account.token_expires_at).toLocaleDateString()}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleVerify(account)}
                  disabled={verifying === account.id}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifying === account.id ? 'animate-spin' : ''}`} />
                  Verify
                </button>
                <button
                  onClick={() => setDeleteTarget(account)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Disconnect
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Connect Account Modal */}
      <AnimatePresence>
        {showConnect && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowConnect(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Connect Social Account</h2>
              <div className="space-y-3">
                {PLATFORMS.map(platform => {
                  const connected = accounts.some(a => a.platform === platform.id);
                  return (
                    <button
                      key={platform.id}
                      onClick={() => handleConnect(platform.id)}
                      disabled={connecting !== null}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-750 transition-all text-left"
                    >
                      <PlatformIcon platform={platform.id} size={28} />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{platform.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{platform.description}</p>
                      </div>
                      {connected && (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
                      )}
                      {connecting === platform.id && (
                        <RefreshCw className="h-4 w-4 animate-spin text-primary-600" />
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowConnect(false)}
                className="mt-4 w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Disconnect Account?"
        message={`Are you sure you want to disconnect ${deleteTarget?.account_name}? Any scheduled posts targeting this account will fail.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
