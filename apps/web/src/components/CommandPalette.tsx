import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Users, Send, FileText, ListChecks, X, ArrowRight } from 'lucide-react';
import api from '../api/client';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResults {
  contacts: Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>;
  campaigns: Array<{ id: string; name: string; subject: string; state: string }>;
  templates: Array<{ id: string; name: string; subject: string | null; category: string | null }>;
  lists: Array<{ id: string; name: string; contact_count: number }>;
}

interface ResultItem {
  id: string;
  type: 'contact' | 'campaign' | 'template' | 'list';
  label: string;
  sublabel: string;
  path: string;
}

const groupConfig = {
  contact: { label: 'Contacts', icon: Users, color: 'text-blue-500' },
  campaign: { label: 'Campaigns', icon: Send, color: 'text-green-500' },
  template: { label: 'Templates', icon: FileText, color: 'text-rose-500' },
  list: { label: 'Lists', icon: ListChecks, color: 'text-amber-500' },
};

function flattenResults(results: SearchResults): ResultItem[] {
  const items: ResultItem[] = [];

  results.contacts.forEach((c) => {
    items.push({
      id: c.id,
      type: 'contact',
      label: c.email,
      sublabel: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Contact',
      path: `/contacts/${c.id}`,
    });
  });

  results.campaigns.forEach((c) => {
    items.push({
      id: c.id,
      type: 'campaign',
      label: c.name || c.subject,
      sublabel: c.state,
      path: `/campaigns`,
    });
  });

  results.templates.forEach((t) => {
    items.push({
      id: t.id,
      type: 'template',
      label: t.name,
      sublabel: t.category || 'Template',
      path: `/templates/${t.id}/edit`,
    });
  });

  results.lists.forEach((l) => {
    items.push({
      id: l.id,
      type: 'list',
      label: l.name,
      sublabel: `${l.contact_count} contacts`,
      path: `/lists`,
    });
  });

  return items;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/search', { params: { q: q.trim() } });
      setResults(flattenResults(data));
      setActiveIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleSelect = (item: ResultItem) => {
    navigate(item.path);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Group results by type
  const grouped = results.reduce<Record<string, ResultItem[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {});

  let globalIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b dark:border-gray-700">
                <Search className="h-5 w-5 text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search contacts, campaigns, templates, lists..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <div className="flex items-center gap-1">
                  {query && (
                    <button onClick={() => { setQuery(''); setResults([]); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
                    ESC
                  </kbd>
                </div>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {loading && (
                  <div className="px-4 py-6 text-center">
                    <div className="inline-block h-5 w-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  </div>
                )}

                {!loading && query && results.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No results for "{query}"</p>
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="py-2">
                    {(Object.keys(grouped) as Array<keyof typeof groupConfig>).map((type) => {
                      const config = groupConfig[type];
                      const Icon = config.icon;
                      return (
                        <div key={type}>
                          <div className="px-4 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {config.label}
                          </div>
                          {grouped[type].map((item) => {
                            globalIndex++;
                            const idx = globalIndex;
                            const isActive = idx === activeIndex;
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                onMouseEnter={() => setActiveIndex(idx)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                  isActive
                                    ? 'bg-primary-50 dark:bg-primary-900/20'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                }`}
                              >
                                <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium dark:text-gray-100 truncate">{item.label}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.sublabel}</p>
                                </div>
                                {isActive && (
                                  <ArrowRight className="h-4 w-4 text-primary-500 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!loading && !query && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    Type to search across all your data...
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t dark:border-gray-700 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">↑</kbd>
                    <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">↵</kbd>
                    select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">⌘K</kbd>
                  toggle
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
