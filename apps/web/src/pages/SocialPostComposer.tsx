import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, X, Film, FileText, AlertTriangle, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToastStore } from '../stores/toast.store';
import { ChannelAvatar, getPlatformConfig } from '../components/social/PlatformIcon';
import PostStatusBadge from '../components/social/PostStatusBadge';
import TagPicker from '../components/social/TagPicker';
import AiSocialWriter from '../components/ai/AiSocialWriter';
import MediaLibraryModal from '../components/media/MediaLibraryModal';
import Modal from '../components/ui/Modal';
import {
  listSocialAccounts, getSocialPost, createSocialPost, updateSocialPost, listTags, listTemplates, getNextSlot,
  apiErrorMessage, platformHints, CHAR_LIMITS, FIRST_COMMENT_PLATFORMS,
  type SocialAccount, type SocialTag, type SocialTemplate, type ScheduleMode, type PostPayload,
} from '../api/social';

type MediaItem = { url: string; type: 'image' | 'video' | 'gif' };
type Override = { content_override: string; first_comment: string };

const MODES: Array<{ id: Exclude<ScheduleMode, 'draft'>; label: string; hint: string }> = [
  { id: 'queue', label: 'Next available', hint: 'Use the next free posting slot in your queue.' },
  { id: 'queue_top', label: 'Prioritize', hint: 'Take the soonest free slot.' },
  { id: 'now', label: 'Now', hint: 'Publish right away.' },
  { id: 'custom', label: 'Set date and time', hint: 'Choose a specific time.' },
];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SocialPostComposer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [search] = useSearchParams();
  const location = useLocation();
  const addToast = useToastStore((s) => s.addToast);

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [tags, setTags] = useState<SocialTag[]>([]);
  const [templates, setTemplates] = useState<SocialTemplate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [customize, setCustomize] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [activeTab, setActiveTab] = useState<string>('main');
  const [mode, setMode] = useState<Exclude<ScheduleMode, 'draft'>>('queue');
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState('draft');
  const [rejection, setRejection] = useState<string | null>(null);
  const [nextSlot, setNextSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  useEffect(() => {
    listSocialAccounts().then((r) => setAccounts((r.data?.data || []).filter((a: SocialAccount) => a.is_active))).catch(() => addToast('Could not load channels', 'error'));
    listTags().then(setTags).catch(() => {});
    listTemplates().then(setTemplates).catch(() => {});
  }, [addToast]);

  // Prefill from a template (?template=<id>) or router state { content }
  useEffect(() => {
    if (id) return;
    const st = location.state as { content?: string } | null;
    if (st?.content) setContent(st.content);
    const tplId = search.get('template');
    if (tplId && templates.length) {
      const t = templates.find((x) => x.id === tplId);
      if (t) { setContent(t.content); setTagIds(t.tags || []); }
    }
  }, [id, location.state, search, templates]);

  const loadPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await getSocialPost(id);
      setContent(data.content || '');
      setStatus(data.status);
      setRejection(data.rejection_note || null);
      setTagIds(Array.isArray(data.tags) ? data.tags : []);
      setSelected((data.accounts || []).map((a: any) => a.account_id));
      setMedia((data.media || []).map((m: any) => ({ url: m.file_url, type: m.file_type })));
      const ov: Record<string, Override> = {};
      let any = false;
      for (const a of data.accounts || []) {
        ov[a.account_id] = { content_override: a.content_override || '', first_comment: a.first_comment || '' };
        if (a.content_override || a.first_comment) any = true;
      }
      setOverrides(ov);
      setCustomize(any);
      if (data.scheduled_at) { setScheduledAt(toLocalInput(data.scheduled_at)); setMode(data.queued ? 'queue' : 'custom'); }
    } catch {
      addToast('Could not load the post', 'error');
      navigate('/social');
    } finally {
      setLoading(false);
    }
  }, [id, addToast, navigate]);
  useEffect(() => { loadPost(); }, [loadPost]);

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id));
  const textFor = (accId: string) => (customize && overrides[accId]?.content_override) || content;

  useEffect(() => {
    if ((mode !== 'queue' && mode !== 'queue_top') || selected.length === 0) { setNextSlot(null); return; }
    let live = true;
    getNextSlot(selected, mode).then((r) => live && setNextSlot(r.scheduled_at)).catch(() => live && setNextSlot(null));
    return () => { live = false; };
  }, [mode, selected]);

  const hints = useMemo(
    () => platformHints(selectedAccounts.map((a) => ({ platform: a.platform, content: textFor(a.id) })), media),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedAccounts.map((a) => a.id).join(), content, overrides, customize, media],
  );

  const editable = !id || ['draft', 'scheduled', 'pending_approval'].includes(status);
  const toggleAccount = (accId: string) => setSelected((s) => s.includes(accId) ? s.filter((x) => x !== accId) : [...s, accId]);
  const setOv = (accId: string, patch: Partial<Override>) =>
    setOverrides((o) => ({ ...o, [accId]: { ...{ content_override: '', first_comment: '' }, ...o[accId], ...patch } }));

  const submit = async (scheduleMode: ScheduleMode) => {
    if (scheduleMode !== 'draft') {
      if (selected.length === 0) { addToast('Select at least one channel', 'warning'); return; }
      if (hints.length) { addToast(hints[0], 'warning'); return; }
      if (scheduleMode === 'custom' && !scheduledAt) { addToast('Pick a date and time', 'warning'); return; }
    } else if (!content.trim() && media.length === 0) {
      addToast('Write something or add media first', 'warning'); return;
    }
    const payload: PostPayload = {
      content,
      account_ids: selected,
      media,
      tags: tagIds,
      overrides: selected.map((accId) => ({
        account_id: accId,
        content_override: customize ? overrides[accId]?.content_override || null : null,
        first_comment: customize ? overrides[accId]?.first_comment || null : null,
      })),
      schedule_mode: scheduleMode,
      scheduled_at: scheduleMode === 'custom' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
    if (!id) {
      const ideaId = search.get('idea');
      if (ideaId) payload.idea_id = ideaId;
    }
    setSaving(true);
    try {
      const { data } = id ? await updateSocialPost(id, payload) : await createSocialPost(payload);
      const st = data?.status as string;
      addToast(
        st === 'pending_approval' ? 'Sent for approval'
          : st === 'publishing' ? 'Publishing now'
            : st === 'scheduled' ? `Scheduled for ${new Date(data.scheduled_at).toLocaleString()}`
              : 'Draft saved',
        'success',
      );
      navigate(`/social?tab=${st === 'pending_approval' ? 'approvals' : st === 'draft' ? 'drafts' : st === 'scheduled' ? 'queue' : 'sent'}`);
    } catch (err) {
      addToast(apiErrorMessage(err, 'Could not save the post'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-sm text-gray-400">Loading...</div>;

  const activeAccount = selectedAccounts.find((a) => a.id === activeTab);
  const currentMode = MODES.find((m) => m.id === mode)!;
  const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/social')} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back"><ArrowLeft className="h-5 w-5 text-gray-500" /></button>
        <h1 className="flex-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{id ? 'Edit post' : 'Create post'}</h1>
        {id && <PostStatusBadge status={status} />}
      </div>

      {rejection && status === 'draft' && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Changes requested: {rejection}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Channels</p>
            {accounts.length === 0 ? (
              <p className="text-sm text-gray-500">No channels connected. <button className="text-primary-600 underline" onClick={() => navigate('/social/accounts')}>Connect one</button></p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <button key={a.id} type="button" disabled={!editable} onClick={() => toggleAccount(a.id)} title={a.account_name}
                    className={`rounded-full p-0.5 ${selected.includes(a.id) ? 'ring-2 ring-primary-500' : ''}`}>
                    <ChannelAvatar platform={a.platform} name={a.account_name} avatarUrl={a.account_avatar_url} size={40} dimmed={!selected.includes(a.id)} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            {customize && selectedAccounts.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1 border-b pb-2 dark:border-gray-700">
                <button onClick={() => setActiveTab('main')} className={`rounded-lg px-3 py-1 text-sm ${activeTab === 'main' ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'text-gray-500'}`}>All channels</button>
                {selectedAccounts.map((a) => (
                  <button key={a.id} onClick={() => setActiveTab(a.id)} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm ${activeTab === a.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'text-gray-500'}`}>
                    <ChannelAvatar platform={a.platform} name={a.account_name} avatarUrl={a.account_avatar_url} size={20} />
                    <span className="max-w-[100px] truncate">{a.account_name}</span>
                  </button>
                ))}
              </div>
            )}

            {activeAccount && customize ? (
              <div className="space-y-3">
                <textarea rows={8} disabled={!editable} className={`${inputCls} resize-none`}
                  value={overrides[activeAccount.id]?.content_override ?? ''}
                  placeholder={`Leave empty to use the main text.\n\n${content}`}
                  onChange={(e) => setOv(activeAccount.id, { content_override: e.target.value })} />
                <p className="text-right text-xs text-gray-400">{textFor(activeAccount.id).length} / {CHAR_LIMITS[activeAccount.platform] || '∞'}</p>
                {FIRST_COMMENT_PLATFORMS.includes(activeAccount.platform) ? (
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">First comment (optional)</span>
                    <textarea rows={2} disabled={!editable} className={`${inputCls} resize-none`} value={overrides[activeAccount.id]?.first_comment ?? ''}
                      onChange={(e) => setOv(activeAccount.id, { first_comment: e.target.value })} placeholder="Posted right after the post goes live" />
                  </label>
                ) : <p className="text-xs text-gray-400">First comments are not supported on {getPlatformConfig(activeAccount.platform).label}.</p>}
              </div>
            ) : (
              <>
                <textarea rows={8} disabled={!editable} value={content} onChange={(e) => setContent(e.target.value)}
                  placeholder="Start writing or insert a template" className={`${inputCls} resize-none`} />
                <div className="mt-2 flex flex-wrap justify-end gap-3">
                  {[...new Set(selectedAccounts.map((a) => a.platform))].map((p) => {
                    const lim = CHAR_LIMITS[p];
                    const over = lim && content.length > lim;
                    return <span key={p} className={`text-xs ${over ? 'font-medium text-red-500' : 'text-gray-400'}`}>{getPlatformConfig(p).label}: {content.length}/{lim}</span>;
                  })}
                </div>
              </>
            )}

            {media.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {media.map((m, i) => (
                  <div key={`${m.url}-${i}`} className="group relative h-20 w-20 overflow-hidden rounded-lg border bg-gray-100 dark:border-gray-700 dark:bg-gray-900">
                    {m.type === 'video' ? <div className="flex h-full items-center justify-center"><Film className="h-6 w-6 text-gray-400" /></div> : <img src={m.url} alt="" className="h-full w-full object-cover" />}
                    {editable && (
                      <div className="absolute inset-x-0 top-0 flex justify-between opacity-0 group-hover:opacity-100">
                        <div className="flex">
                          {i > 0 && <button onClick={() => setMedia((s) => { const c = [...s]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })} className="bg-white/90 p-0.5" aria-label="Move earlier"><ArrowUp className="h-3 w-3 -rotate-90" /></button>}
                          {i < media.length - 1 && <button onClick={() => setMedia((s) => { const c = [...s]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; return c; })} className="bg-white/90 p-0.5" aria-label="Move later"><ArrowDown className="h-3 w-3 -rotate-90" /></button>}
                        </div>
                        <button onClick={() => setMedia((s) => s.filter((_, j) => j !== i))} className="bg-white/90 p-0.5 text-red-600" aria-label="Remove"><X className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {editable && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 dark:border-gray-700">
                <button onClick={() => setMediaOpen(true)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><ImagePlus className="h-3.5 w-3.5" /> Media</button>
                <button onClick={() => setTplOpen(true)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><FileText className="h-3.5 w-3.5" /> Templates</button>
                <TagPicker tags={tags} value={tagIds} onChange={setTagIds} onTagCreated={(t) => setTags((s) => [...s.filter((x) => x.id !== t.id), t])} />
                <label className="ml-auto flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={customize} onChange={(e) => { setCustomize(e.target.checked); setActiveTab('main'); }} />
                  Customize for each network
                </label>
              </div>
            )}
          </div>

          {hints.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {hints.map((h) => <p key={h} className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {h}</p>)}
            </div>
          )}

          {editable && <AiSocialWriter platforms={[...new Set(selectedAccounts.map((a) => a.platform))]} onUse={(text) => setContent(text)} />}

          {editable && (
            <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <button disabled={saving} onClick={() => submit('draft')} className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 dark:text-gray-300">Save draft</button>
              {mode === 'custom' && (
                <input type="datetime-local" value={scheduledAt} min={toLocalInput(new Date().toISOString())} onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
              )}
              <div className="relative flex">
                <button disabled={saving} onClick={() => submit(mode)} className="rounded-l-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {saving ? 'Saving...' : mode === 'now' ? 'Publish now' : mode === 'custom' ? 'Schedule' : `Add to queue${nextSlot ? ` (${new Date(nextSlot).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })})` : ''}`}
                </button>
                <button onClick={() => setModeOpen((o) => !o)} className="rounded-r-lg border-l border-primary-700 bg-primary-600 px-2 text-white hover:bg-primary-700" aria-label="Scheduling options"><ChevronDown className="h-4 w-4" /></button>
                {modeOpen && (
                  <div className="absolute bottom-full right-0 z-20 mb-2 w-72 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {MODES.map((m) => (
                      <button key={m.id} onClick={() => { setMode(m.id); setModeOpen(false); }}
                        className={`block w-full rounded-md px-3 py-2 text-left ${mode === m.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                        <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{m.label}</span>
                        <span className="block text-xs text-gray-500">{m.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="w-full text-right text-xs text-gray-400">{currentMode.hint}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Post previews</h3>
            {selectedAccounts.length === 0 ? <p className="text-sm text-gray-400">Select a channel to see a preview.</p> : (
              <div className="space-y-4">
                {selectedAccounts.map((a) => {
                  const text = textFor(a.id);
                  const lim = CHAR_LIMITS[a.platform];
                  return (
                    <div key={a.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="mb-2 flex items-center gap-2">
                        <ChannelAvatar platform={a.platform} name={a.account_name} avatarUrl={a.account_avatar_url} size={28} />
                        <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{a.account_name}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{lim ? text.slice(0, lim) : text}{lim && text.length > lim && <span className="text-red-500">…</span>}</p>
                      {media[0] && (media[0].type === 'video'
                        ? <div className="mt-2 flex h-32 items-center justify-center rounded bg-gray-900"><Film className="h-8 w-8 text-white" /></div>
                        : <img src={media[0].url} alt="" className="mt-2 max-h-48 w-full rounded object-cover" />)}
                      {customize && overrides[a.id]?.first_comment && <p className="mt-2 border-t pt-2 text-xs text-gray-500 dark:border-gray-700">First comment: {overrides[a.id].first_comment}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <MediaLibraryModal isOpen={mediaOpen} onClose={() => setMediaOpen(false)} kinds={['image', 'video']} title="Add media"
        onSelect={(a) => setMedia((s) => [...s, { url: a.url, type: a.kind === 'video' ? 'video' : /\.gif($|\?)/i.test(a.url) ? 'gif' : 'image' }])} />

      <Modal isOpen={tplOpen} onClose={() => setTplOpen(false)} title="Insert a template" size="lg">
        {templates.length === 0 ? (
          <p className="text-sm text-gray-500">No templates yet. Create them under Social, Create, Templates.</p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => { setContent((c) => (c ? `${c}\n\n${t.content}` : t.content)); setTplOpen(false); }}
                className="block w-full rounded-lg border p-3 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
                <p className="line-clamp-2 text-xs text-gray-500">{t.content}</p>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
