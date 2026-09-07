import api from './client';

export const listCustomFields = () => api.get('/custom-fields');
export const createCustomField = (data: Record<string, unknown>) => api.post('/custom-fields', data);
export const updateCustomField = (id: string, data: Record<string, unknown>) => api.patch(`/custom-fields/${id}`, data);
export const deleteCustomField = (id: string) => api.delete(`/custom-fields/${id}`);
