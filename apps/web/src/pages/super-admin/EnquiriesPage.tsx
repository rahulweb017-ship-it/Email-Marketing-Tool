import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Trash2, Mail, Phone, Globe } from 'lucide-react';
import clsx from 'clsx';
import { listEnquiries, updateEnquiry, deleteEnquiry, type Enquiry } from '../../api/enquiries';
import { useToastStore } from '../../stores/toast.store';
import { ENQUIRY_INTERESTS } from '../../components/site/siteData';

const STATUSES: { value: Enquiry['status']; label: string; tone: string }[] = [
  { value: 'new', label: 'New', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'contacted', label: 'Contacted', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'converted', label: 'Converted', tone: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { value: 'closed', label: 'Closed', tone: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
];

const interestLabel = (v: string) => ENQUIRY_INTERESTS.find((i) => i.value === v)?.label ?? v;

const parseInterests = (v: unknown): string[] => {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
};

export default function EnquiriesPage() {
  const addToast = useToastStore((s) => s.addToast);
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const perPage = 25;

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), per_page: String(perPage) };
    if (status) params.status = status;
    if (type) params.type = type;
    if (query) params.search = query;
    listEnquiries(params)
      .then(({ data }) => { setRows(data.data); setTotal(data.total); setCounts(data.counts || {}); })
      .catch(() => addToast('Failed to load enquiries', 'error'))
      .finally(() => setLoading(false));
  }, [page, status, type, query, addToast]);

  useEffect(() => { load(); }, [load]);

  const changeStatus = async (row: Enquiry, next: Enquiry['status']) => {
    try {
      const { data } = await updateEnquiry(row.id, { status: next });
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...data } : r)));
      setCounts((c) => ({ ...c, [row.status]: Math.max(0, (c[row.status] || 0) - 1), [next]: (c[next] || 0) + 1 }));
    } catch {
      addToast('Could not update status', 'error');
    }
  };

  const saveNotes = async (row: Enquiry) => {
    const value = notes[row.id];
    if (value === undefined || value === (row.admin_notes || '')) return;
    try {
      const { data } = await updateEnquiry(row.id, { admin_notes: value || null });
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...data } : r)));
      addToast('Notes saved', 'success');
    } catch {
      addToast('Could not save notes', 'error');
    }
  };

  const remove = async (row: Enquiry) => {
    if (!window.confirm(`Delete the enquiry from ${row.name}?`)) return;
    try {
      await deleteEnquiry(row.id);
      load();
    } catch {
      addToast('Could not delete enquiry', 'error');
    }
  };

  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Enquiries</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Demo requests and contact messages from the website.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company, phone"
              className="w-72 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">All types</option>
            <option value="registration">Demo requests</option>
            <option value="contact">Contact messages</option>
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[{ value: '', label: 'All', count: allCount }, ...STATUSES.map((s) => ({ value: s.value, label: s.label, count: counts[s.value] || 0 }))].map((tab) => (
          <button
            key={tab.value || 'all'}
            type="button"
            onClick={() => { setStatus(tab.value); setPage(1); }}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              status === tab.value ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
          >
            {tab.label} <span className="ml-1 opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Received</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Contact</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Company</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No enquiries yet</td></tr>
            ) : rows.map((row) => {
              const open = expanded === row.id;
              const interests = parseInterests(row.interests);
              const tone = STATUSES.find((s) => s.value === row.status)?.tone;
              return (
                <Fragment key={row.id}>
                  <tr className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={() => setExpanded(open ? null : row.id)}>
                    <td className="px-2 py-3 text-gray-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{row.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.email}{row.phone ? ` · ${row.phone}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.company || '-'}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.type === 'registration' ? 'Demo request' : 'Contact'}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={row.status}
                        onChange={(e) => changeStatus(row, e.target.value as Enquiry['status'])}
                        className={clsx('rounded-full border-0 px-2.5 py-1 text-xs font-medium', tone)}
                      >
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => remove(row)} title="Delete" className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-gray-50/60 dark:bg-gray-900/30">
                      <td />
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap gap-3 text-gray-600 dark:text-gray-300">
                              <a href={`mailto:${row.email}`} className="flex items-center gap-1.5 text-red-600 hover:underline"><Mail className="h-4 w-4" /> Email</a>
                              {row.phone && <a href={`tel:${row.phone}`} className="flex items-center gap-1.5 text-red-600 hover:underline"><Phone className="h-4 w-4" /> Call</a>}
                              {row.website && <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> {row.website}</span>}
                            </div>
                            {(row.company_size || row.monthly_volume) && (
                              <p className="text-gray-600 dark:text-gray-300">
                                {row.company_size && <>Team size: <strong>{row.company_size}</strong>. </>}
                                {row.monthly_volume && <>Monthly messages: <strong>{row.monthly_volume}</strong>.</>}
                              </p>
                            )}
                            {interests.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {interests.map((i) => <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">{interestLabel(i)}</span>)}
                              </div>
                            )}
                            {row.subject && <p className="font-medium text-gray-900 dark:text-white">{row.subject}</p>}
                            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{row.message || <span className="italic text-gray-400">No message</span>}</p>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Internal notes</label>
                            <textarea
                              value={notes[row.id] ?? row.admin_notes ?? ''}
                              onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                              onBlur={() => saveNotes(row)}
                              rows={4}
                              placeholder="Call notes, follow-up date... saved when you click away"
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{total} enquiries</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 dark:border-gray-600">Previous</button>
            <span className="px-2 py-1.5">Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40 dark:border-gray-600">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
