import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Key, Copy, Check, Trash2, AlertTriangle, Shield } from 'lucide-react';
import api from '../../api/client';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { TextInput } from '../ui/FormField';
import { Spinner, ButtonSpinner } from '../ui/Spinner';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import { useToastStore } from '../../stores/toast.store';
import clsx from 'clsx';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  expires_at: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

const AVAILABLE_SCOPES = [
  { value: 'contacts:read', label: 'Contacts: Read', group: 'Contacts' },
  { value: 'contacts:write', label: 'Contacts: Write', group: 'Contacts' },
  { value: 'campaigns:read', label: 'Campaigns: Read', group: 'Campaigns' },
  { value: 'campaigns:write', label: 'Campaigns: Write', group: 'Campaigns' },
  { value: 'lists:read', label: 'Lists: Read', group: 'Lists' },
  { value: 'lists:write', label: 'Lists: Write', group: 'Lists' },
  { value: 'analytics:read', label: 'Analytics: Read', group: 'Analytics' },
];

export default function ApiKeysPanel() {
  const addToast = useToastStore((s) => s.addToast);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // New key form
  const [newName, setNewName] = useState('');
  const [newScopes, setNewScopes] = useState<string[]>([]);
  const [newExpiresDays, setNewExpiresDays] = useState('');

  // Newly created key (shown once)
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api-keys');
      setKeys(data.data);
    } catch {
      addToast('Failed to load API keys', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const toggleScope = (scope: string) => {
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async () => {
    if (!newName) {
      addToast('Name is required', 'warning');
      return;
    }
    if (newScopes.length === 0) {
      addToast('Select at least one scope', 'warning');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        name: newName,
        scopes: newScopes,
      };
      if (newExpiresDays) {
        payload.expires_in_days = Number(newExpiresDays);
      }

      const { data } = await api.post('/api-keys', payload);
      setCreatedKey(data.key);
      setNewName('');
      setNewScopes([]);
      setNewExpiresDays('');
      fetchKeys();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create API key';
      addToast(msg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await api.delete(`/api-keys/${revokeTarget.id}`);
      addToast('API key revoked', 'success');
      setRevokeTarget(null);
      fetchKeys();
    } catch {
      addToast('Failed to revoke API key', 'error');
    } finally {
      setRevoking(false);
    }
  };

  const copyKey = async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCreatedKey(null);
    setCopied(false);
    setNewName('');
    setNewScopes([]);
    setNewExpiresDays('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-gray-500 mt-1">Manage API keys for programmatic access</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="h-4 w-4" /> Create Key
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={Key}
          title="No API keys"
          description="Create an API key for programmatic access to your data"
          action={{ label: 'Create Key', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="space-y-3">
          {keys.map((key, i) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
              className={clsx('border rounded-lg p-4', !key.is_active && 'opacity-60')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Key className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{key.name}</h3>
                      {!key.is_active && <Badge variant="danger">Revoked</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <code className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded font-mono">
                        {key.key_prefix}
                      </code>
                      <span className="text-xs text-gray-400">
                        Created {new Date(key.created_at).toLocaleDateString()}
                      </span>
                      {key.last_used_at && (
                        <span className="text-xs text-gray-400">
                          Last used {new Date(key.last_used_at).toLocaleDateString()}
                        </span>
                      )}
                      {key.expires_at && (
                        <span className={clsx('text-xs', new Date(key.expires_at) < new Date() ? 'text-red-500' : 'text-gray-400')}>
                          {new Date(key.expires_at) < new Date() ? 'Expired' : `Expires ${new Date(key.expires_at).toLocaleDateString()}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-wrap max-w-[200px] justify-end">
                    {key.scopes.map((scope) => (
                      <span key={scope} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
                        {scope}
                      </span>
                    ))}
                  </div>
                  {key.is_active && (
                    <button onClick={() => setRevokeTarget(key)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create API Key Modal */}
      <Modal
        isOpen={showCreate}
        onClose={closeCreateModal}
        title={createdKey ? 'API Key Created' : 'Create API Key'}
        size="md"
        footer={!createdKey ? (
          <div className="flex justify-end gap-3">
            <button onClick={closeCreateModal}
              className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              {creating && <ButtonSpinner />} Create Key
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button onClick={closeCreateModal}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              Done
            </button>
          </div>
        )}
      >
        {createdKey ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Save this key now</p>
                <p className="text-xs text-amber-700 mt-1">
                  This is the only time the full API key will be shown. Copy it and store it securely.
                </p>
              </div>
            </div>

            <div className="relative">
              <code className="block w-full p-3 bg-gray-900 text-green-400 rounded-lg text-sm font-mono break-all">
                {createdKey}
              </code>
              <button onClick={copyKey}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors">
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Check className="h-4 w-4 text-green-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <Copy className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <TextInput
              label="Key Name"
              name="name"
              value={newName}
              onChange={setNewName}
              required
              placeholder="e.g. Production API Key"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Scopes <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-center gap-3 p-1.5 rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newScopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-sm">{scope.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <TextInput
              label="Expires In (days, optional)"
              name="expires_in_days"
              value={newExpiresDays}
              onChange={setNewExpiresDays}
              placeholder="e.g. 90 (leave empty for no expiration)"
              type="number"
            />
          </div>
        )}
      </Modal>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke API Key"
        message={`Are you sure you want to revoke "${revokeTarget?.name}"? This action cannot be undone and any systems using this key will lose access.`}
        confirmLabel="Revoke"
        variant="danger"
        loading={revoking}
      />
    </div>
  );
}
