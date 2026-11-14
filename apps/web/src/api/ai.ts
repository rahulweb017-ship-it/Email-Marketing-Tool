import api from './client';
import type { MediaAsset } from './media';

export interface AiUsage { period: string; used: number; limit: number; costs: Record<string, number> }

export interface BrandProfile {
  business_name: string | null; website: string | null; industry: string | null; description: string | null;
  products: string | null; audience: string | null; tone: string | null; language: string | null;
  words_to_use: string | null; words_to_avoid: string | null; sample_copy: string | null;
}

export interface SubjectSuggestion { subject: string; preview_text: string; score: number; reason: string }
export type SocialPlatform = 'twitter' | 'facebook' | 'linkedin' | 'instagram';

export const getAiUsage = () => api.get<AiUsage>('/ai/usage').then((r) => r.data);
export const getBrandProfile = () => api.get<BrandProfile>('/ai/brand').then((r) => r.data);
export const saveBrandProfile = (input: Partial<BrandProfile>) => api.put<BrandProfile>('/ai/brand', input).then((r) => r.data);

export const aiWriteEmail = (input: { brief: string; tone?: string; language?: string; length: 'short' | 'medium' | 'long'; cta_url?: string }) =>
  api.post<{ subject: string; preview_text: string; html: string }>('/ai/email/write', input).then((r) => r.data);

export const aiRewrite = (input: { text: string; instruction: string }) =>
  api.post<{ text: string }>('/ai/email/rewrite', input).then((r) => r.data);

export const aiSubjectLines = (input: { topic?: string; content_html?: string; current_subject?: string }) =>
  api.post<{ suggestions: SubjectSuggestion[] }>('/ai/subject-lines', input).then((r) => r.data);

export const aiWriteSocial = (input: { brief: string; platforms: SocialPlatform[]; tone?: string; include_hashtags?: boolean }) =>
  api.post<{ posts: { platform: SocialPlatform; text: string }[] }>('/ai/social/write', input).then((r) => r.data);

export interface SegmentDraft {
  name: string; description: string;
  filter_rules: { match: 'all' | 'any'; rules: { field: string; operator: string; value?: string }[] };
  unsupported: string[];
  preview: { count: number };
}
export const aiBuildSegment = (description: string) =>
  api.post<SegmentDraft>('/ai/segment/build', { description }).then((r) => r.data);

export const aiBuildAutomation = (input: { description: string; cta_url?: string }) =>
  api.post<{ id: string; name: string; summary: string; notes: string[] }>('/ai/automation/build', input).then((r) => r.data);

export interface CampaignInsights {
  headline: string; summary: string; wins: string[]; issues: string[]; recommendations: string[]; generated_at?: string;
}
export const aiCampaignInsights = (campaignId: string) =>
  api.post<CampaignInsights>(`/ai/campaigns/${campaignId}/insights`).then((r) => r.data);
export function aiErrorMessage(err: unknown, fallback = 'The AI request failed'): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export type CopilotDraftKind = 'segment' | 'automation' | 'email_campaign';
export interface CopilotDraft { kind: CopilotDraftKind; title: string; brief: string }
export interface CopilotReply { answer: string; drafts: CopilotDraft[]; follow_ups: string[] }
export interface CopilotTurn { role: 'user' | 'assistant'; content: string }
export const aiCopilot = (messages: CopilotTurn[]) =>
  api.post<CopilotReply>('/ai/copilot', { messages }).then((r) => r.data);
export const aiCopilotDraft = (draft: CopilotDraft) =>
  api.post<{ kind: CopilotDraftKind; id: string; name: string; url: string; notes: string[]; count?: number }>('/ai/copilot/draft', draft).then((r) => r.data);

export type ImageSize = 'square' | 'landscape' | 'portrait';
export type ImageStyle = 'photo' | 'illustration' | '3d' | 'minimal';
export const aiGenerateImage = (input: { prompt: string; size: ImageSize; style: ImageStyle; use_brand?: boolean }) =>
  api.post<MediaAsset>('/ai/images/generate', input, { timeout: 200_000 }).then((r) => r.data);
