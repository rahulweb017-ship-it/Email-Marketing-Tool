import { create } from 'zustand';
import api from '../api/client';

interface User {
  id: string;
  org_id: string | null;
  email: string;
  name: string;
  role: string;
  is_super_admin: boolean;
  org_name?: string;
  plan_name?: string;
  plan_display_name?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (orgName: string, name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  startImpersonation: (tokens: { access_token: string; refresh_token: string }, user: User) => void;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: !!localStorage.getItem('access_token'),
  isImpersonating: !!localStorage.getItem('sa_access_token'),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (orgName, name, email, password) => {
    const { data } = await api.post('/auth/register', { org_name: orgName, name, email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: () => {
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('sa_access_token');
    localStorage.removeItem('sa_refresh_token');
    set({ user: null, isAuthenticated: false, isImpersonating: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({
        user: { ...data, is_super_admin: data.is_super_admin || false },
        isAuthenticated: true,
        isLoading: false,
        isImpersonating: !!localStorage.getItem('sa_access_token'),
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  startImpersonation: (tokens, user) => {
    // Save current super admin tokens
    const currentAccess = localStorage.getItem('access_token');
    const currentRefresh = localStorage.getItem('refresh_token');
    if (currentAccess) localStorage.setItem('sa_access_token', currentAccess);
    if (currentRefresh) localStorage.setItem('sa_refresh_token', currentRefresh);

    // Set impersonation tokens
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    set({ user, isAuthenticated: true, isImpersonating: true });
  },

  stopImpersonation: () => {
    // Restore super admin tokens
    const saAccess = localStorage.getItem('sa_access_token');
    const saRefresh = localStorage.getItem('sa_refresh_token');
    if (saAccess) localStorage.setItem('access_token', saAccess);
    if (saRefresh) localStorage.setItem('refresh_token', saRefresh);
    localStorage.removeItem('sa_access_token');
    localStorage.removeItem('sa_refresh_token');
    set({ isImpersonating: false });
    // Reload user to get super admin profile
    window.location.href = '/super-admin';
  },
}));
