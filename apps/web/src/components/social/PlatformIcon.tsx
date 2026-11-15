import { Twitter, Facebook, Instagram, Linkedin, Youtube, AtSign, Pin } from 'lucide-react';

const platformIcons: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; label: string }> = {
  twitter: { icon: Twitter, color: 'text-sky-500', bg: 'bg-sky-500', label: 'Twitter/X' },
  facebook: { icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-600', label: 'Facebook' },
  instagram: { icon: Instagram, color: 'text-pink-500', bg: 'bg-pink-500', label: 'Instagram' },
  linkedin: { icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-700', label: 'LinkedIn' },
  youtube: { icon: Youtube, color: 'text-red-600', bg: 'bg-red-600', label: 'YouTube' },
  threads: { icon: AtSign, color: 'text-gray-900 dark:text-gray-100', bg: 'bg-gray-900', label: 'Threads' },
  pinterest: { icon: Pin, color: 'text-red-700', bg: 'bg-red-700', label: 'Pinterest' },
};

interface PlatformIconProps {
  platform: string;
  size?: number;
  showLabel?: boolean;
}

export default function PlatformIcon({ platform, size = 18, showLabel = false }: PlatformIconProps) {
  const config = platformIcons[platform];
  if (!config) return <span className="text-gray-400 text-xs">{platform}</span>;

  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className={config.color} size={size} />
      {showLabel && <span className="text-sm text-gray-700 dark:text-gray-300">{config.label}</span>}
    </span>
  );
}

export function getPlatformConfig(platform: string) {
  return platformIcons[platform] || { icon: Twitter, color: 'text-gray-400', bg: 'bg-gray-400', label: platform };
}

/** Avatar with a small platform badge in the corner, like Buffer's channel list. */
export function ChannelAvatar({ platform, name, avatarUrl, size = 36, dimmed = false }: {
  platform: string; name?: string | null; avatarUrl?: string | null; size?: number; dimmed?: boolean;
}) {
  const cfg = getPlatformConfig(platform);
  const Icon = cfg.icon;
  const badge = Math.max(14, Math.round(size * 0.45));
  return (
    <span className={`relative inline-block shrink-0 ${dimmed ? 'opacity-40 grayscale' : ''}`} style={{ width: size, height: size }} title={name || cfg.label}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover border border-gray-200 dark:border-gray-700" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {(name || cfg.label).replace(/^@/, '').slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-800 ${cfg.bg}`} style={{ width: badge, height: badge }}>
        <Icon size={Math.round(badge * 0.62)} className="text-white" />
      </span>
    </span>
  );
}
