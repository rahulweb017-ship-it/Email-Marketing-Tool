import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth.store';
import {
  LayoutDashboard, Building2, CreditCard, ClipboardList,
  LogOut, Shield, Inbox,
} from 'lucide-react';
import clsx from 'clsx';
import ToastContainer from './ui/Toast';
import ImpersonationBanner from './ImpersonationBanner';

const navItems = [
  { path: '/super-admin', label: 'Dashboard', icon: LayoutDashboard, hint: 'Platform totals and health' },
  { path: '/super-admin/tenants', label: 'Tenants', icon: Building2, hint: 'Customer companies and status' },
  { path: '/super-admin/plans', label: 'Plans', icon: CreditCard, hint: 'Pricing, limits and features' },
  { path: '/super-admin/enquiries', label: 'Enquiries', icon: Inbox, hint: 'Demo requests from the website' },
  { path: '/super-admin/audit-logs', label: 'Audit Logs', icon: ClipboardList, hint: 'Who changed what, and when' },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white flex flex-col dark:border-gray-800 dark:bg-gray-900">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Link to="/super-admin" className="flex items-center gap-2">
            <img src="/brand/logo.png" alt="Rabbit Growth" className="h-8 w-auto dark:hidden" />
            <img src="/brand/logo-white.png" alt="Rabbit Growth" className="hidden h-8 w-auto dark:block" />
          </Link>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-0.5 dark:bg-primary-950/50">
            <Shield className="h-3.5 w-3.5 text-primary-600" />
            <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/super-admin'
              ? location.pathname === '/super-admin'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.hint}
                className={clsx(
                  'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sa-nav-active"
                    className="absolute inset-0 rounded-lg border-l-[3px] border-primary-600 bg-primary-50 dark:bg-primary-950/50"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={clsx('relative h-5 w-5 shrink-0', isActive ? 'text-primary-600' : 'text-gray-400')} />
                <span className="relative min-w-0">
                  <span className={clsx('block leading-5', isActive && 'font-semibold')}>{item.label}</span>
                  <span className="block truncate text-[11px] leading-4 text-gray-400">{item.hint}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100 space-y-3 dark:border-gray-800">
          <div className="text-sm text-gray-500 truncate dark:text-gray-400">{user?.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-700 transition-colors dark:text-gray-400"
          >            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <ImpersonationBanner />
        <div className="p-8">{children}</div>
      </main>

      <ToastContainer />
    </div>
  );
}
