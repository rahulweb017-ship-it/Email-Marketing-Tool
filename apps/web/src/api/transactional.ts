import api from './client';

export const listTransactionalTemplates = () => api.get('/transactional/templates');
export const createTransactionalTemplate = (data: Record<string, unknown>) => api.post('/transactional/templates', data);
export const updateTransactionalTemplate = (id: string, data: Record<string, unknown>) => api.patch(`/transactional/templates/${id}`, data);
export const deleteTransactionalTemplate = (id: string) => api.delete(`/transactional/templates/${id}`);
export const sendTransactional = (data: Record<string, unknown>) => api.post('/transactional/send', data);
export const listTransactionalMessages = (params?: Record<string, string>) => api.get('/transactional/messages', { params });
