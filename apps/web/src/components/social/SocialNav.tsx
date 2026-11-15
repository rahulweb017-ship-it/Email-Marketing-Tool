import { NavLink } from 'react-router-dom';
import { CalendarDays, Lightbulb, BarChart3, MessageSquare, Send, Users } from 'lucide-react';

const TABS = [
  { to: '/social', label: 'Publish', icon: Send, end: true },
  { to: '/social/create', label: 'Create', icon: Lightbulb },
  { to: '/social/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/social/accounts', label: 'Channels', icon: Users },
];

const SOON = [
  { label: 'Insights', icon: BarChart3 },
  { label: 'Community', icon: MessageSquare },
];

export default function SocialNav() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b border-gray-200 dark:border-gray-700">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium ${
              isActive
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
      {SOON.map(({ label, icon: Icon }) => (
        <span key={label} title="Coming soon" className="-mb-px flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm text-gray-300 dark:text-gray-600">
          <Icon className="h-4 w-4" /> {label}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:bg-gray-800">Soon</span>
        </span>
      ))}
    </div>
  );
}
