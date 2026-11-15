import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, Send, Workflow, MessageCircle, Sparkles, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

const STEPS = [
  { icon: Users, title: 'Add your contacts', text: 'Import a CSV or add people one by one.', to: '/contacts' },
  { icon: Send, title: 'Send your first email', text: 'Pick a template, choose who gets it, send.', to: '/campaigns' },
  { icon: Workflow, title: 'Automate follow-ups', text: 'Welcome emails and reminders that run on their own.', to: '/automations' },
  { icon: MessageCircle, title: 'Connect WhatsApp & social', text: 'Reach customers where they already are.', to: '/whatsapp' },
  { icon: Sparkles, title: 'Ask Rabbit AI', text: 'Let AI write content and suggest what to do next.', to: '/copilot' },
];

export default function WelcomeGuide() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const storageKey = user ? `rg_welcome_seen:${user.id}` : '';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (storageKey && !localStorage.getItem(storageKey)) setOpen(true);
  }, [storageKey]);

  const close = () => {
    if (storageKey) localStorage.setItem(storageKey, '1');
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          >
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-6 text-white">
              <button onClick={close} className="absolute right-3 top-3 rounded-md p-1 text-white/80 hover:bg-white/10 hover:text-white" title="Close">
                <X className="h-5 w-5" />
              </button>
              <img src="/brand/logo-white.png" alt="Rabbit Growth" className="h-8 w-auto" />
              <h2 className="mt-4 text-xl font-bold">Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</h2>
              <p className="mt-1 text-sm text-primary-50">Here is how to get started. Every page also shows a short tip explaining what it does.</p>
            </div>
            <div className="space-y-1 p-4">
              {STEPS.map((s, i) => (
                <button
                  key={s.to}
                  onClick={() => { close(); navigate(s.to); }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-primary-50 dark:hover:bg-gray-700"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{i + 1}. {s.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.text}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end border-t border-gray-100 px-4 py-3 dark:border-gray-700">
              <button onClick={close} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
                Got it, let&apos;s go
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
