import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import Modal from '../ui/Modal';
import { ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import api from '../../api/client';

interface ExportContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FIELD_OPTIONS = [
  { key: 'email', label: 'Email', default: true },
  { key: 'first_name', label: 'First Name', default: true },
  { key: 'last_name', label: 'Last Name', default: true },
  { key: 'company_name', label: 'Company', default: true },
  { key: 'phone', label: 'Phone', default: true },
  { key: 'country_code', label: 'Country', default: true },
  { key: 'is_blacklisted', label: 'Blacklisted Status', default: false },
  { key: 'created_at', label: 'Created At', default: false },
];

interface MailingList {
  id: string;
  name: string;
}

export default function ExportContactsModal({ isOpen, onClose }: ExportContactsModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(FIELD_OPTIONS.filter((f) => f.default).map((f) => f.key)),
  );
  const [lists, setLists] = useState<MailingList[]>([]);
  const [selectedList, setSelectedList] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.get('/lists', { params: { per_page: 100 } }).then(({ data }) => {
        setLists(data.data || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedFields(new Set(FIELD_OPTIONS.map((f) => f.key)));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload: Record<string, unknown> = {
        fields: Array.from(selectedFields),
      };
      if (selectedList) payload.list_id = selectedList;

      const response = await api.post('/contacts/export', payload, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'contacts-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast('Contacts exported successfully', 'success');
      onClose();
    } catch {
      addToast('Failed to export contacts', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Contacts"
      size="md"
      footer={
        <div className="flex justify-between items-center">
          <button
            onClick={selectAll}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            Select all fields
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || selectedFields.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
            >
              {exporting ? <ButtonSpinner /> : <Download className="h-4 w-4" />}
              Export CSV
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filter by List (optional)
          </label>
          <select
            value={selectedList}
            onChange={(e) => setSelectedList(e.target.value)}
            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100 text-sm"
          >
            <option value="">All contacts</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fields to export
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FIELD_OPTIONS.map((field) => (
              <label
                key={field.key}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedFields.has(field.key)}
                  onChange={() => toggleField(field.key)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
              </label>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected for export
        </p>
      </div>
    </Modal>
  );
}
