import api from './client';

// Accounts
export const listSocialAccounts = () => api.get('/social/accounts');
export const connectSocialAccount = (platform: string) => api.post('/social/accounts/connect', { platform });
export const disconnectSocialAccount = (id: string) => api.delete(`/social/accounts/${id}`);
export const verifySocialAccount = (id: string) => api.post(`/social/accounts/${id}/verify`);

// Posts
export const listSocialPosts = (params?: Record<string, string>) => api.get('/social/posts', { params });
export const getSocialPost = (id: string) => api.get(`/social/posts/${id}`);
export const createSocialPost = (data: Record<string, unknown>) => api.post('/social/posts', data);
export const updateSocialPost = (id: string, data: Record<string, unknown>) => api.patch(`/social/posts/${id}`, data);
export const deleteSocialPost = (id: string) => api.delete(`/social/posts/${id}`);
export const publishSocialPost = (id: string) => api.post(`/social/posts/${id}/publish`);
export const scheduleSocialPost = (id: string, data: { scheduled_at: string }) => api.post(`/social/posts/${id}/schedule`, data);
export const getCalendarPosts = (params: { start: string; end: string }) => api.get('/social/posts/calendar', { params });

// Metrics
export const getSocialPostMetrics = (id: string) => api.get(`/social/posts/${id}/metrics`);
