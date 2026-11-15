import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth.store';
import { useThemeStore } from '../stores/theme.store';
import {
  LayoutDashboard, Users, ListChecks, Send, FileText,
  Workflow, Settings, LogOut, Globe, ChevronDown,
  Sun, Moon, Monitor, Search, Filter, Zap, Share2, MessageCircle, Sparkles, Inbox, Lightbulb,
} from 'lucide-react';
import clsx from 'clsx';
import ToastContainer from './ui/Toast';
import NotificationCenter from './NotificationCenter';
import CommandPalette from './CommandPalette';
import ImpersonationBanner from './ImpersonationBanner';
import PageIntro from './help/PageIntro';
import WelcomeGuide from './help/WelcomeGuide';
import { useHelpStore } from './help/helpData';

const navGroups: { title: string; items: { path: string; labelKey: string; icon: typeof LayoutDashboard; hint: string }[] }[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, hint: 'Your results at a glance' },
      { path: '/copilot', labelKey: 'nav.copilot', icon: Sparkles, hint: 'Ask AI to help you' },
    ],
  },
  {
    title: 'Audience',
    items: [
      { path: '/leads', labelKey: 'nav.leads', icon: Inbox, hint: 'New enquiries, AI-scored' },
      { path: '/contacts', labelKey: 'nav.contacts', icon: Users, hint: 'Everyone you can message' },
      { path: '/lists', labelKey: 'nav.lists', icon: ListChecks, hint: 'Fixed groups of contacts' },
      { path: '/segments', labelKey: 'nav.segments', icon: Filter, hint: 'Auto-updating smart groups' },
    ],
  },
  {
    title: 'Email',
    items: [
      { path: '/campaigns', labelKey: 'nav.campaigns', icon: Send, hint: 'Send emails to many people' },
      { path: '/templates', labelKey: 'nav.templates', icon: FileText, hint: 'Reusable email designs' },
      { path: '/automations', labelKey: 'nav.automations', icon: Workflow, hint: 'Emails that send themselves' },
      { path: '/transactional', labelKey: 'nav.transactional', icon: Zap, hint: 'Receipts, resets via API' },
    ],
  },
  {
    title: 'Channels',
    items: [
      { path: '/whatsapp', labelKey: 'nav.whatsapp', icon: MessageCircle, hint: 'Campaigns and customer chat' },
      { path: '/social', labelKey: 'nav.social', icon: Share2, hint: 'Schedule social posts' },
    ],
  },
  {
    title: 'Account',
    items: [
      { path: '/settings', labelKey: 'nav.settings', icon: Settings, hint: 'Team, domains, billing' },
    ],
  },
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
  const { tipsOn, setTipsOn } = useHelpStore();
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
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col dark:border-gray-800 dark:bg-gray-900">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold">
            <motion.img
              src="/brand/logo.png"
              alt="Rabbit Growth"
              className="h-8 w-auto dark:hidden"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            />
            <img src="/brand/logo-white.png" alt="Rabbit Growth" className="hidden h-8 w-auto dark:block" />
          </Link>
        </div>

        {/* Search Trigger */}
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 bg-gray-100 border border-gray-200 rounded-lg hover:border-primary-300 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-white border border-gray-200 rounded dark:bg-gray-700 dark:border-gray-600">
              {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}K
            </kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mt-4 first:mt-1">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.path === '/'
                    ? location.pathname === '/'
                    : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.hint}
                      className={clsx(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute inset-0 rounded-lg border-l-[3px] border-primary-600 bg-primary-50 dark:bg-primary-950/50"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <Icon className={clsx('relative h-5 w-5 shrink-0', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500')} />
                      <span className="relative min-w-0">
                        <span className={clsx('block leading-5', isActive && 'font-semibold')}>{t(item.labelKey)}</span>
                        {tipsOn && <span className="block truncate text-[11px] leading-4 text-gray-400 dark:text-gray-500">{item.hint}</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-3 dark:border-gray-800">
          <button
            onClick={() => setTipsOn(!tipsOn)}
            className={clsx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors', tipsOn ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}
            title="Show or hide the short explanations on each page"
          >
            <Lightbulb className="h-4 w-4" />
            <span className="flex-1 text-left">Beginner tips</span>
            <span className={clsx('h-4 w-7 rounded-full p-0.5 transition-colors', tipsOn ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600')}>
              <span className={clsx('block h-3 w-3 rounded-full bg-white transition-transform', tipsOn && 'translate-x-3')} />
            </span>
          </button>
          {/* Theme Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 dark:bg-gray-800">
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
                      ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
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
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
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
                  className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 py-1 z-50 shadow-lg"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                        i18n.language === lang.code
                          ? 'text-primary-700 bg-primary-50 dark:text-primary-300 dark:bg-gray-700/50'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700',
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
            <div className="text-sm text-gray-500 truncate flex-1 dark:text-gray-400">{user?.email}</div>
            <NotificationCenter />
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 transition-colors dark:text-gray-400 dark:hover:text-white"
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
            <PageIntro pathname={location.pathname} />
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <ToastContainer />
      <WelcomeGuide />
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
