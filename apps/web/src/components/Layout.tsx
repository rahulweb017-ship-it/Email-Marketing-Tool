import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth.store';
import { useThemeStore } from '../stores/theme.store';
import {
  LayoutDashboard, Users, ListChecks, Send, FileText,
  Workflow, Settings, LogOut, Mail, Globe, ChevronDown,
  Sun, Moon, Monitor, Search, Filter, Zap, Share2, MessageCircle,
} from 'lucide-react';
import clsx from 'clsx';
import ToastContainer from './ui/Toast';
import NotificationCenter from './NotificationCenter';
import CommandPalette from './CommandPalette';
import ImpersonationBanner from './ImpersonationBanner';

const navItems = [
  { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/contacts', labelKey: 'nav.contacts', icon: Users },
  { path: '/lists', labelKey: 'nav.lists', icon: ListChecks },
  { path: '/campaigns', labelKey: 'nav.campaigns', icon: Send },
  { path: '/templates', labelKey: 'nav.templates', icon: FileText },
  { path: '/automations', labelKey: 'nav.automations', icon: Workflow },
  { path: '/segments', labelKey: 'nav.segments', icon: Filter },
  { path: '/transactional', labelKey: 'nav.transactional', icon: Zap },
  { path: '/social', labelKey: 'nav.social', icon: Share2 },
  { path: '/whatsapp', labelKey: 'nav.whatsapp', icon: MessageCircle },
  // { path: '/forms', labelKey: 'nav.forms', icon: FileInput }, // Hidden — managed from super admin
  { path: '/settings', labelKey: 'nav.settings', icon: Settings },
];

const languages = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'es', label: 'ES', name: 'Espanol' },
  { code: 'fr', label: 'FR', name: 'Francais' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
];

const themeOptions = [
  { value: 'light' as const, icon: Sun, label: 'Light' },
  { value: 'dark' as const, icon: Moon, label: 'Dark' },
  { value: 'system' as const, icon: Monitor, label: 'System' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { t, i18n } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langOpen]);

  // Global Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setLangOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <motion.div
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              <Mail className="h-6 w-6 text-primary-400" />
            </motion.div>
            <span className="bg-gradient-to-r from-white to-primary-300 bg-clip-text text-transparent">
              Rabbit Growth
            </span>
          </Link>
        </div>

        {/* Search Trigger */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 bg-gray-800 rounded-lg hover:bg-gray-700 hover:text-gray-300 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-gray-700 rounded">
              {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-primary-600 rounded-lg"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-3">
          {/* Theme Toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors',
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-gray-300',
                  )}
                  title={opt.label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Language Selector */}
          <div ref={langRef} className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Globe className="h-4 w-4" />
              <span>{currentLang.name}</span>
              <ChevronDown className={clsx('h-3 w-3 ml-auto transition-transform', langOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 rounded-lg border border-gray-700 py-1 z-50 shadow-lg"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                        i18n.language === lang.code
                          ? 'text-primary-400 bg-gray-700/50'
                          : 'text-gray-300 hover:text-white hover:bg-gray-700',
                      )}
                    >
                      <span className="font-medium w-6">{lang.label}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notification Center + User Info */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400 truncate flex-1">{user?.email}</div>
            <NotificationCenter />
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t('auth.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <ImpersonationBanner />
        <AnimatePresence mode="popLayout">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="p-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <ToastContainer />
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
