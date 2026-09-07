import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Tag, ListPlus, ShieldBan, X, CheckCircle } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onAction: (action: string, extraId?: string) => void;
  onClear: () => void;
}

export default function BulkActionBar({ selectedCount, onAction, onClear }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
      >
        <div className="flex items-center gap-3 px-6 py-3 bg-gray-900 text-white rounded-xl shadow-2xl">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedCount} selected
          </span>

          <div className="h-5 w-px bg-gray-600" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => onAction('delete')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-red-600/20 text-red-300 hover:text-red-200 transition-colors"
              title="Delete selected"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <button
              onClick={() => onAction('tag')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Tag selected"
            >
              <Tag className="h-4 w-4" /> Tag
            </button>
            <button
              onClick={() => onAction('add_to_list')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
              title="Add to list"
            >
              <ListPlus className="h-4 w-4" /> Add to List
            </button>
            <button
              onClick={() => onAction('validate')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-green-600/20 text-green-300 hover:text-green-200 transition-colors"
              title="Validate selected"
            >
              <CheckCircle className="h-4 w-4" /> Validate
            </button>
            <button
              onClick={() => onAction('blacklist')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-amber-600/20 text-amber-300 hover:text-amber-200 transition-colors"
              title="Blacklist selected"
            >
              <ShieldBan className="h-4 w-4" /> Blacklist
            </button>
          </div>

          <div className="h-5 w-px bg-gray-600" />

          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
