import clsx from 'clsx';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variants: Record<Variant, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const pulseDotColors: Record<Variant, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-500',
};

export default function Badge({ children, variant = 'neutral', pulse }: { children: React.ReactNode; variant?: Variant; pulse?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full', variants[variant])}>
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={clsx('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', pulseDotColors[variant])} />
          <span className={clsx('relative inline-flex rounded-full h-2 w-2', pulseDotColors[variant])} />
        </span>
      )}
      {children}
    </span>
  );
}
