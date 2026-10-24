import api from './client';

export type WaProvider = 'meta_cloud' | 'web_qr';
export type WaAccountStatus = 'pending_qr' | 'connected' | 'disconnected' | 'logged_out' | 'banned' | 'paused' | 'error';

export interface QuietHours { start: string; end: string; tz?: string }

export interface WaAccount {
  id: string;
  provider: WaProvider;
  name: string;
  phone_e164: string | null;
  display_name: string | null;
  status: WaAccountStatus;
  daily_limit: number | null;
  min_interval_sec: number | null;
  max_interval_sec: number | null;
  quiet_hours: QuietHours | null;
  warmup_started_at: string | null;
  last_seen_at: string | null;
  last_error: string | null;
  ai_enabled: boolean;
  ai_settings: {
    business_name?: string;
    business_profile?: string;
    tone?: string;
    language?: string;
    handoff_keywords?: string[];
    stop_keywords?: string[];
  };
  sent_today: number;
  daily_cap: number;
  warmup_day: number | null;
  created_at: string;
}

export interface WaTemplate {
  id: string;
  account_id: string | null;
  source: 'meta' | 'local';
  name: string;
  language: string;
  category: string | null;
  status: string;
  body: string;
  variables: string[];
  rejection_reason: string | null;
  updated_at: string;
}

export interface WaConversation {
  id: string;
  account_id: string;
  account_name: string;
  account_provider: WaProvider;
  account_status?: WaAccountStatus;
  contact_id: string | null;
  phone_e164: string;
  profile_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  unread_count: number;
  status: 'open' | 'closed' | 'needs_human';
  ai_paused: boolean;
  ai_enabled?: boolean;
  whatsapp_opt_out?: boolean;
  within_service_window?: boolean;
}

export interface WaMessage {
  id: string;
  direction: 'in' | 'out';
  type: string;
  body: string | null;
  media: { type: string; url?: string; filename?: string } | null;
  status: string;
  error: string | null;
  sent_by: 'user' | 'campaign' | 'ai' | 'api' | 'system' | null;
  campaign_id: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
}

export interface WaCampaign {
  id: string;
  name: string;
  account_id: string;
  account_name: string;
  account_provider: WaProvider;
  account_status?: WaAccountStatus;
  template_id: string | null;
  template_name?: string | null;
  template_body?: string | null;
  message_body: string | null;
  media: { type: 'image' | 'document' | 'video'; url: string; filename?: string } | null;
  variable_mapping: Record<string, string>;
  state: 'draft' | 'scheduled' | 'queued' | 'sending' | 'paused' | 'done' | 'cancelled' | 'failed';
  require_consent: boolean;
  schedule_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  stat_total: number;
  stat_sent: number;
  stat_delivered: number;
  stat_read: number;
  stat_failed: number;
  stat_replied: number;
  stat_opted_out: number;
  stat_skipped: number;
  lists?: { id: string; name: string }[];
  list_ids?: string[];
  created_at: string;
}

export interface WaOverview {
  days: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  queued: number;
  received: number;
  conversations_with_replies: number;
  ai_replies: number;
  opted_out: number;
  delivery_rate: number;
  read_rate: number;
  campaign_reply_rate: number;
  open_conversations: number;
  needs_human: number;
  unread_conversations: number;
  usage_this_month: number;
  monthly_limit: number;
}

export interface WaDaily { day: string; sent: number; delivered: number; read: number; failed: number; received: number }

export interface WaAccountHealth {
  id: string;
  name: string;
  provider: WaProvider;
  status: WaAccountStatus;
  phone_e164: string | null;
  sent_today: number;
  daily_cap: number;
  warmup_day: number | null;
  queued: number;
  sent_7d: number;
  failure_rate_7d: number;
  last_error: string | null;
}

export interface WaKnowledge {
  id: string;
  account_id: string | null;
  title: string;
  content: string;
  source: 'manual' | 'taught_from_reply';
  is_active: boolean;
  updated_at: string;
}

export interface Paginated<T> { data: T[]; total: number; page: number; per_page: number; total_pages: number }

// ─── Accounts ───
export const listWaAccounts = () => api.get<{ data: WaAccount[] }>('/whatsapp/accounts').then((r) => r.data.data);
export const createMetaAccount = (body: { name: string; access_token: string; phone_number_id: string; waba_id: string }) =>
  api.post<WaAccount>('/whatsapp/accounts', { provider: 'meta_cloud', ...body }).then((r) => r.data);
export const createQrAccount = (name: string) =>
  api.post<WaAccount>('/whatsapp/accounts', { provider: 'web_qr', name, accept_risk: true }).then((r) => r.data);
export const updateWaAccount = (id: string, body: Partial<Pick<WaAccount, 'name' | 'daily_limit' | 'min_interval_sec' | 'max_interval_sec' | 'quiet_hours' | 'ai_enabled' | 'ai_settings'>>) =>
  api.patch<WaAccount>(`/whatsapp/accounts/${id}`, body).then((r) => r.data);
export const deleteWaAccount = (id: string) => api.delete(`/whatsapp/accounts/${id}`);
export const getWaQr = (id: string) =>
  api.get<{ status: WaAccountStatus; qr: string | null; phone_e164: string | null; last_error: string | null }>(`/whatsapp/accounts/${id}/qr`).then((r) => r.data);
export const connectWaAccount = (id: string) => api.post<WaAccount>(`/whatsapp/accounts/${id}/connect`).then((r) => r.data);
export const logoutWaAccount = (id: string) => api.post<WaAccount>(`/whatsapp/accounts/${id}/logout`).then((r) => r.data);

// ─── Templates ───
export const listWaTemplates = (accountId?: string) =>
  api.get<{ data: WaTemplate[] }>('/whatsapp/templates', { params: accountId ? { account_id: accountId } : {} }).then((r) => r.data.data);
export const syncWaTemplates = (accountId: string) => api.post<{ synced: number }>(`/whatsapp/accounts/${accountId}/templates/sync`).then((r) => r.data);
export const createWaTemplate = (body: { account_id: string; name: string; body: string; language?: string; category?: string; submit_to_meta?: boolean; examples?: string[] }) =>
  api.post<WaTemplate>('/whatsapp/templates', body).then((r) => r.data);
export const deleteWaTemplate = (id: string) => api.delete(`/whatsapp/templates/${id}`);

// ─── Messages / inbox ───
export const sendWaMessage = (body: { account_id: string; contact_id?: string; phone?: string; body?: string; template_id?: string; variable_mapping?: Record<string, string> }) =>
  api.post<WaMessage>('/whatsapp/messages', body).then((r) => r.data);
export const listConversations = (params: { page?: number; per_page?: number; account_id?: string; status?: string; unread?: boolean; search?: string }) =>
  api.get<Paginated<WaConversation>>('/whatsapp/conversations', { params }).then((r) => r.data);
export const getConversation = (id: string) => api.get<WaConversation>(`/whatsapp/conversations/${id}`).then((r) => r.data);
export const getConversationMessages = (id: string) =>
  api.get<{ data: WaMessage[] }>(`/whatsapp/conversations/${id}/messages`, { params: { limit: 100 } }).then((r) => r.data.data);
export const replyToConversation = (id: string, body: { body?: string; template_id?: string; variable_mapping?: Record<string, string> }) =>
  api.post<WaMessage>(`/whatsapp/conversations/${id}/reply`, body).then((r) => r.data);
export const updateConversation = (id: string, body: { status?: string; ai_paused?: boolean }) =>
  api.patch<WaConversation>(`/whatsapp/conversations/${id}`, body).then((r) => r.data);
export const saveConversationContact = (id: string, body: { email: string; first_name?: string; last_name?: string; whatsapp_consent?: boolean }) =>
  api.post<WaConversation>(`/whatsapp/conversations/${id}/save-contact`, body).then((r) => r.data);
export const suggestReplies = (id: string) => api.post<{ suggestions: string[] }>(`/whatsapp/conversations/${id}/suggest`).then((r) => r.data.suggestions);
export const getContactWaActivity = (contactId: string) =>
  api.get<{ data: Array<WaMessage & { campaign_name: string | null; conversation_id: string }> }>(`/whatsapp/contacts/${contactId}/activity`).then((r) => r.data.data);

// ─── Campaigns ───
export interface CampaignBody {
  name: string;
  account_id: string;
  template_id?: string | null;
  message_body?: string | null;
  media?: WaCampaign['media'];
  variable_mapping?: Record<string, string>;
  list_ids: string[];
  require_consent?: boolean;
}
export const listWaCampaigns = (params: { page?: number; per_page?: number; state?: string; search?: string }) =>
  api.get<Paginated<WaCampaign>>('/whatsapp/campaigns', { params }).then((r) => r.data);
export const getWaCampaign = (id: string) => api.get<WaCampaign>(`/whatsapp/campaigns/${id}`).then((r) => r.data);
export const createWaCampaign = (body: CampaignBody) => api.post<WaCampaign>('/whatsapp/campaigns', body).then((r) => r.data);
export const updateWaCampaign = (id: string, body: Partial<CampaignBody>) => api.patch<WaCampaign>(`/whatsapp/campaigns/${id}`, body).then((r) => r.data);
export const deleteWaCampaign = (id: string) => api.delete(`/whatsapp/campaigns/${id}`);
export const getWaAudience = (id: string) =>
  api.get<{ list_members: number; eligible: number; skipped: number; daily_cap: number; remaining_today: number; estimated_days: number }>(`/whatsapp/campaigns/${id}/audience`).then((r) => r.data);
export const scheduleWaCampaign = (id: string, schedule_at?: string) => api.post<WaCampaign>(`/whatsapp/campaigns/${id}/schedule`, { schedule_at }).then((r) => r.data);
export const pauseWaCampaign = (id: string) => api.post<WaCampaign>(`/whatsapp/campaigns/${id}/pause`).then((r) => r.data);
export const resumeWaCampaign = (id: string) => api.post<WaCampaign>(`/whatsapp/campaigns/${id}/resume`).then((r) => r.data);
export const cancelWaCampaign = (id: string) => api.post<WaCampaign>(`/whatsapp/campaigns/${id}/cancel`).then((r) => r.data);
export const testWaCampaign = (id: string, phones: string[]) =>
  api.post<{ results: { phone: string; ok: boolean; error?: string }[] }>(`/whatsapp/campaigns/${id}/test`, { phones }).then((r) => r.data.results);
export const previewWaMessage = (body: { account_id: string; template_id?: string | null; message_body?: string | null; variable_mapping?: Record<string, string> }) =>
  api.post<{ body: string | null; type: string }>('/whatsapp/campaigns/preview-message', body).then((r) => r.data);
export const getWaCampaignStats = (id: string) =>
  api.get<{ campaign: WaCampaign; by_status: Record<string, number>; reads_by_hour: { hour: number; count: number }[] }>(`/whatsapp/campaigns/${id}/stats`).then((r) => r.data);
export const getWaCampaignMessages = (id: string, params: { page?: number; per_page?: number; status?: string }) =>
  api.get<Paginated<{ id: string; phone_e164: string; status: string; error: string | null; sent_at: string | null; delivered_at: string | null; read_at: string | null; first_name: string | null; last_name: string | null }>>(`/whatsapp/campaigns/${id}/messages`, { params }).then((r) => r.data);

// ─── Stats ───
export const getWaOverview = (days = 30) => api.get<WaOverview>('/whatsapp/stats/overview', { params: { days } }).then((r) => r.data);
export const getWaDaily = (days = 30) => api.get<{ data: WaDaily[] }>('/whatsapp/stats/daily', { params: { days } }).then((r) => r.data.data);
export const getWaAccountHealth = () => api.get<{ data: WaAccountHealth[] }>('/whatsapp/stats/accounts').then((r) => r.data.data);

// ─── AI ───
export const composeWaMessage = (body: { goal: string; tone?: string; language?: string; length?: 'short' | 'medium' | 'long'; for_template?: boolean }) =>
  api.post<{ message: string; variables_used: string[]; notes: string }>('/whatsapp/ai/compose', body).then((r) => r.data);
export const testWaBot = (account_id: string, messages: { role: 'customer' | 'business'; text: string }[]) =>
  api.post<{ action: 'reply' | 'handoff'; reply: string; reason: string }>('/whatsapp/ai/test', { account_id, messages }).then((r) => r.data);
export const teachWaAi = (message_id: string, question?: string) => api.post<WaKnowledge>('/whatsapp/ai/teach', { message_id, question }).then((r) => r.data);
export const listKnowledge = () => api.get<{ data: WaKnowledge[] }>('/whatsapp/ai/knowledge').then((r) => r.data.data);
export const createKnowledge = (body: { title: string; content: string; account_id?: string | null }) => api.post<WaKnowledge>('/whatsapp/ai/knowledge', body).then((r) => r.data);
export const updateKnowledge = (id: string, body: Partial<{ title: string; content: string; is_active: boolean; account_id: string | null }>) =>
  api.patch<WaKnowledge>(`/whatsapp/ai/knowledge/${id}`, body).then((r) => r.data);
export const deleteKnowledge = (id: string) => api.delete(`/whatsapp/ai/knowledge/${id}`);

export function apiError(err: unknown, fallback: string): string {
  return (err as any)?.response?.data?.message || fallback;
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}
