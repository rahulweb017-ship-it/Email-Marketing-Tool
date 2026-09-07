import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useToastStore, type ToastType } from '../../stores/toast.store';

const config: Record<ToastType, { icon: typeof Info; bg: string; text: string; progress: string }> = {
  success: { icon: CheckCircle, bg: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-800', text: 'text-green-800 dark:text-green-300', progress: 'bg-green-400' },
  error: { icon: AlertCircle, bg: 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-800', text: 'text-red-800 dark:text-red-300', progress: 'bg-red-400' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300', progress: 'bg-amber-400' },
  info: { icon: Info, bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300', progress: 'bg-blue-400' },
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-80">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const c = config[toast.type];
          const Icon = c.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className={clsx('relative overflow-hidden rounded-lg border shadow-lg', c.bg)}
            >
              <div className="flex items-start gap-3 p-3">
                <Icon className={clsx('h-5 w-5 mt-0.5 shrink-0', c.text)} />
                <p className={clsx('flex-1 text-sm', c.text)}>{toast.message}</p>
                <button onClick={() => removeToast(toast.id)} className={clsx('shrink-0 hover:opacity-70 transition-opacity', c.text)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              {/* Progress bar */}
              <motion.div
                className={clsx('h-0.5', c.progress)}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 4, ease: 'linear' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
