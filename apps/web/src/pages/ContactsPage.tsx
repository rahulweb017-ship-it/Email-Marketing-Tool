import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Upload, Users, Edit, Trash2, Download, CheckCircle, RefreshCw, Star } from 'lucide-react';
import api from '../api/client';
import Pagination from '../components/ui/Pagination';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import DropdownMenu from '../components/ui/DropdownMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Modal from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/Skeleton';
import { useToastStore } from '../stores/toast.store';
import ContactFormModal from '../components/contacts/ContactFormModal';
import ImportContactsModal from '../components/contacts/ImportContactsModal';
import BulkActionBar from '../components/contacts/BulkActionBar';
import ExportContactsModal from '../components/contacts/ExportContactsModal';
import { validateContact, bulkValidateContacts } from '../api/email-validation';

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  country_code: string | null;
  is_blacklisted: boolean;
  validation_status: 'unknown' | 'valid' | 'invalid' | 'risky' | 'disposable';
  validation_checked_at: string | null;
  engagement_score: number;
  created_at: string;
}

const validationBadgeConfig: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  valid: { label: 'Valid', variant: 'success' },
  invalid: { label: 'Invalid', variant: 'danger' },
  risky: { label: 'Risky', variant: 'warning' },
  disposable: { label: 'Disposable', variant: 'info' },
  unknown: { label: 'Unknown', variant: 'neutral' },
};

function ScoreBadge({ score }: { score: number }) {
  if (score > 80) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <Star className="h-3 w-3 fill-current" /> {score}
      </span>
    );
  }
  if (score > 50) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        {score}
      </span>
    );
  }
  if (score > 20) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        {score}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
      {score}
    </span>
  );
}

export default function ContactsPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<{ action: string; extraId?: string } | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [availableLists, setAvailableLists] = useState<{ id: string; name: string }[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string }[]>([]);

  const [perPage, setPerPage] = useState(20);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/contacts', { params: { page, per_page: perPage, search: search || undefined } });
      setContacts(data.data);
      setTotal(data.total);
    } catch {
      addToast('Failed to load contacts', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, addToast]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Clear selection when page/search changes
  useEffect(() => { setSelected(new Set()); }, [page, search]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/contacts/${deleteTarget.id}`);
      addToast('Contact deleted', 'success');
      setDeleteTarget(null);
      fetchContacts();
    } catch {
      addToast('Failed to delete contact', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleValidate = async (contactId: string) => {
    setValidatingId(contactId);
    try {
      await validateContact(contactId);
      addToast('Email validated successfully', 'success');
      fetchContacts();
    } catch {
      addToast('Failed to validate email', 'error');
    } finally {
      setValidatingId(null);
    }
  };

  const handleBulkValidate = async () => {
    setBulkProcessing(true);
    try {
      const { data } = await bulkValidateContacts(Array.from(selected));
      addToast(`Validated ${data.validated} contact(s)`, 'success');
      setSelected(new Set());
      fetchContacts();
    } catch {
      addToast('Bulk validation failed', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleRecalculateScores = async () => {
    setRecalculating(true);
    try {
      await api.post('/contacts/recalculate-scores');
      addToast('Engagement score recalculation queued. Scores will update shortly.', 'success');
      setTimeout(fetchContacts, 3000);
    } catch {
      addToast('Failed to queue score recalculation', 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  };

  const handleBulkAction = (action: string, extraId?: string) => {
    if (action === 'validate') {
      handleBulkValidate();
      return;
    }
    if (action === 'delete') {
      setBulkConfirm({ action, extraId });
      return;
    }
    if (action === 'add_to_list') {
      api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => {
        setAvailableLists(data.data);
        setListPickerOpen(true);
      }).catch(() => addToast('Failed to load lists', 'error'));
      return;
    }
    if (action === 'tag') {
      api.get('/contacts/tags/all').then(({ data }) => {
        setAvailableTags(data.data);
        setTagPickerOpen(true);
      }).catch(() => addToast('Failed to load tags', 'error'));
      return;
    }
    executeBulkAction(action, extraId);
  };

  const executeBulkAction = async (action: string, extraId?: string) => {
    setBulkProcessing(true);
    try {
      const payload: Record<string, unknown> = {
        action,
        contact_ids: Array.from(selected),
      };
      if (extraId) {
        if (action === 'tag' || action === 'untag') payload.tag_id = extraId;
        if (action === 'add_to_list' || action === 'remove_from_list') payload.list_id = extraId;
      }
      const { data } = await api.post('/contacts/bulk', payload);
      addToast(`Bulk action completed: ${data.affected} contacts affected`, 'success');
      setSelected(new Set());
      setBulkConfirm(null);
      fetchContacts();
    } catch {
      addToast('Bulk action failed', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const isAllSelected = contacts.length > 0 && selected.size === contacts.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold dark:text-gray-100">Contacts</h1>
        <div className="flex gap-3">
          <button
            onClick={handleRecalculateScores}
            disabled={recalculating}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm dark:text-gray-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} /> Recalculate Scores
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm dark:text-gray-300"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm dark:text-gray-300"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={() => { setEditContact(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="h-4 w-4" /> Add Contact
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts by email or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        />
      </div>

      {loading ? (
        <TableSkeleton />
      ) : contacts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8">
          <EmptyState
            icon={Users}
            title={search ? 'No contacts match your search' : 'No contacts yet'}
            description={search ? 'Try a different search term' : 'Start by adding your first contact or importing from CSV'}
            action={!search ? { label: 'Add Contact', onClick: () => setShowForm(true) } : undefined}
          />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                    />
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Company</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Validation</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Score</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Added</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {contacts.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selected.has(c.id) ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
                      >
                        {c.email}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <button
                        onClick={() => navigate(`/contacts/${c.id}`)}
                        className="hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                      >
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || '-'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{c.company_name || '-'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={c.is_blacklisted ? 'danger' : 'success'}>
                        {c.is_blacklisted ? 'Blacklisted' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Badge variant={validationBadgeConfig[c.validation_status || 'unknown']?.variant || 'neutral'}>
                          {validationBadgeConfig[c.validation_status || 'unknown']?.label || 'Unknown'}
                        </Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleValidate(c.id); }}
                          disabled={validatingId === c.id}
                          className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors disabled:opacity-50"
                          title="Validate email"
                        >
                          <CheckCircle className={`h-3.5 w-3.5 ${validatingId === c.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <ScoreBadge score={c.engagement_score || 0} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu items={[
                        { label: 'Edit', icon: Edit, onClick: () => { setEditContact(c); setShowForm(true); } },
                        { label: 'Delete', icon: Trash2, onClick: () => setDeleteTarget(c), variant: 'danger' },
                      ]} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} perPage={perPage} onPageChange={setPage} onPerPageChange={(val) => { setPerPage(val); setPage(1); }} />
        </>
      )}

      <BulkActionBar
        selectedCount={selected.size}
        onAction={handleBulkAction}
        onClear={() => setSelected(new Set())}
      />

      <ContactFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditContact(null); }}
        onSaved={fetchContacts}
        contact={editContact}
      />

      <ImportContactsModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImported={fetchContacts}
      />

      <ExportContactsModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        message={`Are you sure you want to delete ${deleteTarget?.email}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        isOpen={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        onConfirm={() => bulkConfirm && executeBulkAction(bulkConfirm.action, bulkConfirm.extraId)}
        title="Confirm Bulk Delete"
        message={`Are you sure you want to delete ${selected.size} contact(s)? This action cannot be undone.`}
        confirmLabel="Delete All"
        variant="danger"
        loading={bulkProcessing}
      />

      {/* List Picker Modal */}
      <Modal isOpen={listPickerOpen} onClose={() => setListPickerOpen(false)} title="Select a List" size="sm">
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {availableLists.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No lists found. Create a list first.</p>
          ) : (
            availableLists.map((list) => (
              <button
                key={list.id}
                onClick={() => {
                  setListPickerOpen(false);
                  executeBulkAction('add_to_list', list.id);
                }}
                className="w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                {list.name}
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Tag Picker Modal */}
      <Modal isOpen={tagPickerOpen} onClose={() => setTagPickerOpen(false)} title="Select a Tag" size="sm">
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {availableTags.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No tags found. Create a tag first.</p>
          ) : (
            availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => {
                  setTagPickerOpen(false);
                  executeBulkAction('tag', tag.id);
                }}
                className="w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                {tag.name}
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
