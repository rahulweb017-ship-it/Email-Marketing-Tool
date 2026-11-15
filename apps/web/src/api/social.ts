import api from './client';

export type SocialPlatformId = 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'threads' | 'pinterest';
export type ScheduleMode = 'draft' | 'now' | 'queue' | 'queue_top' | 'custom';
export type PostTab = 'queue' | 'drafts' | 'approvals' | 'sent';
export type IdeaStage = 'unassigned' | 'todo' | 'in_progress' | 'done';

export interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_avatar_url?: string | null;
  is_active: boolean;
  last_error?: string | null;
}

export interface PlatformInfo {
  id: string;
  label: string;
  configured: boolean;
  character_limit: number | null;
  supports_first_comment: boolean;
}

export interface SocialPostAccount {
  id: string;
  account_id: string;
  platform: string;
  account_name: string;
  account_avatar_url?: string | null;
  status: string;
  error_message?: string | null;
  platform_post_url?: string | null;
  content_override?: string | null;
  first_comment?: string | null;
}

export interface SocialPostMedia {
  id: string;
  file_url: string;
  file_type: string;
  alt_text?: string | null;
}

export interface SocialPost {
  id: string;
  content: string;
  status: string;
  scheduled_at?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  queued?: boolean;
  tags: string[];
  rejection_note?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  accounts: SocialPostAccount[];
  media: SocialPostMedia[];
}

export interface SocialTag { id: string; name: string; color: string }
export interface SocialTemplate { id: string; name: string; content: string; tags: string[]; updated_at: string }
export interface IdeaMedia { url: string; type: 'image' | 'video' | 'gif' }
export interface SocialIdea {
  id: string; title: string; body?: string | null; media: IdeaMedia[]; tags: string[];
  stage: IdeaStage; position: number; created_at: string;
}
export interface QueueSlot { id?: string; account_id?: string; day_of_week: number; time_of_day: string }
export interface PostCounts { queue: number; drafts: number; approvals: number; sent: number }

export interface PostPayload {
  content: string;
  account_ids: string[];
  overrides?: Array<{ account_id: string; content_override?: string | null; first_comment?: string | null }>;
  media?: Array<{ url: string; type: 'image' | 'video' | 'gif'; alt_text?: string | null }>;
  tags?: string[];
  idea_id?: string | null;
  schedule_mode: ScheduleMode;
  scheduled_at?: string | null;
}

// Accounts
export const listSocialAccounts = () => api.get('/social/accounts');
export const connectSocialAccount = (platform: string) => api.post('/social/accounts/connect', { platform });
export const disconnectSocialAccount = (id: string) => api.delete(`/social/accounts/${id}`);
export const verifySocialAccount = (id: string) => api.post(`/social/accounts/${id}/verify`);
export const listPlatforms = () => api.get<{ data: PlatformInfo[] }>('/social/platforms').then((r) => r.data.data);

// Posts
export const listSocialPosts = (params?: Record<string, string>) => api.get('/social/posts', { params });
export const getPostCounts = (params?: Record<string, string>) => api.get<PostCounts>('/social/posts/counts', { params }).then((r) => r.data);
export const getSocialPost = (id: string) => api.get(`/social/posts/${id}`);
export const createSocialPost = (data: PostPayload | Record<string, unknown>) => api.post('/social/posts', data);
export const updateSocialPost = (id: string, data: Partial<PostPayload> | Record<string, unknown>) => api.patch(`/social/posts/${id}`, data);
export const deleteSocialPost = (id: string) => api.delete(`/social/posts/${id}`);
export const publishSocialPost = (id: string) => api.post(`/social/posts/${id}/publish`);
export const scheduleSocialPost = (id: string, data: { scheduled_at: string }) => api.post(`/social/posts/${id}/schedule`, data);
export const approveSocialPost = (id: string) => api.post(`/social/posts/${id}/approve`);
export const rejectSocialPost = (id: string, note: string) => api.post(`/social/posts/${id}/reject`, { note });
export const retrySocialPost = (id: string) => api.post(`/social/posts/${id}/retry`);
export const duplicateSocialPost = (id: string) => api.post(`/social/posts/${id}/duplicate`);
export const getCalendarPosts = (params: { start: string; end: string }) => api.get('/social/posts/calendar', { params });

// Metrics
export const getSocialPostMetrics = (id: string) => api.get(`/social/posts/${id}/metrics`);

// Queue
export const getQueueSlots = (accountId?: string) =>
  api.get<{ slots: QueueSlot[]; timezone: string }>('/social/queue/slots', { params: accountId ? { account_id: accountId } : {} }).then((r) => r.data);
export const saveQueueSlots = (accountId: string, slots: QueueSlot[]) =>
  api.put('/social/queue/slots', { account_id: accountId, slots: slots.map(({ day_of_week, time_of_day }) => ({ day_of_week, time_of_day })) });
export const saveQueueTimezone = (timezone: string) => api.put('/social/queue/settings', { timezone });
export const getNextSlot = (accountIds: string[], mode: 'queue' | 'queue_top') =>
  api.get<{ scheduled_at: string; timezone: string }>('/social/queue/next', { params: { account_ids: accountIds.join(','), mode } }).then((r) => r.data);

// Tags
export const listTags = () => api.get<{ data: SocialTag[] }>('/social/tags').then((r) => r.data.data);
export const createTag = (name: string, color?: string) => api.post<SocialTag>('/social/tags', { name, color }).then((r) => r.data);
export const deleteTag = (id: string) => api.delete(`/social/tags/${id}`);

// Templates
export const listTemplates = () => api.get<{ data: SocialTemplate[] }>('/social/templates').then((r) => r.data.data);
export const createTemplate = (data: { name: string; content: string; tags?: string[] }) => api.post('/social/templates', data);
export const updateTemplate = (id: string, data: { name: string; content: string; tags?: string[] }) => api.patch(`/social/templates/${id}`, data);
export const deleteTemplate = (id: string) => api.delete(`/social/templates/${id}`);

// Ideas
export const listIdeas = () => api.get<{ data: SocialIdea[] }>('/social/ideas').then((r) => r.data.data);
export const createIdea = (data: Partial<SocialIdea>) => api.post<SocialIdea>('/social/ideas', data).then((r) => r.data);
export const updateIdea = (id: string, data: Partial<SocialIdea>) => api.patch<SocialIdea>(`/social/ideas/${id}`, data).then((r) => r.data);
export const moveIdea = (id: string, stage: IdeaStage, position: number) => api.post(`/social/ideas/${id}/move`, { stage, position });
export const deleteIdea = (id: string) => api.delete(`/social/ideas/${id}`);
export const convertIdea = (id: string) => api.post<{ post_id: string }>(`/social/ideas/${id}/convert`).then((r) => r.data);

export function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export const CHAR_LIMITS: Record<string, number> = {
  twitter: 280, facebook: 63206, instagram: 2200, linkedin: 3000, youtube: 5000, threads: 500, pinterest: 500,
};
export const FIRST_COMMENT_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'youtube'];
export const canApproveRole = (user: { role?: string; is_super_admin?: boolean } | null | undefined) =>
  !!user && (!!user.is_super_admin || user.role === 'admin' || user.role === 'owner');

/** Same rules the server enforces; shown as hints before submitting. */
export function platformHints(targets: Array<{ platform: string; content: string }>, media: Array<{ type: string }>): string[] {
  const out: string[] = [];
  const images = media.filter((m) => m.type !== 'video').length;
  const videos = media.filter((m) => m.type === 'video').length;
  const label = (p: string) => ({ twitter: 'X', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', threads: 'Threads', pinterest: 'Pinterest' } as Record<string, string>)[p] || p;
  const seen = new Set<string>();
  for (const t of targets) {
    const lim = CHAR_LIMITS[t.platform];
    if (lim && t.content.length > lim) out.push(`${label(t.platform)} allows up to ${lim} characters`);
    if (seen.has(t.platform)) continue;
    seen.add(t.platform);
    if (t.platform === 'instagram' && images + videos === 0) out.push('Instagram needs an image or a video');
    if (t.platform === 'instagram' && videos > 0 && media.length > 1) out.push('Instagram: a video must be posted on its own');
    if (t.platform === 'youtube' && videos !== 1) out.push('YouTube needs exactly one video');
    if (t.platform === 'pinterest' && images === 0) out.push('Pinterest needs an image');
    if (t.platform === 'twitter' && media.length > 4) out.push('X allows up to 4 media items');
  }
  return [...new Set(out)];
}
