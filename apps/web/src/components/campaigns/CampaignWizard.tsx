import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '../ui/Modal';
import { TextInput, TextArea, CheckboxInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { ChevronLeft, ChevronRight, Send, Save, FileText, Code, Check, Sparkles, Clock, Mail, Loader2, Plus } from 'lucide-react';
import RichTextEditor from '../ui/RichTextEditor';
import SpamScoreChecker from './SpamScoreChecker';
import clsx from 'clsx';
import api from '../../api/client';
import SubjectLineSuggester from '../ai/SubjectLineSuggester';

interface CampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  campaign?: {
    id: string; name: string; subject: string; preview_text: string | null;
    email_from: string; reply_to: string | null; body_html: string | null;
    use_blacklist: boolean; list_ids?: string[]; sending_config_id?: string | null;
    segment_id?: string | null; send_time_optimized?: boolean;
  } | null;
}

interface ListOption { id: string; name: string; contact_count_active: number }
interface TemplateOption { id: string; name: string; subject: string | null; body_html: string | null }
interface ProviderOption { id: string; name: string; provider: string; is_default: boolean; is_active: boolean; from_hint?: string }

type ContentTab = 'template' | 'write' | 'code';

const QUICK_TEMPLATES = [
  { id: '_simple', name: 'Simple Message', desc: 'Clean text-based email', html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;"><tr><td style="padding:40px 30px;"><p></p></td></tr><tr><td style="background:#f9fafb;padding:20px 30px;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr></table>` },
  { id: '_announce', name: 'Announcement', desc: 'Feature or product launch', html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;"><tr><td style="background:#4f46e5;padding:40px 30px;text-align:center;"><p style="color:#c7d2fe;font-size:13px;text-transform:uppercase;letter-spacing:2px;margin:0;">Announcement</p><h1 style="color:#fff;font-size:28px;margin:12px 0 0;">Something New</h1></td></tr><tr><td style="padding:40px 30px;"><p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">We're excited to share our latest update with you. Here's what's new.</p><ul style="color:#4b5563;line-height:2;padding-left:20px;"><li>Feature one</li><li>Feature two</li><li>Feature three</li></ul></td></tr><tr><td style="padding:0 30px 40px;text-align:center;"><a href="#" style="background:#4f46e5;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Learn More</a></td></tr><tr><td style="background:#f9fafb;padding:20px;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr></table>` },
  { id: '_promo', name: 'Promotion', desc: 'Sale or discount offer', html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;"><tr><td style="background:linear-gradient(135deg,#ef4444,#ec4899);padding:40px;text-align:center;"><h1 style="color:#fff;font-size:36px;margin:0;">SPECIAL OFFER</h1><p style="color:#fecdd3;font-size:18px;margin:12px 0 0;">Limited time only</p></td></tr><tr><td style="padding:40px;text-align:center;"><h2 style="font-size:24px;margin:0 0 16px;">Save 30% Today</h2><p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">Use the code below at checkout.</p><div style="background:#f3f4f6;display:inline-block;padding:12px 24px;border-radius:8px;font-size:20px;font-weight:bold;letter-spacing:2px;">SAVE30</div></td></tr><tr><td style="padding:0 40px 40px;text-align:center;"><a href="#" style="background:#4f46e5;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">Shop Now</a></td></tr><tr><td style="background:#f9fafb;padding:20px;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr></table>` },
];

const STEPS = ['Details', 'Audience', 'Content', 'Review'];

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

const stepContentVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
};

export default function CampaignWizard({ isOpen, onClose, onSaved, campaign }: CampaignWizardProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [segments, setSegments] = useState<{ id: string; name: string; cached_count: number | null }[]>([]);

  const [contentTab, setContentTab] = useState<ContentTab>('template');

  // Scheduling state
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduleDate, setScheduleDate] = useState('');

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResults, setTestResults] = useState<{ email: string; success: boolean; error?: string }[] | null>(null);

  // Inline list creation state
  const [showQuickList, setShowQuickList] = useState(false);
  const [quickListName, setQuickListName] = useState('');
  const [quickListLoading, setQuickListLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', subject: '', preview_text: '', email_from: '', reply_to: '',
    body_html: '', use_blacklist: true, selectedLists: [] as string[],
    selectedTemplate: '', sending_config_id: '' as string, segment_id: '', send_time_optimized: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setDirection(1);
    setScheduleType('now');
    setScheduleDate('');
    setTestEmail('');
    setTestSending(false);
    setTestResults(null);
    api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => setLists(data.data)).catch(() => {});
    api.get('/templates', { params: { per_page: 100 } }).then(({ data }) => setTemplates(data.data)).catch(() => {});
    api.get('/segments', { params: { per_page: 100 } }).then(({ data }) => setSegments(data.data || [])).catch(() => {});
    api.get('/sending-configs').then(async ({ data }) => {
      const activeProviders = data.data.filter((p: ProviderOption) => p.is_active);
      // Fetch settings for each provider to get from_email hint
      const withHints = await Promise.all(activeProviders.map(async (p: ProviderOption) => {
        try {
          const { data: detail } = await api.get(`/sending-configs/${p.id}`);
          const settings = detail.settings || {};
          return { ...p, from_hint: settings.from_email || settings.username || '' };
        } catch {
          return p;
        }
      }));
      setProviders(withHints);
      // Set default provider and auto-fill from_email if not editing
      if (!campaign) {
        const defaultProvider = withHints.find((p: ProviderOption) => p.is_default) || withHints[0];
        if (defaultProvider) {
          setForm((prev) => ({
            ...prev,
            sending_config_id: defaultProvider.id,
            email_from: prev.email_from || defaultProvider.from_hint || '',
          }));
        }
      }
    }).catch(() => {});

    if (campaign) {
      setForm({
        name: campaign.name || '', subject: campaign.subject || '', preview_text: campaign.preview_text || '',
        email_from: campaign.email_from || '', reply_to: campaign.reply_to || '',
        body_html: campaign.body_html || '', use_blacklist: campaign.use_blacklist ?? true,
        selectedLists: campaign.list_ids || [], selectedTemplate: '',
        sending_config_id: campaign.sending_config_id || '',
        segment_id: campaign.segment_id || '', send_time_optimized: !!campaign.send_time_optimized,
      });
    } else {
      setForm({ name: '', subject: '', preview_text: '', email_from: '', reply_to: '', body_html: '', use_blacklist: true, selectedLists: [], selectedTemplate: '', sending_config_id: '', segment_id: '', send_time_optimized: false });
    }
  }, [isOpen, campaign]);

  const goTo = (target: number) => {
    setDirection(target > step ? 1 : -1);
    setStep(target);
  };

  const toggleList = (id: string) => {
    setForm((f) => ({
      ...f, selectedLists: f.selectedLists.includes(id)
        ? f.selectedLists.filter((l) => l !== id)
        : [...f.selectedLists, id],
    }));
  };

  const selectTemplate = async (id: string) => {
    setForm((f) => ({ ...f, selectedTemplate: id }));
    if (id) {
      try {
        const { data } = await api.get(`/templates/${id}`);
        setForm((f) => ({ ...f, body_html: data.body_html || '', subject: f.subject || data.subject || '' }));
        setContentTab('write');
      } catch { /* ignore */ }
    }
  };

  const applyQuickTemplate = (html: string, templateId: string) => {
    setForm((f) => ({ ...f, body_html: html, selectedTemplate: templateId }));
    setContentTab('write');
  };

  const handleQuickCreateList = async () => {
    if (!quickListName.trim()) return;
    setQuickListLoading(true);
    try {
      const { data } = await api.post('/lists', { name: quickListName.trim() });
      setLists((prev) => [...prev, { id: data.id, name: data.name, contact_count_active: 0 }]);
      setForm((f) => ({ ...f, selectedLists: [...f.selectedLists, data.id] }));
      setQuickListName('');
      setShowQuickList(false);
      addToast('List created', 'success');
    } catch {
      addToast('Failed to create list', 'error');
    } finally {
      setQuickListLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) return;
    const emails = testEmail.split(',').map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0 || emails.length > 5) {
      addToast('Enter 1-5 email addresses separated by commas', 'warning');
      return;
    }
    if (!form.subject.trim()) {
      addToast('Please fill in the Subject in Step 1 (Details) before sending a test', 'warning');
      return;
    }
    if (!form.email_from.trim()) {
      addToast('Please fill in the From Email in Step 1 (Details) before sending a test', 'warning');
      return;
    }
    if (!form.body_html?.trim()) {
      addToast('Please add email content in Step 3 before sending a test', 'warning');
      return;
    }

    setTestSending(true);
    setTestResults(null);
    try {
      // Save/update campaign first to ensure it exists
      const payload: Record<string, unknown> = {
        name: form.name || form.subject,
        subject: form.subject,
        email_from: form.email_from,
        use_blacklist: form.use_blacklist,
        list_ids: form.selectedLists,
        segment_id: form.segment_id || null,
        send_time_optimized: form.send_time_optimized,
      };
      if (form.preview_text) payload.preview_text = form.preview_text;
      if (form.reply_to) payload.reply_to = form.reply_to;
      if (form.body_html) payload.body_html = form.body_html;

      let id = campaign?.id;
      if (id) {
        await api.patch(`/campaigns/${id}`, payload);
      } else {
        const { data } = await api.post('/campaigns', payload);
        id = data.id;
      }

      const { data } = await api.post(`/campaigns/${id}/test`, { emails });
      setTestResults(data.results);
      const allOk = data.results.every((r: { success: boolean }) => r.success);
      addToast(allOk ? 'Test email(s) sent!' : 'Some test emails failed', allOk ? 'success' : 'warning');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send test email';
      addToast(msg, 'error');
    } finally {
      setTestSending(false);
    }
  };

  const handleSave = async (action: 'draft' | 'send') => {
    if (!form.subject || !form.email_from) {
      addToast('Subject and From email are required', 'warning');
      goTo(0);
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name || form.subject,
        subject: form.subject,
        email_from: form.email_from,
        use_blacklist: form.use_blacklist,
        list_ids: form.selectedLists,
        segment_id: form.segment_id || null,
        send_time_optimized: form.send_time_optimized,
      };
      if (form.preview_text) payload.preview_text = form.preview_text;
      if (form.reply_to) payload.reply_to = form.reply_to;
      if (form.body_html) payload.body_html = form.body_html;
      if (form.sending_config_id) payload.sending_config_id = form.sending_config_id;

      let id = campaign?.id;
      if (id) {
        await api.patch(`/campaigns/${id}`, payload);
      } else {
        const { data } = await api.post('/campaigns', payload);
        id = data.id;
      }

      if (action === 'send' && id) {
        const schedulePayload: Record<string, unknown> = {};
        if (scheduleType === 'scheduled' && scheduleDate) {
          schedulePayload.schedule_date = new Date(scheduleDate).toISOString();
        }
        await api.post(`/campaigns/${id}/schedule`, schedulePayload);
        if (scheduleType === 'scheduled') {
          addToast(`Campaign scheduled for ${new Date(scheduleDate).toLocaleString()}`, 'success');
        } else {
          addToast('Campaign queued for sending', 'success');
        }
      } else {
        addToast(campaign ? 'Campaign updated' : 'Campaign saved as draft', 'success');
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save campaign';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Minimum datetime for scheduling (5 min from now)
  const minScheduleDate = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={campaign ? 'Edit Campaign' : 'New Campaign'} size="xl" footer={
      <div className="flex justify-between">
        <button onClick={() => step > 0 && goTo(step - 1)} disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex gap-3">
          {step < 3 ? (
            <button onClick={() => goTo(step + 1)}
              className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button onClick={() => handleSave('draft')} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                {loading && <ButtonSpinner />} <Save className="h-4 w-4" /> Save Draft
              </button>
              <button onClick={() => handleSave('send')} disabled={loading || (scheduleType === 'scheduled' && !scheduleDate)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
                {loading && <ButtonSpinner />}
                {scheduleType === 'scheduled' ? (
                  <><Clock className="h-4 w-4" /> Schedule</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Now</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    }>
      {/* Animated Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <button onClick={() => goTo(i)}
              className="flex items-center gap-2 relative">
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
                i === step ? 'text-primary-700 dark:text-primary-300' : i < step ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400')}>
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
            {/* Step 0: Details */}
            {step === 0 && (
              <div className="space-y-4">
                <TextInput label="Campaign Name" name="name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. March Newsletter" />
                <TextInput label="Subject Line" name="subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} required placeholder="e.g. Your weekly update" />
                <SubjectLineSuggester
                  currentSubject={form.subject}
                  contentHtml={form.body_html}
                  onPick={(s) => setForm((f) => ({ ...f, subject: s.subject, preview_text: f.preview_text || s.preview_text }))}
                />
                <TextInput label="Preview Text" name="preview_text" value={form.preview_text} onChange={(v) => setForm({ ...form, preview_text: v })} placeholder="Text shown after subject in inbox" />

                {/* Email Provider Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email Provider
                  </label>
                  {providers.length === 0 ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      No email providers configured. Please add one in Settings before sending campaigns.
                    </p>
                  ) : (
                    <select
                      value={form.sending_config_id}
                      onChange={(e) => {
                        const selected = providers.find((p) => p.id === e.target.value);
                        setForm((f) => ({
                          ...f,
                          sending_config_id: e.target.value,
                          email_from: selected?.from_hint || f.email_from,
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select provider...</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.provider.toUpperCase()}){p.is_default ? ' - Default' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <TextInput label="From Email" name="email_from" value={form.email_from} onChange={(v) => setForm({ ...form, email_from: v })} required placeholder="news@yourdomain.com" type="email" />
                    {(() => {
                      const selectedProvider = providers.find((p) => p.id === form.sending_config_id);
                      const hintDomain = selectedProvider?.from_hint?.split('@')[1];
                      const fromDomain = form.email_from?.split('@')[1];
                      if (hintDomain && fromDomain && hintDomain !== fromDomain) {
                        return <p className="text-xs text-amber-600 mt-1">Your SMTP account uses @{hintDomain} — using a different domain may cause rejection</p>;
                      }
                      return <p className="text-xs text-gray-400 mt-1">Must match your email provider&apos;s domain</p>;
                    })()}
                  </div>
                  <div>
                    <TextInput label="Reply-To" name="reply_to" value={form.reply_to} onChange={(v) => setForm({ ...form, reply_to: v })} placeholder="Optional" type="email" />
                    <p className="text-xs text-gray-400 mt-1">Where replies go (defaults to From Email if empty)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Audience */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Select Mailing Lists</h3>
                  <button
                    type="button"
                    onClick={() => setShowQuickList(!showQuickList)}
                    className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <Plus className="h-3 w-3" /> Create List
                  </button>
                </div>
                {showQuickList && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={quickListName}
                        onChange={(e) => setQuickListName(e.target.value)}
                        placeholder="List name, e.g. Newsletter Subscribers"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateList(); } }}
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickCreateList}
                      disabled={quickListLoading || !quickListName.trim()}
                      className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
                    >
                      {quickListLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowQuickList(false); setQuickListName(''); }}
                      className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {lists.length === 0 && !showQuickList ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    No mailing lists yet. Click "Create List" above to add one.
                  </p>
                ) : lists.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {lists.map((list) => (
                      <label key={list.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={form.selectedLists.includes(list.id)}
                            onChange={() => toggleList(list.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm font-medium">{list.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{list.contact_count_active} contacts</span>
                      </label>
                    ))}
                  </div>
                ) : null}
                {segments.length > 0 && (
                  <div>
                    <label htmlFor="wizard-segment" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Narrow to a segment (optional)</label>
                    <select id="wizard-segment" value={form.segment_id} onChange={(e) => setForm({ ...form, segment_id: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                      <option value="">Everyone in the selected lists</option>
                      {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.cached_count ?? 0} contacts)</option>)}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Only list subscribers who also match the segment get this email.</p>
                  </div>
                )}
                <CheckboxInput label="Use Blacklist" checked={form.use_blacklist} onChange={(v) => setForm({ ...form, use_blacklist: v })}
                  description="Exclude blacklisted contacts from this campaign" />
              </div>
            )}

            {/* Step 2: Content */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Content source tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {([
                    { key: 'template' as ContentTab, label: 'Templates', icon: FileText },
                    { key: 'write' as ContentTab, label: 'Visual', icon: Sparkles },
                    { key: 'code' as ContentTab, label: 'HTML Code', icon: Code },
                  ]).map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button key={tab.key} onClick={() => setContentTab(tab.key)}
                        className={clsx('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all',
                          contentTab === tab.key ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')}>
                        <Icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Template picker */}
                {contentTab === 'template' && (
                  <div className="space-y-4">
                    {/* Saved templates */}
                    {templates.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Your Templates</h4>
                        <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                          {templates.map((t) => (
                            <button key={t.id} onClick={() => selectTemplate(t.id)}
                              className={clsx('relative group border-2 rounded-xl text-left transition-all overflow-hidden',
                                form.selectedTemplate === t.id ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-100 hover:border-primary-300')}>
                              {/* Preview thumbnail */}
                              <div className="h-24 bg-gray-50 overflow-hidden">
                                {t.body_html ? (
                                  <iframe srcDoc={t.body_html} className="w-full h-full pointer-events-none scale-[0.35] origin-top-left" style={{ width: '285%', height: '285%' }} title={t.name} sandbox="" />
                                ) : (
                                  <div className="h-full flex items-center justify-center text-gray-300">
                                    <FileText className="h-8 w-8" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="font-medium text-sm truncate">{t.name}</p>
                                {t.subject && <p className="text-xs text-gray-400 truncate">{t.subject}</p>}
                              </div>
                              {form.selectedTemplate === t.id && (
                                <div className="absolute top-2 right-2 bg-primary-500 text-white rounded-full p-0.5">
                                  <Check className="h-3 w-3" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick-start templates */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quick Start</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {QUICK_TEMPLATES.map((qt) => (
                          <button key={qt.id} onClick={() => applyQuickTemplate(qt.html, qt.id)}
                            className={clsx('p-3 border-2 rounded-xl text-left transition-all',
                              form.selectedTemplate === qt.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700')}>
                            <div className="h-12 bg-gray-100 rounded-lg mb-2 overflow-hidden">
                              <iframe srcDoc={qt.html} className="w-full h-full pointer-events-none scale-[0.2] origin-top-left" style={{ width: '500%', height: '500%' }} title={qt.name} sandbox="" />
                            </div>
                            <p className="font-medium text-sm">{qt.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{qt.desc}</p>
                            {form.selectedTemplate === qt.id && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-primary-600 font-medium">
                                <Check className="h-3 w-3" /> Selected
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Visual / rich text editor */}
                {contentTab === 'write' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Write your email visually — use the toolbar to format text, add headings, images, and links.</p>
                    <RichTextEditor
                      value={form.body_html}
                      onChange={(html) => setForm((f) => ({ ...f, body_html: html }))}
                      placeholder="Start writing your email content..."
                      minHeight={240}
                    />
                  </div>
                )}

                {/* Raw HTML code mode */}
                {contentTab === 'code' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Paste or write raw HTML for full control over your email design.</p>
                    <TextArea label="Email Body (HTML)" name="body_html" value={form.body_html}
                      onChange={(v) => setForm({ ...form, body_html: v })} rows={10}
                      placeholder="<h1>Hello!</h1><p>Your email content here...</p>" />
                    {form.body_html && (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Live Preview</span>
                        </div>
                        <iframe srcDoc={form.body_html} className="w-full h-40 bg-white" title="Preview" sandbox="" />
                      </div>
                    )}
                  </div>
                )}

                {/* Content status indicator */}
                {form.body_html && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                    <Check className="h-3.5 w-3.5" />
                    <span>Content ready &middot; {form.body_html.length.toLocaleString()} characters</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Campaign Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Name</span>
                    <span className="font-medium">{form.name || form.subject || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Subject</span>
                    <span className="font-medium">{form.subject || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">From</span>
                    <span className="font-medium">{form.email_from || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Lists</span>
                    <span className="font-medium">
                      {form.selectedLists.length === 0 ? 'None selected' :
                        lists.filter((l) => form.selectedLists.includes(l.id)).map((l) => l.name).join(', ')}
                    </span>
                  </div>
                  {form.segment_id && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Segment</span>
                      <span className="font-medium">{segments.find((s) => s.id === form.segment_id)?.name || 'Selected'}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Content</span>
                    <span className="font-medium">{form.body_html ? `${form.body_html.length} chars` : 'No content'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Blacklist</span>
                    <span className="font-medium">{form.use_blacklist ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>

                {/* Scheduling */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">When to send</h4>
                  <div className="flex gap-3">
                    <label className={clsx(
                      'flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all',
                      scheduleType === 'now' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300',
                    )}>
                      <input type="radio" name="scheduleType" value="now" checked={scheduleType === 'now'}
                        onChange={() => setScheduleType('now')}
                        className="text-primary-600 focus:ring-primary-500" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Send className="h-3.5 w-3.5 text-primary-600" />
                          <span className="text-sm font-medium">Send immediately</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Campaign will be queued right away</p>
                      </div>
                    </label>
                    <label className={clsx(
                      'flex-1 flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all',
                      scheduleType === 'scheduled' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300',
                    )}>
                      <input type="radio" name="scheduleType" value="scheduled" checked={scheduleType === 'scheduled'}
                        onChange={() => setScheduleType('scheduled')}
                        className="text-primary-600 focus:ring-primary-500" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-600" />
                          <span className="text-sm font-medium">Schedule for later</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Choose a date and time</p>
                      </div>
                    </label>
                  </div>
                  {scheduleType === 'scheduled' && (
                    <div>
                      <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={minScheduleDate}
                        className="w-full text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                      />
                      {scheduleDate && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Will send on {new Date(scheduleDate).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                  <CheckboxInput label="Send-time optimisation" checked={form.send_time_optimized}
                    onChange={(v) => setForm({ ...form, send_time_optimized: v })}
                    description="Deliver to each contact at the hour they usually open email, within the next 24 hours. Contacts without open history get your audience's most common hour." />
                </div>

                {/* Spam Score */}
                {form.body_html && (
                  <SpamScoreChecker bodyHtml={form.body_html} />
                )}

                {/* Send Test Email */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    Send Test Email
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="test@example.com (comma-separated, max 5)"
                      className="flex-1 text-sm border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSendTest(); } }}
                    />
                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={testSending || !testEmail || !form.body_html}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      Send Test
                    </button>
                  </div>
                  {testResults && (
                    <div className="space-y-1">
                      {testResults.map((r) => (
                        <div key={r.email} className={clsx('flex items-center gap-2 text-xs px-2 py-1 rounded',
                          r.success ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50')}>
                          {r.success ? <Check className="h-3 w-3" /> : <span className="font-bold">!</span>}
                          <span>{r.email}</span>
                          {r.error && <span className="text-red-500 ml-auto">{r.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {form.body_html && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Preview</h4>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <iframe srcDoc={form.body_html} className="w-full h-[600px]" title="Preview" sandbox="" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}
