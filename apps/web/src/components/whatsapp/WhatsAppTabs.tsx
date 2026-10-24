import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessagesSquare, Megaphone, FileText, Smartphone, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const tabs = [
  { to: '/whatsapp', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/whatsapp/inbox', label: 'Inbox', icon: MessagesSquare },
  { to: '/whatsapp/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/whatsapp/templates', label: 'Templates', icon: FileText },
  { to: '/whatsapp/accounts', label: 'Numbers', icon: Smartphone },
  { to: '/whatsapp/ai', label: 'AI Assistant', icon: Sparkles },
];

/** Section header + sub-navigation shared by every WhatsApp page. */
export default function WhatsAppTabs({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => clsx(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              isActive
                ? 'border-green-600 text-green-700 dark:text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
