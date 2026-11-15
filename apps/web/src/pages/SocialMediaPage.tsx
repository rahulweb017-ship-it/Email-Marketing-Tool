import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Settings2, Pencil, Copy, Trash2, RotateCcw, Check, X, ExternalLink, Inbox, Film, AlertCircle,
} from 'lucide-react';
import { useToastStore } from '../stores/toast.store';
import { useAuthStore } from '../stores/auth.store';
import PostStatusBadge from '../components/social/PostStatusBadge';
import { ChannelAvatar } from '../components/social/PlatformIcon';
import SocialNav from '../components/social/SocialNav';
import QueueSettingsModal from '../components/social/QueueSettingsModal';
import { TagChip } from '../components/social/TagPicker';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  listSocialAccounts, listSocialPosts, getPostCounts, listTags, deleteSocialPost, duplicateSocialPost,
  retrySocialPost, approveSocialPost, rejectSocialPost, apiErrorMessage, canApproveRole,
  type PostTab, type SocialAccount, type SocialPost, type SocialTag, type PostCounts,
} from '../api/social';

const TABS: Array<{ id: PostTab; label: string }> = [
  { id: 'queue', label: 'Queue' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'sent', label: 'Sent' },
];

const EMPTY: Record<PostTab, string> = {
  queue: 'Nothing scheduled yet. Add a post to your queue and it goes out at your next posting time.',
  drafts: 'No drafts. Start a post and save it for later.',
  approvals: 'No posts are waiting for approval.',
  sent: 'Published posts will show up here.',
};

function postDate(p: SocialPost, tab: PostTab): string | null {
  if (tab === 'sent') return p.published_at || p.updated_at;
  if (tab === 'drafts') return p.updated_at;
  return p.scheduled_at || p.created_at;
}

export default function SocialMediaPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const addToast = useToastStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const isApprover = canApproveRole(user);

  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id || 'queue') as PostTab;
  const [accountId, setAccountId] = useState('');
  const [tagId, setTagId] = useState('');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [tags, setTags] = useState<SocialTag[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [counts, setCounts] = useState<PostCounts>({ queue: 0, drafts: 0, approvals: 0, sent: 0 });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [queueOpen, setQueueOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SocialPost | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listSocialAccounts().then((r) => setAccounts(r.data?.data || [])).catch(() => {});
    listTags().then(setTags).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const filters: Record<string, string> = {};
    if (accountId) filters.account_id = accountId;
    if (tagId) filters.tag = tagId;
    try {
      const [list, c] = await Promise.all([
        listSocialPosts({ ...filters, tab, page: String(page), per_page: '25' }),
        getPostCounts(filters),
      ]);
      setPosts(list.data?.data || []);
      setTotalPages(list.data?.total_pages || 1);
      setCounts(c);
    } catch {
      addToast('Could not load posts', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, accountId, tagId, page, addToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [tab, accountId, tagId]);

  const groups = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const p of posts) {
      const d = postDate(p, tab);
      const key = d ? new Date(d).toDateString() : 'No date';
      map.set(key, [...(map.get(key) || []), p]);
    }
    return [...map.entries()];
  }, [posts, tab]);

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      addToast(ok, 'success');
      await load();
    } catch (err) {
      addToast(apiErrorMessage(err, 'Something went wrong'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const reject = (p: SocialPost) => {
    const note = window.prompt('What should be changed? (shown to the author)') ?? null;
    if (note === null) return;
    act(p.id, () => rejectSocialPost(p.id, note), 'Sent back to drafts');
  };

  const tagById = (id: string) => tags.find((t) => t.id === id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Social Media</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Plan, approve and publish posts across your channels</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQueueOpen(true)} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
            <Settings2 className="h-4 w-4" /> Queue settings
          </button>
          <button onClick={() => navigate('/social/compose')} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>
      </div>

      <SocialNav />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setParams({ tab: t.id })}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t.id ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${t.id === 'approvals' && counts.approvals > 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setAccountId('')} className={`rounded-full px-2 py-1 text-xs ${!accountId ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>All</button>
            {accounts.map((a) => (
              <button key={a.id} onClick={() => setAccountId(accountId === a.id ? '' : a.id)} className={`rounded-full p-0.5 ${accountId === a.id ? 'ring-2 ring-primary-500' : ''}`} title={a.account_name}>
                <ChannelAvatar platform={a.platform} name={a.account_name} avatarUrl={a.account_avatar_url} size={28} dimmed={!!accountId && accountId !== a.id} />
              </button>
            ))}
          </div>
          {tags.length > 0 && (
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
              <option value="">All tags</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}</div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center dark:border-gray-700 dark:bg-gray-800">
          <Inbox className="mb-3 h-10 w-10 text-gray-300" />
          <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{accounts.length === 0 ? 'Connect a channel to start posting.' : EMPTY[tab]}</p>
          <button onClick={() => navigate(accounts.length === 0 ? '/social/accounts' : '/social/compose')} className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
            {accounts.length === 0 ? 'Connect a channel' : 'Create a post'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([day, list]) => (
            <div key={day}>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {day === 'No date' ? day : new Date(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              <div className="space-y-3">
                {list.map((p) => {
                  const d = postDate(p, tab);
                  const thumb = p.media?.[0];
                  const link = p.accounts?.find((a) => a.platform_post_url)?.platform_post_url;
                  const errors = (p.accounts || []).filter((a) => a.status === 'failed' && a.error_message);
                  const disabled = busy === p.id;
                  return (
                    <div key={p.id} className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="w-20 shrink-0 text-sm">
                        <p className="font-medium text-gray-900 dark:text-gray-100">{d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}</p>
                        {p.queued && tab !== 'sent' && <p className="text-xs text-gray-400">Queue</p>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <div className="flex -space-x-1">
                            {(p.accounts || []).map((a) => <ChannelAvatar key={a.id} platform={a.platform} name={a.account_name} avatarUrl={a.account_avatar_url} size={26} />)}
                          </div>
                          <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{(p.accounts || []).map((a) => a.account_name).join(', ') || 'No channels yet'}</span>
                          <PostStatusBadge status={p.status} />
                          {(p.tags || []).map((id) => { const t = tagById(id); return t ? <TagChip key={id} tag={t} /> : null; })}
                        </div>
                        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{p.content || <span className="italic text-gray-400">No text</span>}</p>
                        {p.rejection_note && p.status === 'draft' && (
                          <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Changes requested: {p.rejection_note}</p>
                        )}
                        {errors.map((a) => (
                          <p key={a.id} className="mt-2 flex items-start gap-1 text-xs text-red-600 dark:text-red-400"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a.account_name}: {a.error_message}</p>
                        ))}
                        {tab === 'approvals' && p.created_by_name && <p className="mt-2 text-xs text-gray-400">Submitted by {p.created_by_name}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {['draft', 'scheduled', 'pending_approval'].includes(p.status) && (
                            <button onClick={() => navigate(`/social/compose/${p.id}`)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                          )}
                          {tab === 'approvals' && isApprover && (
                            <>
                              <button disabled={disabled} onClick={() => act(p.id, () => approveSocialPost(p.id), 'Post approved')} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Approve</button>
                              <button disabled={disabled} onClick={() => reject(p)} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:hover:bg-red-900/20"><X className="h-3.5 w-3.5" /> Reject</button>
                            </>
                          )}
                          {['failed', 'partially_failed'].includes(p.status) && (
                            <button disabled={disabled} onClick={() => act(p.id, () => retrySocialPost(p.id), 'Retrying failed channels')} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><RotateCcw className="h-3.5 w-3.5" /> Retry</button>
                          )}
                          <button disabled={disabled} onClick={() => act(p.id, () => duplicateSocialPost(p.id), 'Copied to drafts')} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Copy className="h-3.5 w-3.5" /> Duplicate</button>
                          {link && (
                            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><ExternalLink className="h-3.5 w-3.5" /> Go to post</a>
                          )}
                          {p.status !== 'publishing' && (
                            <button onClick={() => setDeleteTarget(p)} className="ml-auto p-1 text-gray-400 hover:text-red-600" aria-label="Delete post"><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </div>
                      {thumb && (
                        <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-gray-900 sm:flex sm:items-center sm:justify-center">
                          {thumb.file_type === 'video'
                            ? <video src={thumb.file_url} className="h-full w-full object-cover" muted preload="metadata" />
                            : <img src={thumb.file_url} alt={thumb.alt_text || ''} className="h-full w-full object-cover" />}
                          {thumb.file_type === 'video' && <Film className="absolute h-5 w-5 text-white" />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200">Previous</button>
              <span className="text-gray-500">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200">Next</button>
            </div>
          )}
        </div>
      )}

      <QueueSettingsModal isOpen={queueOpen} onClose={() => setQueueOpen(false)} accounts={accounts} />
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete post?"
        message="This removes the post from Rabbit Growth. Posts already published stay on the social network."
        onConfirm={() => { const t = deleteTarget; setDeleteTarget(null); if (t) act(t.id, () => deleteSocialPost(t.id), 'Post deleted'); }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
