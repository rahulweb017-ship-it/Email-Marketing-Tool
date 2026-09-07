import { create } from 'zustand';
import api from '../api/client';

interface NotificationState {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      set({ unreadCount: data.count });
    } catch {
      // Silently fail — notification count is non-critical
    }
  },

  startPolling: () => {
    // Fetch immediately
    useNotificationStore.getState().fetchUnreadCount();

    // Then every 30 seconds
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      useNotificationStore.getState().fetchUnreadCount();
    }, 30000);
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  },
}));
