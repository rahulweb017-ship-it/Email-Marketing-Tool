import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Search, Trash2, Link2, FileText, Film, Check, Loader2, ImageIcon, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import AiImageGeneratorModal from '../ai/AiImageGeneratorModal';
import { useToastStore } from '../../stores/toast.store';
import { listMedia, uploadMedia, deleteMedia, type MediaAsset } from '../../api/media';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the chosen file. Omit to use the library just for managing uploads. */
  onSelect?: (asset: Pick<MediaAsset, 'url' | 'name' | 'kind' | 'width' | 'height'>) => void;
  /** Restrict what can be picked, e.g. ['image'] when replacing an image. */
  kinds?: MediaAsset['kind'][];
  title?: string;
}

const MAX_MB = 10;
const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,application/pdf';

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryModal({ isOpen, onClose, onSelect, kinds, title = 'Media Library' }: MediaLibraryModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);

  // Callers usually pass an inline array, so key the effect on its contents, not identity
  const kindsKey = kinds?.join(',') || '';
  const imagesOnly = kindsKey === 'image';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allowed = kindsKey ? kindsKey.split(',') : null;
      const { data } = await listMedia({ kind: allowed?.length === 1 ? allowed[0] : undefined, search: search || undefined });
      setAssets(allowed ? data.filter((a) => allowed.includes(a.kind)) : data);
    } catch {
      addToast('Could not load your media', 'error');
    } finally {
      setLoading(false);
    }
  }, [kindsKey, search, addToast]);

  useEffect(() => {
    if (isOpen) { setSelectedId(null); setUrlInput(''); load(); }
  }, [isOpen, load]);

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const file of list) {
      if (file.size > MAX_MB * 1024 * 1024) {
        addToast(`${file.name} is larger than ${MAX_MB} MB`, 'warning');
        continue;
      }
      setUploads((u) => [...u, { name: file.name, progress: 0 }]);
      try {
        const asset = await uploadMedia(file, (p) =>
          setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, progress: p } : x))));
        setAssets((a) => [asset, ...a.filter((x) => x.id !== asset.id)]);
        setSelectedId(asset.id);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        addToast(msg || `Could not upload ${file.name}`, 'error');
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  };

  // Paste a screenshot or copied image straight into the library
  useEffect(() => {
    if (!isOpen) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (files.length) { e.preventDefault(); handleFiles(files); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const handleDelete = async (asset: MediaAsset) => {
    if (!window.confirm(`Delete "${asset.name}"? Emails already sent with it will show a broken image.`)) return;
    try {
      await deleteMedia(asset.id);
      setAssets((a) => a.filter((x) => x.id !== asset.id));
      if (selectedId === asset.id) setSelectedId(null);
    } catch {
      addToast('Could not delete the file', 'error');
    }
  };

  const selected = assets.find((a) => a.id === selectedId) || null;

  const choose = (asset: Pick<MediaAsset, 'url' | 'name' | 'kind' | 'width' | 'height'>) => {
    onSelect?.(asset);
    onClose();
  };

  const useUrl = () => {
    const url = urlInput.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) { addToast('Enter a full link starting with https://', 'warning'); return; }
    choose({ url, name: url.split('/').pop() || 'image', kind: 'image', width: null, height: null });
  };

  const copyLink = async (asset: MediaAsset) => {
    await navigator.clipboard.writeText(asset.url).catch(() => {});
    addToast('Link copied', 'success');
  };

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500 truncate">
            {selected ? `${selected.name}${selected.width ? ` · ${selected.width}×${selected.height}px` : ''} · ${formatSize(selected.size_bytes)}` : `${imagesOnly ? 'JPG, PNG, GIF or WebP' : 'JPG, PNG, GIF, WebP, MP4 or PDF'}, up to ${MAX_MB} MB. Tip: you can also paste an image (Ctrl+V).`}
          </p>
          <div className="flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">{onSelect ? 'Cancel' : 'Close'}</button>
            {onSelect && (
              <button type="button"
                onClick={() => selected && choose(selected)}
                disabled={!selected}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
              >
                Use selected
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-5 cursor-pointer transition-colors ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
        >
          <Upload className="h-6 w-6 text-primary-600" />
          <p className="text-sm font-medium text-gray-700">Drop files here or click to upload</p>
          <p className="text-xs text-gray-500">{imagesOnly ? 'JPG, PNG, GIF or WebP' : 'Images, MP4 videos and PDFs'} up to {MAX_MB} MB</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={imagesOnly ? 'image/jpeg,image/png,image/gif,image/webp' : ACCEPT}
            className="hidden"
            onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        {(!kindsKey || kindsKey.split(',').includes('image')) && (
          <button type="button" onClick={() => setGenerateOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200">
            <Sparkles className="h-4 w-4" /> Create an image with AI
          </button>
        )}

        {uploads.map((u) => (
          <div key={u.name} className="flex items-center gap-3 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
            <span className="truncate flex-1">{u.name}</span>
            <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary-600" style={{ width: `${Math.round(u.progress * 100)}%` }} />
            </div>
          </div>
        ))}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your files..."
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {onSelect && (
            <div className="flex flex-1 gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') useUrl(); }}
                placeholder="...or paste an image link (https://...)"
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <button type="button" onClick={useUrl} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">Use link</button>
            </div>
          )}
        </div>

        <div className="min-h-[220px] max-h-[45vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <ImageIcon className="h-10 w-10 mb-2 text-gray-300" />
              <p className="text-sm">{search ? 'No files match your search' : 'No files yet. Upload your first image above.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {assets.map((a) => (
                <div
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  onDoubleClick={() => onSelect && choose(a)}
                  className={`group relative rounded-lg border-2 overflow-hidden cursor-pointer bg-gray-50 ${selectedId === a.id ? 'border-primary-600 ring-2 ring-primary-200' : 'border-transparent hover:border-gray-300'}`}
                >
                  <div className="aspect-square flex items-center justify-center">
                    {a.kind === 'image' ? (
                      <img src={a.url} alt={a.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                    ) : a.kind === 'video' ? (
                      <Film className="h-10 w-10 text-gray-400" />
                    ) : (
                      <FileText className="h-10 w-10 text-gray-400" />
                    )}
                  </div>
                  <div className="px-2 py-1 text-xs text-gray-600 truncate bg-white border-t">{a.name}</div>
                  {selectedId === a.id && (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-primary-600 p-0.5 text-white"><Check className="h-3.5 w-3.5" /></span>
                  )}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={(e) => { e.stopPropagation(); copyLink(a); }} title="Copy link" className="rounded bg-white/90 p-1 text-gray-600 hover:text-primary-600 shadow">
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(a); }} title="Delete" className="rounded bg-white/90 p-1 text-gray-600 hover:text-red-600 shadow">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
    <AiImageGeneratorModal
      isOpen={generateOpen}
      onClose={() => setGenerateOpen(false)}
      onCreated={(asset) => {
        setAssets((a) => [asset, ...a.filter((x) => x.id !== asset.id)]);
        setSelectedId(asset.id);
        addToast('Image created and saved to your library', 'success');
      }}
    />
    </>
  );
}
