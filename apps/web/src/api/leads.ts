import api from './client';

export type LeadSource = 'whatsapp' | 'email' | 'website' | 'social' | 'ads' | 'manual' | 'api';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';

export interface LeadQualification {
  score: number; summary: string; need: string; budget: string; timeline: string;
  missing_info: string[]; suggested_status: LeadStatus; next_step: string; reply_draft: string;
}

export interface Lead {
  id: string; source: LeadSource; source_detail: string | null;
  name: string | null; email: string | null; phone: string | null; company: string | null; message: string | null;
  status: LeadStatus; score: number | null; temperature: 'hot' | 'warm' | 'cold' | null; ai_summary: string | null;
  contact_id: string | null; conversation_id: string | null; last_activity_at: string; created_at: string;
}

export interface LeadEvent { id: number; type: string; body: string | null; created_at: string; user_name: string | null }
export interface LeadDetail extends Lead {
  notes: string | null; ai_qualification: LeadQualification | null; ai_qualified_at: string | null; events: LeadEvent[];
}

export interface LeadStats { by_status: Partial<Record<LeadStatus, number>>; by_source: Partial<Record<LeadSource, number>>; hot_open: number }

export const listLeads = (params: { page?: number; status?: string; source?: string; temperature?: string; search?: string }) =>
  api.get<{ data: Lead[]; total: number; total_pages: number }>('/leads', { params: { per_page: 25, ...params } }).then((r) => r.data);
export const getLeadStats = () => api.get<LeadStats>('/leads/stats').then((r) => r.data);
export const getLead = (id: string) => api.get<LeadDetail>(`/leads/${id}`).then((r) => r.data);
export const createLead = (input: { name?: string; email?: string; phone?: string; company?: string; message?: string }) =>
  api.post<LeadDetail>('/leads', input).then((r) => r.data);
export const updateLead = (id: string, input: Partial<{ status: LeadStatus; notes: string | null; name: string; email: string; phone: string; company: string }>) =>
  api.patch<LeadDetail>(`/leads/${id}`, input).then((r) => r.data);
export const deleteLead = (id: string) => api.delete(`/leads/${id}`);
export const addLeadNote = (id: string, body: string) => api.post<LeadDetail>(`/leads/${id}/notes`, { body }).then((r) => r.data);
export const convertLead = (id: string, list_ids?: string[]) => api.post<LeadDetail>(`/leads/${id}/convert`, { list_ids }).then((r) => r.data);
export const qualifyLead = (id: string) => api.post<LeadDetail>(`/leads/${id}/qualify`).then((r) => r.data);
export const replyLeadWhatsApp = (id: string, body: string) => api.post<LeadDetail>(`/leads/${id}/whatsapp-reply`, { body }).then((r) => r.data);
export const getLeadWebhook = () => api.get<{ url: string }>('/leads/webhook').then((r) => r.data);
export const rotateLeadWebhook = () => api.post<{ url: string }>('/leads/webhook/rotate').then((r) => r.data);
