import api from './client';

export const getContactConsent = (contactId: string) =>
  api.get(`/consent/contacts/${contactId}/consent`);

export const grantConsent = (contactId: string, data: { consent_type: string; source: string }) =>
  api.post(`/consent/contacts/${contactId}/consent`, data);

export const revokeConsent = (contactId: string, type: string) =>
  api.delete(`/consent/contacts/${contactId}/consent/${type}`);

export const exportConsent = () =>
  api.get('/consent/export');

export const getConsentOverview = () =>
  api.get('/consent/overview');

export const getRecentConsentChanges = () =>
  api.get('/consent/recent-changes');
