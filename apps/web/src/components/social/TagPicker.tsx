import { useState } from 'react';
import { Plus, Tag as TagIcon, X } from 'lucide-react';
import { createTag, apiErrorMessage, type SocialTag } from '../../api/social';
import { useToastStore } from '../../stores/toast.store';

export function TagChip({ tag, onRemove }: { tag: SocialTag; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: tag.color, color: tag.color }}>
      {tag.name}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${tag.name}`}><X className="h-3 w-3" /></button>}
    </span>
  );
}

const COLORS = ['#cc0000', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

export default function TagPicker({ tags, value, onChange, onTagCreated }: {
  tags: SocialTag[]; value: string[]; onChange: (ids: string[]) => void; onTagCreated: (t: SocialTag) => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const selected = tags.filter((t) => value.includes(t.id));

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      const t = await createTag(n, COLORS[tags.length % COLORS.length]);
      onTagCreated(t);
      if (!value.includes(t.id)) onChange([...value, t.id]);
      setName('');
    } catch (err) {
      addToast(apiErrorMessage(err, 'Could not create the tag'), 'error');
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((t) => <TagChip key={t.id} tag={t} onRemove={() => onChange(value.filter((v) => v !== t.id))} />)}
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
          <TagIcon className="h-3.5 w-3.5" /> Tags
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {tags.length === 0 && <p className="text-xs text-gray-500">No tags yet. Create one below.</p>}
            {tags.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                <input type="checkbox" checked={value.includes(t.id)}
                  onChange={(e) => onChange(e.target.checked ? [...value, t.id] : value.filter((v) => v !== t.id))} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                <span className="text-gray-700 dark:text-gray-200">{t.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5 border-t pt-2 dark:border-gray-700">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
              placeholder="New tag" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
            <button type="button" onClick={create} className="rounded bg-primary-600 px-2 text-white hover:bg-primary-700"><Plus className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-2 w-full text-xs text-gray-500 hover:text-gray-700">Done</button>
        </div>
      )}
    </div>
  );
}
