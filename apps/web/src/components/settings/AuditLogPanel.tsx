import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Send, Calendar, LogIn,
  ChevronDown, ChevronUp, FileText, Download, Upload,
  XCircle, Activity,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import Badge from '../ui/Badge';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import { TableSkeleton } from '../ui/Skeleton';
import { useToastStore } from '../../stores/toast.store';
import type { LucideIcon } from 'lucide-react';

interface AuditLog {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: string | Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const actionConfig: Record<string, { icon: LucideIcon; variant: 'success' | 'info' | 'danger' | 'warning' | 'neutral' }> = {
  create: { icon: Plus, variant: 'success' },
  update: { icon: Pencil, variant: 'info' },
  delete: { icon: Trash2, variant: 'danger' },
  send: { icon: Send, variant: 'info' },
  schedule: { icon: Calendar, variant: 'info' },
  cancel: { icon: XCircle, variant: 'warning' },
  login: { icon: LogIn, variant: 'neutral' },
  import: { icon: Upload, variant: 'neutral' },
  export: { icon: Download, variant: 'neutral' },
};

const ENTITY_TYPES = [
  'campaign', 'contact', 'template', 'list',
  'automation', 'sending_config', 'api_key', 'webhook', 'segment', 'user',
];

const ACTION_TYPES = [
  'create', 'update', 'delete', 'send',
  'schedule', 'cancel', 'login', 'import', 'export',
];

function parseChanges(changes: string | Record<string, unknown> | null): Record<string, unknown> | null {
  if (!changes) return null;
  if (typeof changes === 'string') {
    try { return JSON.parse(changes); } catch { return null; }
  }
  return changes;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AuditLogPanel() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Filters
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: perPage };
      if (entityType) params.entity_type = entityType;
      if (action) params.action = action;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const { data } = await api.get<AuditResponse>('/audit-logs', { params });
      setLogs(data.data);
      setTotal(data.total);
    } catch {
      addToast('Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, dateFrom, dateTo, addToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [entityType, action, dateFrom, dateTo]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getActionDisplay = (actionKey: string) => {
    const config = actionConfig[actionKey] || { icon: Activity, variant: 'neutral' as const };
    const Icon = config.icon;
    const label = t(`audit.actions.${actionKey}`, actionKey);
    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getEntityLabel = (entityKey: string) => {
    return t(`audit.entities.${entityKey}`, entityKey);
  };

  return (
    <div>
      {/* Filters Row */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('audit.filters.entityType')}
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">{t('audit.filters.allEntities')}</option>
            {ENTITY_TYPES.map((et) => (
              <option key={et} value={et}>{t(`audit.entities.${et}`, et)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('audit.filters.action')}
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">{t('audit.filters.allActions')}</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>{t(`audit.actions.${a}`, a)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('audit.filters.dateFrom')}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {t('audit.filters.dateTo')}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        {(entityType || action || dateFrom || dateTo) && (
          <button
            onClick={() => { setEntityType(''); setAction(''); setDateFrom(''); setDateTo(''); }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('common.reset')}
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton count={8} />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('audit.noLogs')}
          description={t('audit.noLogsDescription')}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  {t('audit.timestamp')}
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  {t('audit.action')}
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  {t('audit.entityType')}
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  {t('audit.entityId')}
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  {t('audit.ipAddress')}
                </th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              <AnimatePresence initial={false}>
                {logs.map((log, index) => {
                  const isExpanded = expandedRows.has(log.id);
                  const changes = parseChanges(log.changes);
                  const hasChanges = changes && Object.keys(changes).length > 0;

                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.25 }}
                      className="group"
                    >
                      <td colSpan={6} className="p-0">
                        {/* Main row */}
                        <div
                          className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${hasChanges ? '' : 'cursor-default'}`}
                          onClick={() => hasChanges && toggleRow(log.id)}
                        >
                          <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                            <div className="text-sm text-gray-700">
                              {formatDate(log.created_at)}
                            </div>
                            <div>
                              {getActionDisplay(log.action)}
                            </div>
                            <div className="text-sm text-gray-700">
                              {getEntityLabel(log.entity_type)}
                            </div>
                            <div className="text-sm text-gray-500 font-mono truncate" title={log.entity_id || ''}>
                              {log.entity_id ? log.entity_id.substring(0, 8) + '...' : '-'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {log.ip_address || '-'}
                            </div>
                          </div>
                          <div className="w-10 flex justify-center">
                            {hasChanges && (
                              isExpanded
                                ? <ChevronUp className="h-4 w-4 text-gray-400" />
                                : <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded changes detail */}
                        <AnimatePresence>
                          {isExpanded && hasChanges && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4">
                                <div className="bg-gray-50 rounded-lg p-4 border">
                                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
                                    {t('audit.changes')}
                                  </h4>
                                  <div className="space-y-2">
                                    {Object.entries(changes!).map(([field, value]) => {
                                      const change = value as { old?: unknown; new?: unknown } | unknown;
                                      const isFieldChange =
                                        typeof change === 'object' &&
                                        change !== null &&
                                        ('old' in change || 'new' in change);

                                      if (isFieldChange) {
                                        const typed = change as { old?: unknown; new?: unknown };
                                        return (
                                          <div key={field} className="flex items-start gap-2 text-sm">
                                            <span className="font-medium text-gray-700 min-w-[120px]">
                                              {field}
                                            </span>
                                            <span className="text-gray-400">{t('audit.fieldChanged')}</span>
                                            <span className="text-red-600 line-through">
                                              {typed.old !== undefined && typed.old !== null
                                                ? String(typed.old)
                                                : '-'}
                                            </span>
                                            <span className="text-gray-400">&rarr;</span>
                                            <span className="text-green-600 font-medium">
                                              {typed.new !== undefined && typed.new !== null
                                                ? String(typed.new)
                                                : '-'}
                                            </span>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div key={field} className="flex items-start gap-2 text-sm">
                                          <span className="font-medium text-gray-700 min-w-[120px]">
                                            {field}
                                          </span>
                                          <span className="text-gray-600">
                                            {typeof change === 'object'
                                              ? JSON.stringify(change, null, 2)
                                              : String(change)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>

          <div className="px-4 pb-4">
            <Pagination
              page={page}
              total={total}
              perPage={perPage}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
