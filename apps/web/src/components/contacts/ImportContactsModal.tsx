import { useState, useEffect, useRef, useMemo } from 'react';
import Modal from '../ui/Modal';
import { SelectInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { Upload, CheckCircle2, AlertTriangle, Wand2 } from 'lucide-react';
import api from '../../api/client';
import { parseCsv, guessMapping, type ImportField } from '../../utils/csv';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ListOption { id: string; name: string }

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  duplicates: number;
  invalid: number;
  fixed: number;
  issues: { row: number; reason: string }[];
  issues_truncated: boolean;
}

const FIELDS: { value: ImportField; label: string }[] = [
  { value: '', label: 'Skip' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone / WhatsApp' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'country_code', label: 'Country' },
];

const COUNTRIES = [
  { value: 'IN', label: 'India (+91)' }, { value: 'US', label: 'United States (+1)' },
  { value: 'GB', label: 'United Kingdom (+44)' }, { value: 'AE', label: 'UAE (+971)' },
  { value: 'CA', label: 'Canada (+1)' }, { value: 'AU', label: 'Australia (+61)' },
  { value: 'SG', label: 'Singapore (+65)' }, { value: 'SA', label: 'Saudi Arabia (+966)' },
  { value: 'NP', label: 'Nepal (+977)' }, { value: 'BD', label: 'Bangladesh (+880)' },
  { value: 'DE', label: 'Germany (+49)' }, { value: 'FR', label: 'France (+33)' },
];

const BATCH_SIZE = 2000;

export default function ImportContactsModal({ isOpen, onClose, onImported }: ImportContactsModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [targetList, setTargetList] = useState('');
  const [defaultCountry, setDefaultCountry] = useState('IN');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hadHeader, setHadHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<string, ImportField>>({});
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setCsvData([]); setLineNumbers([]); setHeaders([]); setMapping({}); setResult(null); setProgress(0);
  };

  useEffect(() => {
    if (isOpen) {
      api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => setLists(data.data)).catch(() => {});
      reset();
      setTargetList('');
    }
  }, [isOpen]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(String(ev.target?.result ?? ''));
      if (parsed.rows.length === 0) { addToast('No contacts found in this file', 'warning'); return; }
      setHeaders(parsed.headers);
      setCsvData(parsed.rows);
      setLineNumbers(parsed.lineNumbers);
      setHadHeader(parsed.hadHeader);
      setMapping(guessMapping(parsed.headers, parsed.rows));
    };
    reader.readAsText(file);
  };

  const mapped = Object.values(mapping);
  const hasEmail = mapped.includes('email');
  const hasPhone = mapped.includes('phone');

  const emptyRows = useMemo(() => {
    const cols = Object.entries(mapping).filter(([, f]) => f === 'email' || f === 'phone').map(([i]) => Number(i));
    return cols.length ? csvData.filter((r) => cols.every((i) => !r[i])).length : 0;
  }, [csvData, mapping]);

  const setColumn = (col: string, field: ImportField) => {
    const next = { ...mapping };
    // A field can only come from one column
    if (field) for (const k of Object.keys(next)) if (next[k] === field) next[k] = '';
    next[col] = field;
    setMapping(next);
  };

  const handleImport = async () => {
    if (!hasEmail && !hasPhone) {
      addToast('Choose which column has the email or the phone number', 'warning');
      return;
    }
    setLoading(true);
    setProgress(0);
    const total: ImportResult = { total: 0, imported: 0, updated: 0, duplicates: 0, invalid: 0, fixed: 0, issues: [], issues_truncated: false };
    try {
      const rows = csvData.map((row, idx) => {
        const obj: Record<string, string | number> = { _row: lineNumbers[idx] ?? idx + 2 };
        for (const [col, field] of Object.entries(mapping)) {
          if (field && row[Number(col)]) obj[field] = row[Number(col)];
        }
        return obj;
      });
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const payload: Record<string, unknown> = { contacts: rows.slice(i, i + BATCH_SIZE), default_country: defaultCountry };
        if (targetList) payload.list_id = targetList;
        const { data } = await api.post<ImportResult>('/contacts/import', payload);
        total.total += data.total;
        total.imported += data.imported;
        total.updated += data.updated;
        total.duplicates += data.duplicates;
        total.invalid += data.invalid;
        total.fixed += data.fixed;
        total.issues.push(...data.issues);
        total.issues_truncated ||= data.issues_truncated;
        setProgress(Math.min(1, (i + BATCH_SIZE) / rows.length));
      }
      setResult(total);
      onImported();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Import failed';
      addToast(total.total ? `${msg} (first ${total.total} rows were imported)` : msg, 'error');
      if (total.total) { setResult(total); onImported(); }
    } finally {
      setLoading(false);
    }
  };

  const footer = result ? (
    <div className="flex justify-end gap-3">
      <button onClick={reset} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Import another file</button>
      <button onClick={onClose} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">Done</button>
    </div>
  ) : (
    <div className="flex justify-end gap-3">
      <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
      <button
        onClick={handleImport}
        disabled={loading || csvData.length === 0}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
      >
        {loading && <ButtonSpinner />}
        {loading && csvData.length > BATCH_SIZE ? `Importing ${Math.round(progress * 100)}%` : `Import ${csvData.length} Contacts`}
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Contacts from CSV" size="xl" footer={footer}>
      <div className="space-y-4">
        {result ? (
          <ImportSummary result={result} />
        ) : csvData.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Click to upload a CSV file</p>
            <p className="text-xs text-gray-500 mt-1">Each contact needs an email or a phone number. Use email for email campaigns, phone for WhatsApp.</p>
            <p className="text-xs text-gray-500 mt-1">Formatting problems (spaces, +91 / 0 prefixes, Excel number formats, email typos, duplicates) are fixed automatically.</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Found {csvData.length} rows with {headers.length} columns{!hadHeader && ' (no header row detected)'}
              </p>
              <button onClick={reset} className="text-sm text-primary-600 hover:underline">Choose different file</button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left min-w-[130px]">
                        <div className="text-xs text-gray-500 mb-1 truncate">{h}</div>
                        <select
                          value={mapping[String(i)] || ''}
                          onChange={(e) => setColumn(String(i), e.target.value as ImportField)}
                          className="w-full text-xs border rounded px-2 py-1"
                        >
                          {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {csvData.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 text-xs text-gray-600 truncate max-w-[150px]">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!hasEmail && !hasPhone ? (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Pick the column that has the email or the phone number.
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                <Wand2 className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {hasEmail && hasPhone ? 'Contacts with an email can get email campaigns; contacts with a phone can get WhatsApp.'
                    : hasEmail ? 'Email only: these contacts can get email campaigns.'
                    : 'Phone only: these contacts can get WhatsApp campaigns. No email needed.'}
                  {' '}Formatting is cleaned automatically and existing contacts are updated instead of duplicated.
                  {emptyRows > 0 && ` ${emptyRows} row${emptyRows === 1 ? ' has' : 's have'} no ${hasEmail && hasPhone ? 'email or phone' : hasEmail ? 'email' : 'phone'} and will be skipped.`}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {hasPhone && (
                <SelectInput
                  label="Country for numbers without a country code"
                  name="default_country"
                  value={defaultCountry}
                  onChange={setDefaultCountry}
                  options={COUNTRIES}
                />
              )}
              {lists.length > 0 && (
                <SelectInput
                  label="Add to List (optional)"
                  name="target_list"
                  value={targetList}
                  onChange={setTargetList}
                  options={[{ value: '', label: 'No list' }, ...lists.map((l) => ({ value: l.id, label: l.name }))]}
                />
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ImportSummary({ result }: { result: ImportResult }) {
  const stats = [
    { label: 'New contacts', value: result.imported, color: 'text-green-700' },
    { label: 'Existing contacts updated', value: result.updated, color: 'text-blue-700' },
    { label: 'Duplicates merged', value: result.duplicates, color: 'text-gray-700' },
    { label: 'Skipped (no usable email or phone)', value: result.invalid, color: result.invalid ? 'text-red-700' : 'text-gray-700' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-green-700">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-medium">Import finished: {result.total} rows processed</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border p-3">
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>
      {result.fixed > 0 && (
        <p className="flex items-center gap-2 text-sm text-gray-600">
          <Wand2 className="h-4 w-4 text-primary-600" /> Auto-fixed formatting in {result.fixed} row{result.fixed === 1 ? '' : 's'}.
        </p>
      )}
      {result.issues.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Rows to check</p>
          <div className="max-h-48 overflow-y-auto rounded-lg border divide-y text-xs">
            {result.issues.map((issue, i) => (
              <div key={i} className="flex gap-3 px-3 py-1.5">
                <span className="w-16 shrink-0 text-gray-500">Row {issue.row}</span>
                <span className="text-gray-700">{issue.reason}</span>
              </div>
            ))}
          </div>
          {result.issues_truncated && <p className="text-xs text-gray-500 mt-1">Only the first issues are shown.</p>}
        </div>
      )}
    </div>
  );
}
