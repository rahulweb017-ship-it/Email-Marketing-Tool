import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Mail,
  MousePointerClick,
  Eye,
  AlertTriangle,
  Send,
  MessageSquare,
  User,
  Building,
  Phone,
  Globe,
  Calendar,
  ShieldCheck,
  CheckCircle,
  Zap,
  MessageCircle,
} from 'lucide-react';
import SendWhatsAppModal from '../components/whatsapp/SendWhatsAppModal';
import { getContactWaActivity } from '../api/whatsapp';
import api from '../api/client';
import { getContactConsent, grantConsent, revokeConsent } from '../api/consent';
import { validateContact } from '../api/email-validation';
import Pagination from '../components/ui/Pagination';
import Badge from '../components/ui/Badge';
import { useToastStore } from '../stores/toast.store';

interface ConsentRecord {
  id: string;
  consent_type: string;
  status: string;
  source: string;
  granted_at: string;
  revoked_at: string | null;
  updated_at: string;
}

interface Contact {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  phone_e164?: string | null;
  country_code: string | null;
  is_blacklisted: boolean;
  validation_status: 'unknown' | 'valid' | 'invalid' | 'risky' | 'disposable';
  validation_checked_at: string | null;
  engagement_score: number;
  engagement_updated_at: string | null;
  predicted_engagement?: number | null;
  churn_risk?: number | null;
  created_at: string;
  tags?: Array<{ id: string; name: string; color: string | null }>;
  subscriptions?: Array<{ id: string; name: string; opt_out: boolean }>;
}

const validationBadgeConfig: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  valid: { label: 'Valid', variant: 'success' },
  invalid: { label: 'Invalid', variant: 'danger' },
  risky: { label: 'Risky', variant: 'warning' },
  disposable: { label: 'Disposable', variant: 'info' },
  unknown: { label: 'Unknown', variant: 'neutral' },
};

interface ActivityEvent {
  id: string;
  type: string;
  campaign_id: string;
  campaign_name: string | null;
  campaign_subject: string | null;
  timestamp: string;
}

interface CampaignTrace {
  trace_id: string;
  campaign_id: string;
  campaign_name: string | null;
  subject: string;
  campaign_status: string;
  trace_status: string;
  sent_at: string | null;
  first_open_at: string | null;
  first_click_at: string | null;
  bounced_at: string | null;
  open_count: number;
  click_count: number;
}

interface Stats {
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
}

const eventIcons: Record<string, { icon: typeof Mail; color: string }> = {
  sent: { icon: Send, color: 'text-blue-500 bg-blue-50' },
  opened: { icon: Eye, color: 'text-green-500 bg-green-50' },
  clicked: { icon: MousePointerClick, color: 'text-rose-500 bg-rose-50' },
  bounced: { icon: AlertTriangle, color: 'text-red-500 bg-red-50' },
  replied: { icon: MessageSquare, color: 'text-teal-500 bg-teal-50' },
  unsubscribed: { icon: Mail, color: 'text-amber-500 bg-amber-50' },
};

export default function ContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [contact, setContact] = useState<Contact | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignTrace[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingContact, setLoadingContact] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  const [consent, setConsent] = useState<ConsentRecord[]>([]);
  const [loadingConsent, setLoadingConsent] = useState(true);
  const [togglingConsent, setTogglingConsent] = useState<string | null>(null);

  const [validating, setValidating] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waActivity, setWaActivity] = useState<Awaited<ReturnType<typeof getContactWaActivity>>>([]);
  const fetchWaActivity = useCallback(async () => {
    if (!id) return;
    try { setWaActivity(await getContactWaActivity(id)); } catch { setWaActivity([]); } // 402 when the plan has no WhatsApp
  }, [id]);
  useEffect(() => { fetchWaActivity(); }, [fetchWaActivity]);

  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const campaignPerPage = 10;

  const fetchContact = useCallback(async () => {
    setLoadingContact(true);
    try {
      const { data } = await api.get(`/contacts/${id}`);
      setContact(data);
    } catch {
      addToast('Failed to load contact', 'error');
    } finally {
      setLoadingContact(false);
    }
  }, [id, addToast]);

  const fetchActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const { data } = await api.get(`/contacts/${id}/activity`, { params: { per_page: 20 } });
      setActivity(data.data);
    } catch {
      // Activity data may not exist yet
      setActivity([]);
    } finally {
      setLoadingActivity(false);
    }
  }, [id]);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const { data } = await api.get(`/contacts/${id}/campaigns`, {
        params: { page: campaignPage, per_page: campaignPerPage },
      });
      setCampaigns(data.data);
      setCampaignTotal(data.total);
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [id, campaignPage]);

  const fetchConsent = useCallback(async () => {
    setLoadingConsent(true);
    try {
      const { data } = await getContactConsent(id!);
      setConsent(data);
    } catch {
      setConsent([]);
    } finally {
      setLoadingConsent(false);
    }
  }, [id]);

  const handleToggleConsent = async (consentType: string, currentStatus: string) => {
    setTogglingConsent(consentType);
    try {
      if (currentStatus === 'granted') {
        await revokeConsent(id!, consentType);
      } else {
        await grantConsent(id!, { consent_type: consentType, source: 'manual' });
      }
      await fetchConsent();
      addToast(`Consent ${currentStatus === 'granted' ? 'revoked' : 'granted'}`, 'success');
    } catch {
      addToast('Failed to update consent', 'error');
    } finally {
      setTogglingConsent(null);
    }
  };

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get(`/contacts/${id}/stats`);
      setStats(data);
    } catch {
      setStats(null);
    }
  }, [id]);

  const handleValidateEmail = async () => {
    if (!id) return;
    setValidating(true);
    try {
      await validateContact(id);
      addToast('Email validated successfully', 'success');
      await fetchContact();
    } catch {
      addToast('Failed to validate email', 'error');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchContact();
      fetchActivity();
      fetchStats();
      fetchConsent();
    }
  }, [id, fetchContact, fetchActivity, fetchStats, fetchConsent]);

  useEffect(() => {
    if (id) {
      fetchCampaigns();
    }
  }, [id, fetchCampaigns]);

  if (loadingContact) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-48 bg-gray-200 rounded-xl" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Contact not found</p>
        <button
          onClick={() => navigate('/contacts')}
          className="mt-4 text-primary-600 hover:underline text-sm"
        >
          Back to Contacts
        </button>
      </div>
    );
  }

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/contacts')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{fullName || contact.email || contact.phone_e164 || contact.phone}</h1>
          {fullName && <p className="text-sm text-gray-500">{contact.email || contact.phone_e164 || contact.phone}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={validationBadgeConfig[contact.validation_status || 'unknown']?.variant || 'neutral'}>
            {validationBadgeConfig[contact.validation_status || 'unknown']?.label || 'Unknown'}
          </Badge>
          <Badge variant={contact.is_blacklisted ? 'danger' : 'success'} pulse>
            {contact.is_blacklisted ? 'Blacklisted' : 'Active'}
          </Badge>
          <button
            onClick={handleValidateEmail}
            disabled={validating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className={`h-4 w-4 ${validating ? 'animate-spin' : ''}`} />
            {validating ? 'Validating...' : 'Validate Email'}
          </button>
          {contact.phone && (
            <button
              onClick={() => setWaOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
            {loadingActivity ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex gap-3">
                    <div className="h-8 w-8 bg-gray-200 rounded-full" />
                    <div className="flex-1 h-12 bg-gray-200 rounded" />
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No activity yet</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-4">
                  {activity.map((event) => {
                    const config = eventIcons[event.type] || eventIcons.sent;
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-3 relative"
                      >
                        <div className={`relative z-10 p-2 rounded-full ${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 pt-1">
                          <p className="text-sm font-medium capitalize">
                            {event.type}{' '}
                            {event.campaign_name && (
                              <span className="text-gray-500 font-normal">
                                - {event.campaign_name}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(event.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* WhatsApp History */}
          {waActivity.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp</h2>
                <button onClick={() => navigate(`/whatsapp/inbox?c=${waActivity[0].conversation_id}`)} className="text-sm text-green-600 hover:underline">Open conversation</button>
              </div>
              <ul className="space-y-2">
                {waActivity.slice(0, 10).map((m) => (
                  <li key={m.id} className="flex items-start gap-3 text-sm">
                    <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded ${m.direction === 'in' ? 'bg-teal-100 text-teal-700' : 'bg-green-100 text-green-700'}`}>{m.direction === 'in' ? 'Received' : m.status}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 dark:text-gray-300 truncate">{m.body || `[${m.type}]`}</p>
                      <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{m.campaign_name ? ` · ${m.campaign_name}` : ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Email History Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm overflow-hidden"
          >
            <div className="p-6 pb-0">
              <h2 className="text-lg font-semibold mb-4">Email History</h2>
            </div>
            {loadingCampaigns ? (
              <div className="p-6 animate-pulse space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 bg-gray-200 rounded" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No emails sent to this contact yet</p>
            ) : (
              <>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Campaign</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Opens</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campaigns.map((trace) => (
                      <tr key={trace.trace_id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm font-medium">
                          {trace.campaign_name || trace.subject}
                        </td>
                        <td className="px-6 py-3">
                          <Badge
                            variant={
                              trace.trace_status === 'sent'
                                ? 'success'
                                : trace.bounced_at
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {trace.trace_status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {trace.sent_at
                            ? new Date(trace.sent_at).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{trace.open_count}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{trace.click_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4">
                  <Pagination
                    page={campaignPage}
                    total={campaignTotal}
                    perPage={campaignPerPage}
                    onPageChange={setCampaignPage}
                  />
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Contact Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Contact Info</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                <span className={`break-all ${contact.email ? 'text-gray-700' : 'text-gray-400 italic'}`}>{contact.email || 'No email (WhatsApp only)'}</span>
              </div>
              {fullName && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{fullName}</span>
                </div>
              )}
              {contact.company_name && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{contact.company_name}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{contact.phone}</span>
                </div>
              )}
              {contact.country_code && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="text-gray-700">{contact.country_code}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="text-gray-700">
                  Joined {new Date(contact.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-gray-400 shrink-0" />
                <div>
                  <span className="text-gray-700">
                    Validation: <Badge variant={validationBadgeConfig[contact.validation_status || 'unknown']?.variant || 'neutral'}>
                      {validationBadgeConfig[contact.validation_status || 'unknown']?.label || 'Unknown'}
                    </Badge>
                  </span>
                  {contact.validation_checked_at && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Checked {new Date(contact.validation_checked_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700"
                      style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subscriptions */}
            {contact.subscriptions && contact.subscriptions.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Lists</h3>
                <div className="space-y-1.5">
                  {contact.subscriptions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{sub.name}</span>
                      <Badge variant={sub.opt_out ? 'warning' : 'success'}>
                        {sub.opt_out ? 'Opted out' : 'Subscribed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Engagement Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">Engagement Score</h2>
            </div>
            {(() => {
              const score = contact.engagement_score || 0;
              const maxScore = 100;
              const percentage = Math.min((score / maxScore) * 100, 100);
              let color = 'bg-gray-300';
              let textColor = 'text-gray-500';
              let label = 'Cold';
              if (score > 80) { color = 'bg-emerald-500'; textColor = 'text-emerald-600'; label = 'Very Hot'; }
              else if (score > 50) { color = 'bg-green-500'; textColor = 'text-green-600'; label = 'Hot'; }
              else if (score > 20) { color = 'bg-yellow-500'; textColor = 'text-yellow-600'; label = 'Warm'; }
              return (
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className={`text-4xl font-bold ${textColor}`}>{score}</span>
                    <span className={`text-sm font-medium ${textColor}`}>{label}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {(contact.predicted_engagement != null || contact.churn_risk != null) && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Likely to engage next</p>
                        <p className="text-xl font-semibold text-gray-900">{contact.predicted_engagement ?? '-'}<span className="text-sm text-gray-400">/100</span></p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Churn risk</p>
                        <p className={`text-xl font-semibold ${(contact.churn_risk ?? 0) >= 70 ? 'text-red-600' : (contact.churn_risk ?? 0) >= 40 ? 'text-amber-600' : 'text-green-600'}`}>
                          {contact.churn_risk ?? '-'}<span className="text-sm text-gray-400">/100</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {contact.engagement_updated_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      Updated {new Date(contact.engagement_updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })()}
          </motion.div>

          {/* Stats Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold mb-4">Engagement Stats</h2>
            {stats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{stats.total_sent}</p>
                  <p className="text-xs text-gray-500">Emails Sent</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.total_opened}</p>
                  <p className="text-xs text-gray-500">Opened</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-rose-600">{stats.total_clicked}</p>
                  <p className="text-xs text-gray-500">Clicked</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary-600">{stats.open_rate}%</p>
                  <p className="text-xs text-gray-500">Open Rate</p>
                </div>
                <div className="col-span-2 text-center pt-2 border-t">
                  <p className="text-2xl font-bold text-teal-600">{stats.click_rate}%</p>
                  <p className="text-xs text-gray-500">Click Rate</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No stats available</p>
            )}
          </motion.div>

          {/* Consent Management Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Consent</h2>
            </div>
            {loadingConsent ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-8 bg-gray-200 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {['email_marketing', 'whatsapp_marketing', 'data_processing', 'third_party_sharing'].map((type) => {
                  const record = consent.find((c) => c.consent_type === type);
                  const status = record?.status || 'none';
                  const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400">
                          {record
                            ? `${status === 'granted' ? 'Granted' : 'Revoked'} ${new Date(
                                status === 'granted' ? record.granted_at : record.revoked_at!,
                              ).toLocaleDateString()} via ${record.source}`
                            : 'No consent recorded'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleConsent(type, status)}
                        disabled={togglingConsent === type}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          status === 'granted' ? 'bg-green-500' : 'bg-gray-300'
                        } ${togglingConsent === type ? 'opacity-50' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            status === 'granted' ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <SendWhatsAppModal open={waOpen} contactId={contact.id} onClose={() => setWaOpen(false)} onSent={fetchWaActivity} />
    </motion.div>
  );
}
