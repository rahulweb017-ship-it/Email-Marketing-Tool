import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import SegmentRuleRow from './SegmentRuleRow';
import AiCreditsLine from '../ai/AiCreditsLine';
import { aiBuildSegment, aiErrorMessage } from '../../api/ai';
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
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [aiRuns, setAiRuns] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setAiPrompt('');
      setAiError('');
      setAiNotes([]);
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

  const runAi = async () => {
    if (aiPrompt.trim().length < 5) return;
    setAiBusy(true); setAiError(''); setAiNotes([]);
    try {
      const draft = await aiBuildSegment(aiPrompt.trim());
      if (draft.filter_rules.rules.length) {
        setMatch(draft.filter_rules.match);
        setRules(draft.filter_rules.rules.map((r) => ({ ...r, value: r.value ?? '' })));
        setPreviewCount(draft.preview.count);
        if (!name.trim()) setName(draft.name);
        if (!description.trim()) setDescription(draft.description);
      } else {
        setAiError('No rules could be built from that description.');
      }
      setAiNotes(draft.unsupported);
    } catch (err) {
      setAiError(aiErrorMessage(err));
    } finally {
      setAiBusy(false); setAiRuns((n) => n + 1);
    }
  };

  const handlePreview = async () => {
    if (rules.length === 0) return;
    setPreviewing(true);
    try {
      const { data } = await api.post('/segments/preview', { filter_rules: { match, rules } });
      setPreviewCount(data.count);
    } catch (err) {
      addToast(aiErrorMessage(err, 'Failed to preview segment count'), 'error');
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
    } catch (err) {
      addToast(aiErrorMessage(err, 'Failed to save segment'), 'error');
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
        {/* Rabbit AI */}
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/30 p-4 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-800 dark:text-violet-200">
            <Sparkles className="h-4 w-4" /> Describe your audience
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runAi(); } }}
              placeholder="e.g. Engaged contacts in India who haven't opened in 60 days"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
              maxLength={1000}
            />
            <button type="button" onClick={runAi} disabled={aiBusy || aiPrompt.trim().length < 5}
              className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
              {aiBusy ? 'Building...' : 'Build rules'}
            </button>
          </div>
          {aiError && <p className="text-sm text-red-600">{aiError}</p>}
          {aiNotes.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-300">
              <p className="font-medium">Couldn't be turned into rules:</p>
              <ul className="list-disc pl-4">{aiNotes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          <AiCreditsLine refreshKey={aiRuns} />
        </div>

        {/* Name */}        <div>
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
