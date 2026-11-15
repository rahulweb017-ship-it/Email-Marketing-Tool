import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Send, Film, X, ImagePlus, FileText } from 'lucide-react';
import { useToastStore } from '../stores/toast.store';
import SocialNav from '../components/social/SocialNav';
import TagPicker, { TagChip } from '../components/social/TagPicker';
import Modal from '../components/ui/Modal';
import MediaLibraryModal from '../components/media/MediaLibraryModal';
import {
  listIdeas, createIdea, updateIdea, moveIdea, deleteIdea, convertIdea, listTags,
  listTemplates, createTemplate, updateTemplate, deleteTemplate, apiErrorMessage,
  type SocialIdea, type IdeaStage, type IdeaMedia, type SocialTag, type SocialTemplate,
} from '../api/social';

const COLUMNS: Array<{ id: IdeaStage; label: string }> = [
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'todo', label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

type IdeaDraft = { id?: string; title: string; body: string; media: IdeaMedia[]; tags: string[]; stage: IdeaStage };
const blankIdea = (stage: IdeaStage = 'unassigned'): IdeaDraft => ({ title: '', body: '', media: [], tags: [], stage });

export default function SocialCreatePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const addToast = useToastStore((s) => s.addToast);
  const tab = params.get('tab') === 'templates' ? 'templates' : 'ideas';

  const [ideas, setIdeas] = useState<SocialIdea[]>([]);
  const [tags, setTags] = useState<SocialTag[]>([]);
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [tpl, setTpl] = useState<{ id?: string; name: string; content: string; tags: string[] } | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<IdeaStage | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, t, tp] = await Promise.all([listIdeas(), listTags(), listTemplates()]);
      setIdeas(i || []); setTags(t || []); setTemplates(tp || []);
    } catch {
      addToast('Could not load ideas', 'error');
    }
  }, [addToast]);
  useEffect(() => { load(); }, [load]);

  const column = (stage: IdeaStage) => ideas.filter((i) => i.stage === stage).sort((a, b) => a.position - b.position);

  const drop = async (stage: IdeaStage, beforeId?: string) => {
    const id = dragId;
    setDragId(null); setOverCol(null);
    if (!id) return;
    const list = column(stage).filter((i) => i.id !== id);
    let pos = beforeId ? list.findIndex((i) => i.id === beforeId) : list.length;
    if (pos < 0) pos = list.length;
    // Optimistic reorder
    setIdeas((all) => {
      const moving = all.find((i) => i.id === id);
      if (!moving) return all;
      const target = [...list];
      target.splice(pos, 0, { ...moving, stage });
      const ordered = new Map(target.map((i, idx) => [i.id, idx]));
      return all.map((i) => (ordered.has(i.id) ? { ...i, stage: i.id === id ? stage : i.stage, position: ordered.get(i.id)! } : i));
    });
    try { await moveIdea(id, stage, pos); } catch { addToast('Could not move the idea', 'error'); load(); }
  };

  const saveIdea = async () => {
    if (!draft) return;
    if (!draft.title.trim() && !draft.body.trim()) { addToast('Add a title or some text', 'warning'); return; }
    setSaving(true);
    try {
      if (draft.id) await updateIdea(draft.id, { title: draft.title, body: draft.body, media: draft.media, tags: draft.tags });
      else await createIdea({ title: draft.title, body: draft.body, media: draft.media, tags: draft.tags, stage: draft.stage });
      setDraft(null);
      load();
    } catch (err) {
      addToast(apiErrorMessage(err, 'Could not save the idea'), 'error');
    } finally { setSaving(false); }
  };

  const toPost = async (idea: SocialIdea) => {
    try {
      const { post_id } = await convertIdea(idea.id);
      navigate(`/social/compose/${post_id}`);
    } catch (err) { addToast(apiErrorMessage(err, 'Could not create the post'), 'error'); }
  };

  const removeIdea = async (idea: SocialIdea) => {
    if (!window.confirm('Delete this idea?')) return;
    try { await deleteIdea(idea.id); setIdeas((s) => s.filter((i) => i.id !== idea.id)); } catch { addToast('Could not delete the idea', 'error'); }
  };

  const saveTpl = async () => {
    if (!tpl || !tpl.name.trim()) { addToast('Give the template a name', 'warning'); return; }
    setSaving(true);
    try {
      if (tpl.id) await updateTemplate(tpl.id, tpl); else await createTemplate(tpl);
      setTpl(null); load();
    } catch (err) { addToast(apiErrorMessage(err, 'Could not save the template'), 'error'); } finally { setSaving(false); }
  };

  const tagById = (id: string) => tags.find((t) => t.id === id);
  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Collect ideas, plan them on a board and turn them into posts</p>
        </div>
        <button onClick={() => (tab === 'ideas' ? setDraft(blankIdea()) : setTpl({ name: '', content: '', tags: [] }))}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
          <Plus className="h-4 w-4" /> {tab === 'ideas' ? 'New idea' : 'New template'}
        </button>
      </div>
      <SocialNav />

      <div className="mb-4 flex gap-1">
        {(['ideas', 'templates'] as const).map((t) => (
          <button key={t} onClick={() => setParams({ tab: t })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
            {t === 'ideas' ? 'Ideas' : 'Templates'}
          </button>
        ))}
      </div>

      {tab === 'ideas' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = column(col.id);
            return (
              <div key={col.id}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
                onDragLeave={() => setOverCol((c) => (c === col.id ? null : c))}
                onDrop={(e) => { e.preventDefault(); drop(col.id); }}
                className={`flex min-h-[300px] flex-col rounded-xl p-3 ${overCol === col.id ? 'bg-primary-50 dark:bg-primary-900/10' : 'bg-gray-100 dark:bg-gray-800/60'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{col.label} <span className="ml-1 rounded-full bg-white px-1.5 text-xs text-gray-500 dark:bg-gray-700">{list.length}</span></span>
                  <button onClick={() => setDraft(blankIdea(col.id))} className="rounded p-1 text-gray-500 hover:bg-white dark:hover:bg-gray-700" aria-label={`New idea in ${col.label}`}><Plus className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 space-y-2">
                  {list.map((idea) => (
                    <div key={idea.id} draggable
                      onDragStart={(e) => { setDragId(idea.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(col.id, idea.id); }}
                      className={`cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${dragId === idea.id ? 'opacity-40' : ''}`}>
                      {idea.media?.[0] && (idea.media[0].type === 'video'
                        ? <div className="mb-2 flex h-24 items-center justify-center rounded bg-gray-900"><Film className="h-6 w-6 text-white" /></div>
                        : <img src={idea.media[0].url} alt="" className="mb-2 h-28 w-full rounded object-cover" />)}
                      {idea.title && <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{idea.title}</p>}
                      {idea.body && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400">{idea.body}</p>}
                      {(idea.tags || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">{idea.tags.map((id) => { const t = tagById(id); return t ? <TagChip key={id} tag={t} /> : null; })}</div>
                      )}
                      <div className="mt-2 flex items-center gap-1 border-t pt-2 dark:border-gray-700">
                        <button onClick={() => toPost(idea)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"><Send className="h-3.5 w-3.5" /> Create post</button>
                        <button onClick={() => setDraft({ id: idea.id, title: idea.title || '', body: idea.body || '', media: idea.media || [], tags: idea.tags || [], stage: idea.stage })} className="ml-auto rounded p-1 text-gray-400 hover:text-gray-700" aria-label="Edit idea"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeIdea(idea)} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Delete idea"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <button onClick={() => setDraft(blankIdea(col.id))} className="w-full rounded-lg py-6 text-sm text-gray-500 hover:bg-white dark:hover:bg-gray-700">+ New idea</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center dark:border-gray-700 dark:bg-gray-800">
          <FileText className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm text-gray-500">Save text you reuse often, like sign-offs, hashtags or weekly formats.</p>
          <button onClick={() => setTpl({ name: '', content: '', tags: [] })} className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">Create a template</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
              <p className="mt-1 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{t.content}</p>
              <div className="mt-3 flex items-center gap-1">
                <button onClick={() => navigate(`/social/compose?template=${t.id}`)} className="rounded-lg bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700">Use</button>
                <button onClick={() => setTpl({ id: t.id, name: t.name, content: t.content, tags: t.tags || [] })} className="ml-auto rounded p-1 text-gray-400 hover:text-gray-700" aria-label="Edit template"><Pencil className="h-4 w-4" /></button>
                <button onClick={async () => { if (!window.confirm('Delete this template?')) return; try { await deleteTemplate(t.id); load(); } catch { addToast('Could not delete', 'error'); } }} className="rounded p-1 text-gray-400 hover:text-red-600" aria-label="Delete template"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit idea' : 'New idea'} size="lg"
        footer={<div className="flex justify-end gap-3"><button onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-200">Cancel</button><button disabled={saving} onClick={saveIdea} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save idea'}</button></div>}>
        {draft && (
          <div className="space-y-3">
            <input className={inputCls} placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <textarea className={`${inputCls} resize-none`} rows={6} placeholder="Write down your idea" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              {draft.media.map((m, i) => (
                <div key={`${m.url}-${i}`} className="relative h-16 w-16 overflow-hidden rounded border bg-gray-100 dark:border-gray-700">
                  {m.type === 'video' ? <Film className="m-auto mt-5 h-5 w-5 text-gray-400" /> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                  <button onClick={() => setDraft({ ...draft, media: draft.media.filter((_, j) => j !== i) })} className="absolute right-0 top-0 bg-white/90 p-0.5 text-red-600" aria-label="Remove"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <button onClick={() => setMediaOpen(true)} className="flex h-16 w-16 items-center justify-center rounded border border-dashed text-gray-400 hover:text-gray-600 dark:border-gray-600" aria-label="Add media"><ImagePlus className="h-5 w-5" /></button>
            </div>
            <TagPicker tags={tags} value={draft.tags} onChange={(v) => setDraft({ ...draft, tags: v })} onTagCreated={(t) => setTags((s) => [...s, t])} />
          </div>
        )}
      </Modal>

      <Modal isOpen={!!tpl} onClose={() => setTpl(null)} title={tpl?.id ? 'Edit template' : 'New template'} size="lg"
        footer={<div className="flex justify-end gap-3"><button onClick={() => setTpl(null)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600 dark:text-gray-200">Cancel</button><button disabled={saving} onClick={saveTpl} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save template'}</button></div>}>
        {tpl && (
          <div className="space-y-3">
            <input className={inputCls} placeholder="Template name" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} />
            <textarea className={`${inputCls} resize-none`} rows={8} placeholder="Template text" value={tpl.content} onChange={(e) => setTpl({ ...tpl, content: e.target.value })} />
            <TagPicker tags={tags} value={tpl.tags} onChange={(v) => setTpl({ ...tpl, tags: v })} onTagCreated={(t) => setTags((s) => [...s, t])} />
          </div>
        )}
      </Modal>

      <MediaLibraryModal isOpen={mediaOpen} onClose={() => setMediaOpen(false)} kinds={['image', 'video']} title="Add media"
        onSelect={(a) => draft && setDraft({ ...draft, media: [...draft.media, { url: a.url, type: a.kind === 'video' ? 'video' : 'image' }] })} />
    </div>
  );
}
