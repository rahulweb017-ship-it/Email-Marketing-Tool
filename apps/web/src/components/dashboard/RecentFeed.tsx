import { formatDistanceToNow } from 'date-fns';
import { Eye, MousePointerClick, Target, MessageCircle, Share2, UserPlus, Activity, type LucideIcon } from 'lucide-react';
import type { HubRecent } from './types';
import { EmptyState, Panel } from './shared';

const TYPES: Record<string, { icon: LucideIcon; cls: string }> = {
  email_open: { icon: Eye, cls: 'text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300' },
  email_click: { icon: MousePointerClick, cls: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-300' },
  lead: { icon: Target, cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300' },
  whatsapp_in: { icon: MessageCircle, cls: 'text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300' },
  social_post: { icon: Share2, cls: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300' },
  contact: { icon: UserPlus, cls: 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300' },
};

function ago(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
}

export default function RecentFeed({ items }: { items: HubRecent[] }) {
  return (
    <Panel title="Recent activity" hint="The latest things that happened across every channel">
      {items.length === 0 ? (
        <EmptyState text="No activity yet. It will show up here as soon as people interact." />
      ) : (
        <ul className="space-y-1 max-h-[360px] overflow-y-auto -mx-2">
          {items.map((item, i) => {
            const cfg = TYPES[item.type] ?? { icon: Activity, cls: 'text-gray-500 bg-gray-100 dark:bg-gray-700' };
            const Icon = cfg.icon;
            return (
              <li key={`${item.type}-${item.at}-${i}`} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className={`p-1.5 rounded-md ${cfg.cls}`}><Icon className="h-3.5 w-3.5" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.title || 'Activity'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.subtitle}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{ago(item.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
