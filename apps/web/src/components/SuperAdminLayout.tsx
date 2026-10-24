import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth.store';
import {
  LayoutDashboard, Building2, CreditCard, ClipboardList,
  LogOut, Shield, Mail,
} from 'lucide-react';
import clsx from 'clsx';
import ToastContainer from './ui/Toast';
import ImpersonationBanner from './ImpersonationBanner';

const navItems = [
  { path: '/super-admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/super-admin/tenants', label: 'Tenants', icon: Building2 },
  { path: '/super-admin/plans', label: 'Plans', icon: CreditCard },
  { path: '/super-admin/audit-logs', label: 'Audit Logs', icon: ClipboardList },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <Link to="/super-admin" className="flex items-center gap-2 text-xl font-bold">
            <Mail className="h-6 w-6 text-red-400" />
            <span className="bg-gradient-to-r from-white to-red-300 bg-clip-text text-transparent">
              Rabbit Growth
            </span>
          </Link>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs text-red-400 font-medium">Super Admin</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/super-admin'
              ? location.pathname === '/super-admin'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sa-nav-active"
                    className="absolute inset-0 bg-red-600 rounded-lg"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="text-sm text-gray-400 truncate">{user?.email}</div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
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
