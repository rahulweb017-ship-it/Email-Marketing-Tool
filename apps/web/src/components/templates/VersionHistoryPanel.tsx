import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History, RotateCcw, Eye, ChevronRight } from 'lucide-react';
import api from '../../api/client';
import { useToastStore } from '../../stores/toast.store';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';

interface VersionHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  onRestored?: () => void;
}

interface Version {
  id: string;
  version_number: number;
  name: string;
  subject: string | null;
  body_html?: string;
  body_design?: string;
  created_at: string;
}

export default function VersionHistoryPanel({ isOpen, onClose, templateId, onRestored }: VersionHistoryPanelProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Version | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/templates/${templateId}/versions`, {
        params: { per_page: 50 },
      });
      setVersions(data.data);
    } catch {
      addToast('Failed to load version history', 'error');
    } finally {
      setLoading(false);
    }
  }, [templateId, addToast]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      setPreviewVersion(null);
    }
  }, [isOpen, fetchVersions]);

  const handlePreview = async (version: Version) => {
    setLoadingPreview(true);
    try {
      const { data } = await api.get(`/templates/${templateId}/versions/${version.id}`);
      setPreviewVersion(data);
    } catch {
      addToast('Failed to load version preview', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await api.post(`/templates/${templateId}/versions/${restoreTarget.id}/restore`);
      addToast(`Restored to version ${restoreTarget.version_number}`, 'success');
      setRestoreTarget(null);
      setPreviewVersion(null);
      onRestored?.();
      onClose();
    } catch {
      addToast('Failed to restore version', 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold dark:text-gray-100">Version History</h2>
              </div>
              <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <History className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No version history</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Versions are created automatically when you edit the template content.
                  </p>
                </div>
              ) : previewVersion ? (
                /* Version Preview */
                <div className="flex flex-col h-full">
                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700 flex items-center gap-2">
                    <button
                      onClick={() => setPreviewVersion(null)}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                    >
                      <ChevronRight className="h-3 w-3 rotate-180" />
                      Back to list
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      / Version {previewVersion.version_number}
                    </span>
                  </div>
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-medium dark:text-gray-100">
                          Version {previewVersion.version_number}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(previewVersion.created_at).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setRestoreTarget(previewVersion)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </button>
                    </div>
                    {previewVersion.subject && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <span className="font-medium">Subject:</span> {previewVersion.subject}
                      </p>
                    )}
                  </div>
                  <div className="flex-1 px-6 pb-6">
                    <div className="border dark:border-gray-700 rounded-lg overflow-hidden h-80">
                      {previewVersion.body_html ? (
                        <iframe
                          srcDoc={previewVersion.body_html}
                          className="w-full h-full bg-white"
                          title={`Version ${previewVersion.version_number} preview`}
                          sandbox=""
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
                          No content preview available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Version List */
                <div className="divide-y dark:divide-gray-700">
                  {versions.map((version, i) => (
                    <motion.div
                      key={version.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                      className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold">
                              {version.version_number}
                            </span>
                            <h4 className="text-sm font-medium dark:text-gray-100 truncate">
                              {version.name}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3 mt-1 ml-8">
                            {version.subject && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {version.subject}
                              </span>
                            )}
                            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                              {new Date(version.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handlePreview(version)}
                            disabled={loadingPreview}
                            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setRestoreTarget(version)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Restore this version"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          <ConfirmDialog
            isOpen={!!restoreTarget}
            onClose={() => setRestoreTarget(null)}
            onConfirm={handleRestore}
            title="Restore Version"
            message={`Are you sure you want to restore version ${restoreTarget?.version_number}? The current template content will be saved as a new version before restoring.`}
            confirmLabel="Restore"
            variant="warning"
            loading={restoring}
          />
        </>
      )}
    </AnimatePresence>
  );
}
