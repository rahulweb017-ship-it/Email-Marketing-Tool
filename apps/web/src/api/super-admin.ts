import api from './client';

// Dashboard
export const getDashboard = () => api.get('/super-admin/dashboard');

// Tenants
export const listTenants = (params?: Record<string, string>) =>
  api.get('/super-admin/tenants', { params });

export const getTenant = (id: string) =>
  api.get(`/super-admin/tenants/${id}`);

export const createTenant = (data: {
  org_name: string;
  admin_email: string;
  admin_name: string;
  admin_password: string;
  plan_id?: string;
}) => api.post('/super-admin/tenants', data);

export const updateTenant = (id: string, data: Record<string, unknown>) =>
  api.patch(`/super-admin/tenants/${id}`, data);

export const updateTenantStatus = (id: string, data: { status: string; reason?: string }) =>
  api.patch(`/super-admin/tenants/${id}/status`, data);

export const getTenantUsers = (id: string) =>
  api.get(`/super-admin/tenants/${id}/users`);

export const getTenantUsage = (id: string) =>
  api.get(`/super-admin/tenants/${id}/usage`);

export const impersonateTenant = (id: string) =>
  api.post(`/super-admin/tenants/${id}/impersonate`);

// Plans
export const listPlans = () => api.get('/super-admin/plans');

export const createPlan = (data: Record<string, unknown>) =>
  api.post('/super-admin/plans', data);

export const updatePlan = (id: string, data: Record<string, unknown>) =>
  api.patch(`/super-admin/plans/${id}`, data);

export const deletePlan = (id: string) =>
  api.delete(`/super-admin/plans/${id}`);

// Tenant User Management
export const resetUserPassword = (orgId: string, userId: string) =>
  api.post(`/super-admin/tenants/${orgId}/users/${userId}/reset-password`, {});

export const updateUserStatus = (orgId: string, userId: string, is_active: boolean) =>
  api.patch(`/super-admin/tenants/${orgId}/users/${userId}/status`, { is_active });

// Tenant Deletion
export const deleteTenant = (id: string) =>
  api.delete(`/super-admin/tenants/${id}`);

// Audit
export const listAuditLogs = (params?: Record<string, string>) =>
  api.get('/super-admin/audit-logs', { params });
