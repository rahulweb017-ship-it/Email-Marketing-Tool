import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Filter, Trash2, Edit, RefreshCw, Users } from 'lucide-react';
import api from '../api/client';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';
import SegmentBuilder from '../components/segments/SegmentBuilder';

interface Segment {
  id: string;
  name: string;
  description: string | null;
  filter_rules: {
    match: 'all' | 'any';
    rules: Array<{ field: string; operator: string; value?: string }>;
  };
  cached_count: number;
  last_computed_at: string | null;
  created_at: string;
}

export default function SegmentsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editSegment, setEditSegment] = useState<Segment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [computing, setComputing] = useState<string | null>(null);

  const perPage = 20;

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/segments', { params: { page, per_page: perPage } });
      setSegments(data.data);
      setTotal(data.total);
    } catch {
      addToast('Failed to load segments', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, addToast]);

  useEffect(() => { fetchSegments(); }, [fetchSegments]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/segments/${deleteTarget.id}`);
      addToast('Segment deleted', 'success');
      setDeleteTarget(null);
      fetchSegments();
    } catch {
      addToast('Failed to delete segment', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCompute = async (segmentId: string) => {
    setComputing(segmentId);
    try {
      const { data } = await api.post(`/segments/${segmentId}/compute`);
      addToast(`Segment recomputed: ${data.cached_count} contacts match`, 'success');
      fetchSegments();
    } catch {
      addToast('Failed to compute segment', 'error');
    } finally {
      setComputing(null);
    }
  };

  const handleEdit = (segment: Segment) => {
    setEditSegment(segment);
    setShowBuilder(true);
  };

  const handleBuilderClose = () => {
    setShowBuilder(false);
    setEditSegment(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-gray-100">Segments</h1>
        <button
          onClick={() => { setEditSegment(null); setShowBuilder(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Plus className="h-4 w-4" /> New Segment
        </button>
      </div>

      {loading ? (
        <CardGridSkeleton />
      ) : segments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <EmptyState
            icon={Filter}
            title="No segments yet"
            description="Create segments to group contacts by rules and conditions"
            action={{ label: 'Create Segment', onClick: () => setShowBuilder(true) }}
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {segments.map((segment, i) => (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
              >
                <div className="h-1 bg-gradient-to-r from-primary-500 to-rose-400" />
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg truncate flex-1 dark:text-gray-100">{segment.name}</h3>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => handleCompute(segment.id)}
                        disabled={computing === segment.id}
                        className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 disabled:opacity-50"
                        title="Recompute count"
                      >
                        <RefreshCw className={`h-4 w-4 ${computing === segment.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleEdit(segment)}
                        className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(segment)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {segment.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{segment.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                      <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">{segment.cached_count}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">contacts</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {segment.filter_rules?.match === 'any' ? 'Match ANY' : 'Match ALL'} - {segment.filter_rules?.rules?.length || 0} rule{(segment.filter_rules?.rules?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      Created {new Date(segment.created_at).toLocaleDateString()}
                    </span>
                    {segment.last_computed_at && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Computed {new Date(segment.last_computed_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <Pagination page={page} total={total} perPage={perPage} onPageChange={setPage} />
        </>
      )}

      <SegmentBuilder
        isOpen={showBuilder}
        onClose={handleBuilderClose}
        onSaved={fetchSegments}
        segment={editSegment}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Segment"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
