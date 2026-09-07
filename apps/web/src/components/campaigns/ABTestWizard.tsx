import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../ui/Modal';
import { TextInput, TextArea, SelectInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { ChevronLeft, ChevronRight, Plus, Trash2, FlaskConical, Check, Users, Settings2 } from 'lucide-react';
import clsx from 'clsx';
import api from '../../api/client';

interface ABTestWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface ListOption {
  id: string;
  name: string;
  contact_count_active: number;
}

interface Variant {
  name: string;
  subject: string;
  body_html: string;
  preview_text: string;
}

const STEPS = ['Settings', 'Variants', 'Audience', 'Review'];

const stepContentVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
};

function AnimatedCheckmark() {
  return (
    <motion.svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <motion.path
        d="M3 7L6 10L11 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </motion.svg>
  );
}

export default function ABTestWizard({ isOpen, onClose, onSaved }: ABTestWizardProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [activeVariant, setActiveVariant] = useState(0);

  const [form, setForm] = useState({
    name: '',
    test_percentage: 20,
    winner_criteria: 'open_rate' as 'open_rate' | 'click_rate',
    evaluation_hours: 4,
    email_from: '',
    reply_to: '',
    selectedLists: [] as string[],
  });

  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Variant A', subject: '', body_html: '', preview_text: '' },
    { name: 'Variant B', subject: '', body_html: '', preview_text: '' },
  ]);

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setDirection(1);
    setActiveVariant(0);
    setForm({
      name: '',
      test_percentage: 20,
      winner_criteria: 'open_rate',
      evaluation_hours: 4,
      email_from: '',
      reply_to: '',
      selectedLists: [],
    });
    setVariants([
      { name: 'Variant A', subject: '', body_html: '', preview_text: '' },
      { name: 'Variant B', subject: '', body_html: '', preview_text: '' },
    ]);
    api.get('/lists', { params: { per_page: 100 } })
      .then(({ data }) => setLists(data.data))
      .catch(() => {});
  }, [isOpen]);

  const goTo = (target: number) => {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  const toggleList = (id: string) => {
    setForm((f) => ({
      ...f,
      selectedLists: f.selectedLists.includes(id)
        ? f.selectedLists.filter((l) => l !== id)
        : [...f.selectedLists, id],
    }));
  };

  const updateVariant = (index: number, field: keyof Variant, value: string) => {
    setVariants((prev) => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const addVariant = () => {
    if (variants.length >= 4) return;
    const letters = ['A', 'B', 'C', 'D'];
    setVariants((prev) => [...prev, {
      name: `Variant ${letters[prev.length] || prev.length + 1}`,
      subject: '',
      body_html: '',
      preview_text: '',
    }]);
    setActiveVariant(variants.length);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 2) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
    if (activeVariant >= variants.length - 1) {
      setActiveVariant(Math.max(0, variants.length - 2));
    }
  };

  const handleCreate = async () => {
    if (!form.name) {
      addToast('Test name is required', 'warning');
      goTo(0);
      return;
    }
    if (!form.email_from) {
      addToast('From email is required', 'warning');
      goTo(2);
      return;
    }
    if (form.selectedLists.length === 0) {
      addToast('Select at least one mailing list', 'warning');
      goTo(2);
      return;
    }
    for (const v of variants) {
      if (!v.subject || !v.body_html) {
        addToast(`All variants must have a subject and body content`, 'warning');
        goTo(1);
        return;
      }
    }

    setLoading(true);
    try {
      await api.post('/ab-tests', {
        name: form.name,
        test_percentage: form.test_percentage,
        winner_criteria: form.winner_criteria,
        evaluation_hours: form.evaluation_hours,
        email_from: form.email_from,
        reply_to: form.reply_to || undefined,
        list_ids: form.selectedLists,
        variants: variants.map((v) => ({
          name: v.name,
          subject: v.subject,
          body_html: v.body_html,
          preview_text: v.preview_text || undefined,
        })),
      });
      addToast('A/B test created successfully', 'success');
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create A/B test';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New A/B Test" size="xl" footer={
      <div className="flex justify-between">
        <button onClick={() => step > 0 && goTo(step - 1)} disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-3">
          {step < 3 ? (
            <button onClick={() => goTo(step + 1)}
              className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleCreate} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              {loading && <ButtonSpinner />} <FlaskConical className="h-4 w-4" /> Create A/B Test
            </button>
          )}
        </div>
      </div>
    }>
      {/* Animated Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button onClick={() => goTo(i)} className="flex items-center gap-2 relative">
              <motion.span
                animate={{
                  scale: i === step ? 1.1 : 1,
                  backgroundColor: i < step ? '#16a34a' : i === step ? '#7c3aed' : '#d1d5db',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
              >
                {i < step ? <AnimatedCheckmark /> : i + 1}
              </motion.span>
              <span className={clsx('text-xs font-medium transition-colors',
                i === step ? 'text-primary-700' : i < step ? 'text-green-700' : 'text-gray-500')}>
                {s}
              </span>
            </button>
            {i < 3 && (
              <div className="w-8 h-0.5 bg-gray-200 overflow-hidden rounded-full">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: i < step ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Animated Step Content */}
      <div className="relative overflow-hidden min-h-[340px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={stepContentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* Step 0: Settings */}
            {step === 0 && (
              <div className="space-y-4">
                <TextInput label="Test Name" name="name" value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })} required
                  placeholder="e.g. Subject Line Test - March Newsletter" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Percentage: {form.test_percentage}%
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={form.test_percentage}
                    onChange={(e) => setForm({ ...form, test_percentage: Number(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>5%</span>
                    <span>25%</span>
                    <span>50%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.test_percentage}% of recipients will receive test variants. The remaining {100 - form.test_percentage}% will receive the winner.
                  </p>
                </div>

                <SelectInput
                  label="Winner Criteria"
                  name="winner_criteria"
                  value={form.winner_criteria}
                  onChange={(v) => setForm({ ...form, winner_criteria: v as 'open_rate' | 'click_rate' })}
                  options={[
                    { value: 'open_rate', label: 'Highest Open Rate' },
                    { value: 'click_rate', label: 'Highest Click Rate' },
                  ]}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Evaluation Delay (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={form.evaluation_hours}
                    onChange={(e) => setForm({ ...form, evaluation_hours: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How long to wait before automatically picking a winner (1-168 hours).
                  </p>
                </div>
              </div>
            )}

            {/* Step 1: Variants */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">
                    Email Variants ({variants.length}/4)
                  </h3>
                  {variants.length < 4 && (
                    <button onClick={addVariant}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
                      <Plus className="h-3.5 w-3.5" /> Add Variant
                    </button>
                  )}
                </div>

                {/* Variant tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {variants.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveVariant(i)}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all relative',
                        activeVariant === i ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700',
                      )}
                    >
                      {v.name}
                      {variants.length > 2 && activeVariant === i && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeVariant(i); }}
                          className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </button>
                  ))}
                </div>

                {/* Active variant form */}
                <div className="space-y-3 border rounded-lg p-4">
                  <TextInput
                    label="Variant Name"
                    name={`variant-name-${activeVariant}`}
                    value={variants[activeVariant].name}
                    onChange={(v) => updateVariant(activeVariant, 'name', v)}
                    placeholder="e.g. Short Subject"
                  />
                  <TextInput
                    label="Subject Line"
                    name={`variant-subject-${activeVariant}`}
                    value={variants[activeVariant].subject}
                    onChange={(v) => updateVariant(activeVariant, 'subject', v)}
                    required
                    placeholder="e.g. Don't miss our sale!"
                  />
                  <TextInput
                    label="Preview Text"
                    name={`variant-preview-${activeVariant}`}
                    value={variants[activeVariant].preview_text}
                    onChange={(v) => updateVariant(activeVariant, 'preview_text', v)}
                    placeholder="Text shown after subject in inbox"
                  />
                  <TextArea
                    label="Email Body (HTML)"
                    name={`variant-body-${activeVariant}`}
                    value={variants[activeVariant].body_html}
                    onChange={(v) => updateVariant(activeVariant, 'body_html', v)}
                    rows={8}
                    required
                    placeholder="<h1>Hello!</h1><p>Your email content here...</p>"
                  />
                  {variants[activeVariant].body_html && (
                    <div className="border rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b">
                        <span className="text-xs text-gray-500 font-medium">Preview</span>
                      </div>
                      <iframe
                        srcDoc={variants[activeVariant].body_html}
                        className="w-full h-32 bg-white"
                        title={`Preview ${variants[activeVariant].name}`}
                        sandbox=""
                      />
                    </div>
                  )}
                </div>

                {/* Variant completeness indicators */}
                <div className="flex gap-2">
                  {variants.map((v, i) => {
                    const complete = v.subject && v.body_html;
                    return (
                      <div key={i} className={clsx(
                        'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
                        complete ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
                      )}>
                        {complete ? <Check className="h-3 w-3" /> : <Settings2 className="h-3 w-3" />}
                        {v.name}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Audience */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <TextInput
                    label="From Email"
                    name="email_from"
                    value={form.email_from}
                    onChange={(v) => setForm({ ...form, email_from: v })}
                    required
                    placeholder="news@example.com"
                    type="email"
                  />
                  <TextInput
                    label="Reply-To"
                    name="reply_to"
                    value={form.reply_to}
                    onChange={(v) => setForm({ ...form, reply_to: v })}
                    placeholder="Same as from"
                    type="email"
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                    <Users className="h-4 w-4" /> Select Mailing Lists
                  </h3>
                  {lists.length === 0 ? (
                    <p className="text-sm text-gray-500">No lists available. Create one first.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                      {lists.map((list) => (
                        <label key={list.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={form.selectedLists.includes(list.id)}
                              onChange={() => toggleList(list.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-medium">{list.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">{list.contact_count_active} contacts</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">A/B Test Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium">{form.name || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Test Percentage</span>
                    <span className="font-medium">{form.test_percentage}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Winner Criteria</span>
                    <span className="font-medium">
                      {form.winner_criteria === 'open_rate' ? 'Open Rate' : 'Click Rate'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Evaluation Delay</span>
                    <span className="font-medium">{form.evaluation_hours}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">From</span>
                    <span className="font-medium">{form.email_from || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Lists</span>
                    <span className="font-medium">
                      {form.selectedLists.length === 0 ? 'None selected' :
                        lists.filter((l) => form.selectedLists.includes(l.id)).map((l) => l.name).join(', ')}
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-medium text-gray-700">Variants</h3>
                <div className="space-y-3">
                  {variants.map((v, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">{v.name}</h4>
                        {v.subject && v.body_html ? (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Ready
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600">Incomplete</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">Subject: {v.subject || '-'}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Content: {v.body_html ? `${v.body_html.length} chars` : 'No content'}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                  <p className="font-medium">How it works:</p>
                  <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
                    <li>{form.test_percentage}% of recipients will be split across {variants.length} variants</li>
                    <li>After {form.evaluation_hours} hours, the variant with the best {form.winner_criteria === 'open_rate' ? 'open rate' : 'click rate'} wins</li>
                    <li>The remaining {100 - form.test_percentage}% will receive the winning variant</li>
                  </ol>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}
