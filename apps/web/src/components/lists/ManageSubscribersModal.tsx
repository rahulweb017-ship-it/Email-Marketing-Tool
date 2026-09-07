import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Pagination from '../ui/Pagination';
import { Search, UserMinus, UserPlus, X, Check } from 'lucide-react';
import Badge from '../ui/Badge';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import api from '../../api/client';

interface ManageSubscribersModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
}

interface Subscriber {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  opt_out: boolean;
}

interface ContactResult {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

export default function ManageSubscribersModal({ isOpen, onClose, listId, listName }: ManageSubscribersModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'' | 'active' | 'opted_out'>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ContactResult[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Map<string, ContactResult>>(new Map());
  const [adding, setAdding] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const perPage = 10;

  const fetchSubscribers = useCallback(async () => {
    if (!listId) return;
    try {
      const params: Record<string, unknown> = { page, per_page: perPage };
      if (filter === 'active') params.opt_out = 'false';
      if (filter === 'opted_out') params.opt_out = 'true';
      const { data } = await api.get(`/lists/${listId}/subscribers`, { params });
      setSubscribers(data.data);
      setTotal(data.total);
    } catch { addToast('Failed to load subscribers', 'error'); }
  }, [listId, page, filter, addToast]);

  useEffect(() => {
    if (isOpen) {
      fetchSubscribers();
      setSelectedContacts(new Map());
      setShowSearch(false);
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [isOpen, fetchSubscribers]);

  const searchContacts = async (term: string) => {
    setSearchTerm(term);
    if (term.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get('/contacts', { params: { search: term, per_page: 20 } });
      setSearchResults(data.data);
    } catch { /* ignore */ }
  };

  const toggleContact = (contact: ContactResult) => {
    setSelectedContacts(prev => {
      const next = new Map(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
      } else {
        next.set(contact.id, contact);
      }
      return next;
    });
  };

  const addSelectedSubscribers = async () => {
    if (selectedContacts.size === 0) return;
    setAdding(true);
    try {
      const contact_ids = Array.from(selectedContacts.keys());
      const { data } = await api.post(`/lists/${listId}/subscribers`, { contact_ids });
      addToast(`Added ${data.added || contact_ids.length} subscriber(s)`, 'success');
      setSelectedContacts(new Map());
      setSearchTerm('');
      setSearchResults([]);
      setShowSearch(false);
      fetchSubscribers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add subscribers';
      addToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  };

  const removeSubscriber = async (contactId: string) => {
    try {
      await api.delete(`/lists/${listId}/subscribers/${contactId}`);
      addToast('Subscriber removed', 'success');
      fetchSubscribers();
    } catch { addToast('Failed to remove subscriber', 'error'); }
  };

  // Set of current subscriber IDs to grey them out in search
  const subscriberIds = new Set(subscribers.map(s => s.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Subscribers - ${listName}`} size="xl">
      <div className="space-y-4">
        {/* Add Contacts Section */}
        {!showSearch ? (
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-4 py-2.5 w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <UserPlus className="h-4 w-4" /> Add Contacts to List
          </button>
        ) : (
          <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium dark:text-gray-200">Add Contacts</span>
              <button onClick={() => { setShowSearch(false); setSelectedContacts(new Map()); setSearchTerm(''); setSearchResults([]); }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts by email, name, or company..."
                value={searchTerm}
                onChange={(e) => searchContacts(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                autoFocus
              />
            </div>

            {/* Selected contacts chips */}
            {selectedContacts.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from(selectedContacts.values()).map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-xs">
                    {c.email}
                    <button onClick={() => toggleContact(c)} className="hover:text-primary-900 dark:hover:text-primary-100">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="border dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto divide-y dark:divide-gray-700">
                {searchResults.map((c) => {
                  const isSelected = selectedContacts.has(c.id);
                  const isAlreadySubscribed = subscriberIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => !isAlreadySubscribed && toggleContact(c)}
                      disabled={isAlreadySubscribed}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                        isAlreadySubscribed
                          ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
                          : isSelected
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div>
                        <span className="dark:text-gray-200">{c.email}</span>
                        {(c.first_name || c.last_name || c.company_name) && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                            {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                            {c.company_name ? ` - ${c.company_name}` : ''}
                          </span>
                        )}
                      </div>
                      {isAlreadySubscribed ? (
                        <span className="text-xs text-gray-400">Already added</span>
                      ) : isSelected ? (
                        <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Add button */}
            <button
              onClick={addSelectedSubscribers}
              disabled={selectedContacts.size === 0 || adding}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {adding ? <ButtonSpinner /> : <UserPlus className="h-4 w-4" />}
              Add {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''} to List
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2">
          {([['', 'All'], ['active', 'Active'], ['opted_out', 'Opted Out']] as const).map(([val, label]) => (
            <button key={val} onClick={() => { setFilter(val as typeof filter); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs ${filter === val ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Subscribers table */}
        <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {subscribers.map((s) => (
                <tr key={s.id} className="dark:text-gray-200">
                  <td className="px-4 py-2">{s.email}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{[s.first_name, s.last_name].filter(Boolean).join(' ') || '-'}</td>
                  <td className="px-4 py-2"><Badge variant={s.opt_out ? 'warning' : 'success'}>{s.opt_out ? 'Opted Out' : 'Active'}</Badge></td>
                  <td className="px-4 py-2">
                    <button onClick={() => removeSubscriber(s.id)} className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400" title="Remove">
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No subscribers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} perPage={perPage} onPageChange={setPage} />
      </div>
    </Modal>
  );
}
