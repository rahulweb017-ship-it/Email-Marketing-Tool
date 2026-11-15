import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function Panel({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 ${className}`}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function EmptyState({ text, cta, to }: { text: string; cta?: string; to?: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
      {cta && to && (
        <button
          onClick={() => navigate(to)}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50 transition-colors"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

export function Bar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">
          {value.toLocaleString()}{suffix && <span className="font-normal text-gray-400 ml-1">{suffix}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
