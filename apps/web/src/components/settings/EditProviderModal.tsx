import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { TextInput, CheckboxInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { Eye, EyeOff } from 'lucide-react';
import api from '../../api/client';

interface SendingConfig {
  id: string;
  name: string;
  provider: string;
  is_default: boolean;
  is_active: boolean;
  settings?: Record<string, any>;
}

interface EditProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  config: SendingConfig | null;
  viewOnly?: boolean;
}

export default function EditProviderModal({ isOpen, onClose, onSaved, config, viewOnly = false }: EditProviderModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config) {
      setName(config.name);
      setIsDefault(config.is_default);
      setSettings(config.settings || {});
      setShowPassword({});
    }
  }, [config]);

  const handleClose = () => {
    setName('');
    setIsDefault(false);
    setSettings({});
    setShowPassword({});
    onClose();
  };

  const handleSave = async () => {
    if (!config) return;

    setLoading(true);
    try {
      await api.patch(`/sending-configs/${config.id}`, {
        name,
        is_default: isDefault,
      });
      addToast('Provider updated successfully', 'success');
      handleClose();
      onSaved();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to update provider', 'error');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const renderSettingValue = (key: string, value: any) => {
    const isPassword = key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('key');

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (isPassword && !showPassword[key]) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">••••••••</span>
          <button
            type="button"
            onClick={() => togglePasswordVisibility(key)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Eye className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      );
    }

    if (isPassword && showPassword[key]) {
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{value}</span>
          <button
            type="button"
            onClick={() => togglePasswordVisibility(key)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <EyeOff className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      );
    }

    return <span className="font-mono text-sm">{String(value)}</span>;
  };

  if (!config) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={viewOnly ? `${config.name} - Details` : `Edit ${config.name}`}
      footer={
        viewOnly ? (
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <ButtonSpinner />}
              Save Changes
            </button>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {viewOnly ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider Type</label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span className="font-medium uppercase">{config.provider}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <span>{config.name}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  {config.is_default && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">Default</span>}
                  {config.is_active && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">Active</span>}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Configuration</label>
              <div className="border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key} className="px-3 py-2.5 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{key}</span>
                    <div className="text-gray-900 dark:text-gray-100">{renderSettingValue(key, value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <TextInput
              label="Display Name"
              name="name"
              value={name}
              onChange={setName}
              required
              placeholder="e.g. My Gmail SMTP"
            />

            <CheckboxInput
              label="Set as default provider"
              checked={isDefault}
              onChange={setIsDefault}
              description="New campaigns will use this provider by default"
            />

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> Provider credentials cannot be edited here for security reasons.
                To change settings, please delete this provider and add a new one.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
