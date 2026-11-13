import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Upload, Users, Edit, Trash2, Download, CheckCircle, RefreshCw, Star, Columns3 } from 'lucide-react';
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
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  phone_e164?: string | null;
  country_code: string | null;
  is_blacklisted: boolean;
  validation_status: 'unknown' | 'valid' | 'invalid' | 'risky' | 'disposable';
  validation_checked_at: string | null;
  engagement_score: number;
  whatsapp_opt_out?: boolean;
  source?: string | null;
  created_at: string;
  updated_at?: string;
}

type ColumnKey = 'email' | 'name' | 'phone' | 'company' | 'country' | 'whatsapp' | 'status' | 'validation' | 'score' | 'source' | 'created' | 'updated';

const COLUMNS: { key: ColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: 'email', label: 'Email', defaultVisible: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'phone', label: 'Phone', defaultVisible: true },
  { key: 'company', label: 'Company', defaultVisible: true },
  { key: 'country', label: 'Country', defaultVisible: false },
  { key: 'whatsapp', label: 'WhatsApp', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'validation', label: 'Validation', defaultVisible: true },
  { key: 'score', label: 'Score', defaultVisible: true },
  { key: 'source', label: 'Source', defaultVisible: false },
  { key: 'created', label: 'Added', defaultVisible: true },
  { key: 'updated', label: 'Last Updated', defaultVisible: false },
];

const COLUMNS_STORAGE_KEY = 'contacts_visible_columns';
const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

function loadVisibleColumns(): ColumnKey[] {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) || 'null');
    if (Array.isArray(saved)) {
      const valid = saved.filter((k): k is ColumnKey => COLUMNS.some((c) => c.key === k));
      if (valid.length) return valid;
    }
  } catch { /* corrupted value: fall back to defaults */ }
  return DEFAULT_COLUMNS;
}

function ColumnPicker({ visible, onChange }: { visible: ColumnKey[]; onChange: (cols: ColumnKey[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (key: ColumnKey) => {
    if (visible.includes(key)) {
      if (visible.length > 1) onChange(visible.filter((k) => k !== key));
    } else {
      onChange(COLUMNS.map((c) => c.key).filter((k) => k === key || visible.includes(k)));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm dark:text-gray-300 h-full"
      >
        <Columns3 className="h-4 w-4" /> Columns
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-2">
          <p className="px-2 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Show columns</p>
          {COLUMNS.map((col) => (
            <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={visible.includes(col.key)}
                disabled={visible.length === 1 && visible.includes(col.key)}
                onChange={() => toggle(col.key)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
              />
              {col.label}
            </label>
          ))}
          <button
            onClick={() => onChange(DEFAULT_COLUMNS)}
            className="mt-1 w-full border-t dark:border-gray-700 pt-2 text-left px-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
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
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadVisibleColumns);

  const updateColumns = (cols: ColumnKey[]) => {
    setVisibleColumns(cols);
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(cols));
  };

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

  const openContact = (c: Contact) => navigate(`/contacts/${c.id}`);
  const linkClass = 'text-left hover:text-primary-600 dark:hover:text-primary-400 hover:underline';

  const renderCell = (key: ColumnKey, c: Contact): ReactNode => {
    switch (key) {
      case 'email':
        return c.email
          ? <button onClick={() => openContact(c)} className="font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline break-all text-left">{c.email}</button>
          : <span className="text-gray-400">-</span>;
      case 'name':
        return <button onClick={() => openContact(c)} className={linkClass}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || (c.email ? '-' : 'View contact')}</button>;
      case 'phone': {
        const phone = c.phone_e164 || c.phone;
        return phone ? <span className="whitespace-nowrap">{phone}</span> : <span className="text-gray-400">-</span>;
      }
      case 'company':
        return c.company_name || '-';
      case 'country':
        return c.country_code || '-';
      case 'whatsapp':
        if (!c.phone_e164) return <span className="text-gray-400">-</span>;
        return <Badge variant={c.whatsapp_opt_out ? 'danger' : 'success'}>{c.whatsapp_opt_out ? 'Opted out' : 'Reachable'}</Badge>;
      case 'status':
        return <Badge variant={c.is_blacklisted ? 'danger' : 'success'}>{c.is_blacklisted ? 'Blacklisted' : 'Active'}</Badge>;
      case 'validation':
        if (!c.email) return <span className="text-gray-400">-</span>;
        return (
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
        );
      case 'score':
        return <ScoreBadge score={c.engagement_score || 0} />;
      case 'source':
        return c.source ? c.source.replace(/_/g, ' ') : '-';
      case 'created':
        return <span className="whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</span>;
      case 'updated':
        return c.updated_at ? <span className="whitespace-nowrap">{new Date(c.updated_at).toLocaleDateString()}</span> : '-';
    }
  };

  const shownColumns = COLUMNS.filter((col) => visibleColumns.includes(col.key));

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

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts by email, name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
          />
        </div>
        <ColumnPicker visible={visibleColumns} onChange={updateColumns} />
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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto">
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
                  {shownColumns.map((col) => (
                    <th key={col.key} className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">{col.label}</th>
                  ))}
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
                    {shownColumns.map((col) => (
                      <td key={col.key} className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{renderCell(col.key, c)}</td>
                    ))}
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
        message={`Are you sure you want to delete ${deleteTarget?.email || deleteTarget?.phone_e164 || deleteTarget?.phone || 'this contact'}? This action cannot be undone.`}
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
