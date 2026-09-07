import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { listAuditLogs } from '../../api/super-admin';
import { useToastStore } from '../../stores/toast.store';

interface AuditLog {
  id: string;
  action: string;
  admin_name: string;
  admin_email: string;
  target_org_name: string | null;
  details: Record<string, unknown> | string;
  ip_address: string | null;
  created_at: string;
}

export default function SuperAdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    listAuditLogs({ page: String(page), per_page: '25' })
      .then(({ data }) => {
        setLogs(data.data);
        setTotal(data.total);
      })
      .catch(() => addToast('Failed to load audit logs', 'error'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const parseDetails = (details: Record<string, unknown> | string): Record<string, unknown> => {
    if (typeof details === 'string') {
      try { return JSON.parse(details); } catch { return {}; }
    }
    return details || {};
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Audit Logs</h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Admin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Target Org</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No audit logs</td></tr>
            ) : logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const details = parseDetails(log.details);
              const hasDetails = Object.keys(details).length > 0;
              return (
                <>
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}>
                    <td className="px-2 py-3 text-gray-400">
                      {hasDetails && (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{log.admin_name || log.admin_email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{log.target_org_name || '-'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ip_address || '-'}</td>
                  </tr>
                  {isExpanded && hasDetails && (
                    <tr key={`${log.id}-details`}>
                      <td colSpan={6} className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50">
                        <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono">
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 25 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">{total} total logs</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              Previous
            </button>
            <button
              disabled={page * 25 >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
