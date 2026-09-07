import { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import { SelectInput } from '../ui/FormField';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import { Upload } from 'lucide-react';
import api from '../../api/client';

interface ImportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ListOption { id: string; name: string }

export default function ImportContactsModal({ isOpen, onClose, onImported }: ImportContactsModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [targetList, setTargetList] = useState('');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const FIELDS = [
    { value: '', label: 'Skip' },
    { value: 'email', label: 'Email' },
    { value: 'first_name', label: 'First Name' },
    { value: 'last_name', label: 'Last Name' },
    { value: 'company_name', label: 'Company' },
    { value: 'phone', label: 'Phone' },
    { value: 'country_code', label: 'Country Code' },
  ];

  useEffect(() => {
    if (isOpen) {
      api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => setLists(data.data)).catch(() => {});
      setCsvData([]);
      setHeaders([]);
      setMapping({});
      setTargetList('');
    }
  }, [isOpen]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, '')));
      if (lines.length < 2) { addToast('CSV must have at least a header and one row', 'warning'); return; }
      setHeaders(lines[0]);
      setCsvData(lines.slice(1).filter((l) => l.some((c) => c)));
      // Auto-map
      const autoMap: Record<string, string> = {};
      lines[0].forEach((h, i) => {
        const lower = h.toLowerCase().replace(/[^a-z]/g, '');
        if (lower.includes('email')) autoMap[String(i)] = 'email';
        else if (lower.includes('first') || lower === 'fname') autoMap[String(i)] = 'first_name';
        else if (lower.includes('last') || lower === 'lname') autoMap[String(i)] = 'last_name';
        else if (lower.includes('company') || lower.includes('org')) autoMap[String(i)] = 'company_name';
        else if (lower.includes('phone') || lower.includes('tel')) autoMap[String(i)] = 'phone';
        else if (lower.includes('country')) autoMap[String(i)] = 'country_code';
      });
      setMapping(autoMap);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!mapping || !Object.values(mapping).includes('email')) {
      addToast('Please map at least the Email column', 'warning');
      return;
    }
    setLoading(true);
    try {
      const contacts = csvData.map((row) => {
        const obj: Record<string, string> = {};
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (field && row[Number(colIdx)]) obj[field] = row[Number(colIdx)];
        });
        return obj;
      }).filter((c) => c.email);

      const payload: Record<string, unknown> = { contacts };
      if (targetList) payload.list_id = targetList;

      const { data } = await api.post('/contacts/import', payload);
      addToast(`Imported ${data.created || contacts.length} contacts`, 'success');
      onImported();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Import failed';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Contacts from CSV"
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleImport}
            disabled={loading || csvData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
          >
            {loading && <ButtonSpinner />}
            Import {csvData.length} Contacts
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {csvData.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
          >
            <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-700">Click to upload a CSV file</p>
            <p className="text-xs text-gray-500 mt-1">Max 10,000 contacts per import</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Found {csvData.length} rows with {headers.length} columns</p>
              <button onClick={() => { setCsvData([]); setHeaders([]); setMapping({}); }} className="text-sm text-primary-600 hover:underline">
                Choose different file
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left">
                        <div className="text-xs text-gray-500 mb-1">{h}</div>
                        <select
                          value={mapping[String(i)] || ''}
                          onChange={(e) => setMapping({ ...mapping, [String(i)]: e.target.value })}
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

            {lists.length > 0 && (
              <SelectInput
                label="Add to List (optional)"
                name="target_list"
                value={targetList}
                onChange={setTargetList}
                options={[{ value: '', label: 'No list' }, ...lists.map((l) => ({ value: l.id, label: l.name }))]}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
