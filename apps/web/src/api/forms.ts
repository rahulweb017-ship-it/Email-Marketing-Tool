import api from './client';

export const listForms = () => api.get('/forms');
export const getForm = (id: string) => api.get(`/forms/${id}`);
export const createForm = (data: Record<string, unknown>) => api.post('/forms', data);
export const updateForm = (id: string, data: Record<string, unknown>) => api.patch(`/forms/${id}`, data);
export const deleteForm = (id: string) => api.delete(`/forms/${id}`);
export const getFormEmbed = (id: string) => api.get(`/forms/${id}/embed`);
