import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';

export interface Kpi {
  title: string;
  hint: string;
  value: number;
  secondary: string;
  icon: LucideIcon;
  iconClass: string;
  to: string;
}

function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const navigate = useNavigate();
  const animated = useCountUp(kpi.value);
  const Icon = kpi.icon;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={() => navigate(kpi.to)}
      className="text-left bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{kpi.title}</p>
          <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">{kpi.hint}</p>
        </div>
        <div className={`p-2 rounded-lg shrink-0 ${kpi.iconClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold mt-3 tracking-tight text-gray-900 dark:text-gray-100">{animated.toLocaleString()}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{kpi.secondary}</p>
    </motion.button>
  );
}

export default function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {items.map((k, i) => <KpiCard key={k.title} kpi={k} index={i} />)}
    </div>
  );
}
