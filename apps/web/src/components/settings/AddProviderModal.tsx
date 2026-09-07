import { useState } from 'react';
import Modal from '../ui/Modal';
import { TextInput, CheckboxInput, SelectInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { PROVIDER_CONFIGS, type ProviderConfig, type ProviderPreset } from '../../config/providers';
import { Server, Zap, Cloud, Mail, Send, ChevronRight } from 'lucide-react';
import api from '../../api/client';

const ICONS: Record<string, typeof Server> = { Server, Zap, Cloud, Mail, Send };

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddProviderModal({ isOpen, onClose, onSaved }: AddProviderModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<ProviderConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | number | boolean>>({});
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => { setStep(0); setSelected(null); setFormValues({}); setName(''); setIsDefault(false); };

  const handleClose = () => { reset(); onClose(); };

  const selectProvider = (p: ProviderConfig) => {
    setSelected(p);
    const defaults: Record<string, string | number | boolean> = {};
    p.fields.forEach((f) => { if (f.defaultValue !== undefined) defaults[f.name] = f.defaultValue; });
    setFormValues(defaults);
    setName(`My ${p.name}`);
    setStep(1);
  };

  const applyPreset = (preset: ProviderPreset) => {
    setFormValues((prev) => ({ ...prev, ...preset.values }));
  };

  const handleSubmit = async () => {
    if (!selected) return;
    const missing = selected.fields.filter((f) => f.required && !formValues[f.name]);
    if (missing.length > 0) {
      addToast(`Please fill: ${missing.map((f) => f.label).join(', ')}`, 'warning');
      return;
    }
    setLoading(true);
    try {
      await api.post('/sending-configs', {
        name,
        provider: selected.key,
        settings: formValues,
        is_default: isDefault,
      });
      addToast(`${selected.name} provider added`, 'success');
      handleClose();
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add provider';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={step === 0 ? 'Choose Email Provider' : `Configure ${selected?.name}`} size="lg" footer={
      step > 0 ? (
        <div className="flex justify-between">
          <button onClick={() => setStep(0)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Back</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
            {loading && <ButtonSpinner />} Add Provider
          </button>
        </div>
      ) : undefined
    }>
      {step === 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {PROVIDER_CONFIGS.map((p) => {
            const Icon = ICONS[p.icon] || Server;
            return (
              <button key={p.key} onClick={() => selectProvider(p)}
                className="flex items-center gap-4 p-4 border rounded-lg text-left hover:border-primary-400 hover:bg-primary-50 transition-colors group">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-primary-100">
                  <Icon className="h-6 w-6 text-gray-600 group-hover:text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            );
          })}
        </div>
      ) : selected && (
        <div className="space-y-4">
          {/* Presets */}
          {selected.presets && selected.presets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quick Setup</label>
              <div className="flex gap-2">
                {selected.presets.map((preset) => (
                  <button key={preset.label} onClick={() => applyPreset(preset)}
                    className="px-3 py-1.5 border rounded-lg text-sm hover:bg-primary-50 hover:border-primary-400">
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic fields */}
          {selected.fields.map((field) => {
            if (field.type === 'checkbox') {
              return (
                <CheckboxInput key={field.name} label={field.label}
                  checked={!!formValues[field.name]}
                  onChange={(v) => setFormValues({ ...formValues, [field.name]: v })} />
              );
            }
            if (field.type === 'select' && field.options) {
              return (
                <SelectInput key={field.name} label={field.label} name={field.name}
                  value={String(formValues[field.name] || '')}
                  onChange={(v) => setFormValues({ ...formValues, [field.name]: v })}
                  options={field.options} required={field.required} />
              );
            }
            return (
              <TextInput key={field.name} label={field.label} name={field.name}
                value={String(formValues[field.name] || '')}
                onChange={(v) => setFormValues({ ...formValues, [field.name]: field.type === 'number' ? Number(v) : v })}
                type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                required={field.required} placeholder={field.placeholder} />
            );
          })}

          <hr className="my-4" />

          <TextInput label="Display Name" name="name" value={name} onChange={setName} required placeholder="e.g. My Gmail SMTP" />
          <CheckboxInput label="Set as default provider" checked={isDefault} onChange={setIsDefault}
            description="New campaigns will use this provider by default" />
        </div>
      )}
    </Modal>
  );
}
