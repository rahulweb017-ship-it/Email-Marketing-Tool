import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../../api/client';
import Badge from '../ui/Badge';
import Pagination from '../ui/Pagination';
import { Spinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import clsx from 'clsx';

interface WebhookLogViewerProps {
  webhookId: string;
}

interface WebhookLog {
  id: string;
  event_type: string;
  payload: string;
  response_status: number;
  response_body: string;
  duration_ms: number;
  success: boolean;
  created_at: string;
}

export default function WebhookLogViewer({ webhookId }: WebhookLogViewerProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const perPage = 15;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/outgoing-webhooks/${webhookId}/logs`, {
        params: { page, per_page: perPage },
      });
      setLogs(data.data);
      setTotal(data.total);
    } catch {
      addToast('Failed to load webhook logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [webhookId, page, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatPayload = (payloadStr: string) => {
    try {
      return JSON.stringify(JSON.parse(payloadStr), null, 2);
    } catch {
      return payloadStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">No delivery logs yet</p>
        <p className="text-xs text-gray-400 mt-1">Logs will appear here after webhook deliveries</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table header */}
      <div className="grid grid-cols-[1fr_100px_80px_100px_40px] gap-4 px-4 py-2 bg-gray-50 rounded-t-lg text-xs font-medium text-gray-500 uppercase tracking-wide">
        <span>Event</span>
        <span>Status</span>
        <span>Duration</span>
        <span>Timestamp</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y">
        {logs.map((log, i) => (
          <div key={log.id}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={clsx(
                'grid grid-cols-[1fr_100px_80px_100px_40px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-gray-50 transition-colors',
                expandedId === log.id && 'bg-gray-50',
              )}
              onClick={() => toggleExpand(log.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-700">{log.event_type}</span>
              </div>

              <div>
                <Badge variant={log.success ? 'success' : 'danger'}>
                  <span className="flex items-center gap-1">
                    {log.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {log.response_status || 'Error'}
                  </span>
                </Badge>
              </div>

              <span className="text-xs text-gray-500">{log.duration_ms}ms</span>

              <span className="text-xs text-gray-500">
                {new Date(log.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              <button className="p-1 text-gray-400">
                {expandedId === log.id ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </motion.div>

            {/* Expanded detail */}
            <AnimatePresence>
              {expandedId === log.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Request Payload</h4>
                      <pre className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-auto max-h-48 font-mono">
                        {formatPayload(log.payload)}
                      </pre>
                    </div>
                    {log.response_body && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Response</h4>
                        <pre className="bg-gray-100 text-gray-700 text-xs p-3 rounded-lg overflow-auto max-h-32 font-mono">
                          {log.response_body}
                        </pre>
                      </div>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>HTTP Status: <strong>{log.response_status || 'N/A'}</strong></span>
                      <span>Duration: <strong>{log.duration_ms}ms</strong></span>
                      <span>Time: <strong>{new Date(log.created_at).toLocaleString()}</strong></span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {total > perPage && (
        <Pagination page={page} total={total} perPage={perPage} onPageChange={setPage} />
      )}
    </div>
  );
}
