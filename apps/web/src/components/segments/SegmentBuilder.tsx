import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye } from 'lucide-react';
import Modal from '../ui/Modal';
import SegmentRuleRow from './SegmentRuleRow';
import api from '../../api/client';
import { useToastStore } from '../../stores/toast.store';

interface Rule {
  field: string;
  operator: string;
  value?: string;
}

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filter_rules: {
    match: 'all' | 'any';
    rules: Rule[];
  };
  cached_count: number;
  last_computed_at: string | null;
  created_at: string;
}

interface SegmentBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  segment?: Segment | null;
}

const emptyRule: Rule = { field: 'email', operator: 'contains', value: '' };

export default function SegmentBuilder({ isOpen, onClose, onSaved, segment }: SegmentBuilderProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [match, setMatch] = useState<'all' | 'any'>('all');
  const [rules, setRules] = useState<Rule[]>([{ ...emptyRule }]);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (segment) {
        setName(segment.name);
        setDescription(segment.description || '');
        const fr = typeof segment.filter_rules === 'string'
          ? JSON.parse(segment.filter_rules)
          : segment.filter_rules;
        setMatch(fr.match || 'all');
        setRules(fr.rules?.length ? fr.rules : [{ ...emptyRule }]);
        setPreviewCount(segment.cached_count);
      } else {
        setName('');
        setDescription('');
        setMatch('all');
        setRules([{ ...emptyRule }]);
        setPreviewCount(null);
      }
    }
  }, [isOpen, segment]);

  const updateRule = useCallback((index: number, updated: Rule) => {
    setRules((prev) => prev.map((r, i) => (i === index ? updated : r)));
    setPreviewCount(null);
  }, []);

  const addRule = () => {
    setRules((prev) => [...prev, { ...emptyRule }]);
    setPreviewCount(null);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setPreviewCount(null);
  };

  const handlePreview = async () => {
    if (rules.length === 0) return;
    setPreviewing(true);
    try {
      if (segment) {
        // Save first, then compute
        await api.patch(`/segments/${segment.id}`, {
          name,
          description: description || undefined,
          filter_rules: { match, rules },
        });
        const { data } = await api.post(`/segments/${segment.id}/compute`);
        setPreviewCount(data.cached_count);
      } else {
        // For new segments, create temporarily to compute then show
        const { data: created } = await api.post('/segments', {
          name: name || 'Preview Segment',
          description: description || undefined,
          filter_rules: { match, rules },
        });
        const { data } = await api.post(`/segments/${created.id}/compute`);
        setPreviewCount(data.cached_count);
        // Clean up: delete the temporary segment
        await api.delete(`/segments/${created.id}`);
      }
    } catch {
      addToast('Failed to preview segment count', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      addToast('Segment name is required', 'warning');
      return;
    }
    if (rules.length === 0) {
      addToast('At least one rule is required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        filter_rules: { match, rules },
      };

      if (segment) {
        await api.patch(`/segments/${segment.id}`, payload);
        await api.post(`/segments/${segment.id}/compute`);
        addToast('Segment updated', 'success');
      } else {
        const { data: created } = await api.post('/segments', payload);
        await api.post(`/segments/${created.id}/compute`);
        addToast('Segment created', 'success');
      }
      onSaved();
      onClose();
    } catch {
      addToast('Failed to save segment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex items-center justify-between">
      <button
        onClick={handlePreview}
        disabled={previewing || rules.length === 0}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
      >
        <Eye className="h-4 w-4" />
        {previewing ? 'Computing...' : 'Preview Count'}
        {previewCount !== null && (
          <span className="ml-1 px-2 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-full">
            {previewCount}
          </span>
        )}
      </button>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : segment ? 'Update Segment' : 'Create Segment'}
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={segment ? 'Edit Segment' : 'New Segment'}
      size="lg"
      footer={footer}
    >
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Active customers in the US"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose of this segment..."
            rows={2}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
          />
        </div>

        {/* Match toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Matching</label>
          <div className="flex gap-2">
            <button
              onClick={() => { setMatch('all'); setPreviewCount(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                match === 'all'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Match ALL rules
            </button>
            <button
              onClick={() => { setMatch('any'); setPreviewCount(null); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                match === 'any'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Match ANY rule
            </button>
          </div>
        </div>

        {/* Rules */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Rules</label>
          <div className="space-y-3">
            {rules.map((rule, index) => (
              <SegmentRuleRow
                key={index}
                rule={rule}
                onChange={(updated) => updateRule(index, updated)}
                onRemove={() => removeRule(index)}
                canRemove={rules.length > 1}
              />
            ))}
          </div>
          <button
            onClick={addRule}
            className="mt-3 flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        </div>
      </div>
    </Modal>
  );
}
