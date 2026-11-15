import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, X, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import api from '../api/client';
import { useNotificationStore } from '../stores/notification.store';
import { useToastStore } from '../stores/toast.store';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const typeIcons: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/30' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationCenter() {
  const addToast = useToastStore((s) => s.addToast);
  const { unreadCount, fetchUnreadCount, startPolling, stopPolling } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Start polling on mount
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: { per_page: 20 } });
      setNotifications(data.data);
    } catch {
      addToast('Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      fetchUnreadCount();
    } catch {
      addToast('Failed to mark notification as read', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      fetchUnreadCount();
    } catch {
      addToast('Failed to mark all as read', 'error');
    }
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <h3 className="text-sm font-semibold dark:text-gray-100">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center">
                  <div className="inline-block h-5 w-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
                </div>
              ) : (
                <div className="divide-y dark:divide-gray-700">
                  {notifications.map((notification) => {
                    const typeConfig = typeIcons[notification.type] || typeIcons.info;
                    const Icon = typeConfig.icon;
                    return (
                      <div
                        key={notification.id}
                        className={clsx(
                          'px-4 py-3 transition-colors cursor-default',
                          notification.is_read
                            ? 'opacity-60'
                            : 'bg-primary-50/50 dark:bg-primary-900/10',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg ${typeConfig.bg} shrink-0 mt-0.5`}>
                            <Icon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium dark:text-gray-100">{notification.title}</p>
                            {notification.body && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                {notification.body}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {timeAgo(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <button
                              onClick={() => handleMarkRead(notification.id)}
                              className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 shrink-0"
                              title="Mark as read"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
