import { Twitter, Facebook, Instagram, Linkedin } from 'lucide-react';

const platformIcons: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  twitter: { icon: Twitter, color: 'text-sky-500', label: 'Twitter/X' },
  facebook: { icon: Facebook, color: 'text-blue-600', label: 'Facebook' },
  instagram: { icon: Instagram, color: 'text-pink-500', label: 'Instagram' },
  linkedin: { icon: Linkedin, color: 'text-blue-700', label: 'LinkedIn' },
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
  return platformIcons[platform] || { icon: Twitter, color: 'text-gray-400', label: platform };
}
