import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, ListChecks, Edit, Trash2, Users } from 'lucide-react';
import api from '../api/client';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';
import ListFormModal from '../components/lists/ListFormModal';
import ManageSubscribersModal from '../components/lists/ManageSubscribersModal';

interface MailingList {
  id: string;
  name: string;
  description: string | null;
  contact_count: number;
  contact_count_active: number;
  contact_count_opt_out: number;
  is_active: boolean;
  is_public: boolean;
  is_double_optin: boolean;
  created_at: string;
}

export default function ListsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [lists, setLists] = useState<MailingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editList, setEditList] = useState<MailingList | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MailingList | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [manageList, setManageList] = useState<MailingList | null>(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/lists', { params: { per_page: 100 } });
      setLists(data.data);
    } catch {
      addToast('Failed to load lists', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchLists(); }, [fetchLists]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/lists/${deleteTarget.id}`);
      addToast('List deleted', 'success');
      setDeleteTarget(null);
      fetchLists();
    } catch {
      addToast('Failed to delete list', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-gray-100">Mailing Lists</h1>
        <button onClick={() => { setEditList(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          <Plus className="h-4 w-4" /> New List
        </button>
      </div>

      {loading ? <CardGridSkeleton /> : lists.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <EmptyState icon={ListChecks} title="No mailing lists yet" description="Create your first mailing list to organize contacts"
            action={{ label: 'Create List', onClick: () => setShowForm(true) }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lists.map((list, i) => (
            <motion.div
              key={list.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-primary-500 to-primary-300" />
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg dark:text-gray-100">{list.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditList(list); setShowForm(true); }} className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400" title="Edit">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(list)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {list.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{list.description}</p>}
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{list.contact_count_active}</p><p className="text-xs text-gray-500 dark:text-gray-400">Active</p></div>
                  <div><p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{list.contact_count_opt_out}</p><p className="text-xs text-gray-500 dark:text-gray-400">Opted Out</p></div>
                  <div><p className="text-2xl font-bold text-gray-400 dark:text-gray-500">{list.contact_count}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total</p></div>
                </div>
                <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-between items-center">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Created {new Date(list.created_at).toLocaleDateString()}</span>
                  <button onClick={() => setManageList(list)} className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline">
                    <Users className="h-3.5 w-3.5" /> Manage
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ListFormModal isOpen={showForm} onClose={() => { setShowForm(false); setEditList(null); }} onSaved={fetchLists} list={editList} />
      {manageList && <ManageSubscribersModal isOpen={!!manageList} onClose={() => setManageList(null)} listId={manageList.id} listName={manageList.name} />}
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete List" message={`Are you sure you want to delete "${deleteTarget?.name}"? Subscribers will not be deleted.`}
        confirmLabel="Delete" variant="danger" loading={deleting} />
    </div>
  );
}
