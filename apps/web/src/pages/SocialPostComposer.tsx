import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Send, Clock, Save, AlertTriangle,
} from 'lucide-react';
import api from '../api/client';
import { useToastStore } from '../stores/toast.store';
import AccountSelector from '../components/social/AccountSelector';
import PlatformIcon from '../components/social/PlatformIcon';
import PostStatusBadge from '../components/social/PostStatusBadge';

interface Account {
  id: string;
  platform: string;
  account_name: string;
  account_avatar_url?: string;
  is_active: boolean;
}

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
};

export default function SocialPostComposer() {
  const navigate = useNavigate();
  const { id } = useParams();
  const addToast = useToastStore((s) => s.addToast);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [content, setContent] = useState('');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus] = useState('draft');
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const { data } = await api.get('/social/accounts');
      setAccounts(data.data);
    } catch {
      addToast('Failed to load accounts', 'error');
    }
  }, [addToast]);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/social/posts/${id}`);
      setContent(data.content);
      setStatus(data.status);
      setSelectedAccountIds(data.accounts?.map((a: any) => a.account_id) || []);
      if (data.scheduled_at) {
        setScheduledAt(new Date(data.scheduled_at).toISOString().slice(0, 16));
      }
    } catch {
      addToast('Failed to load post', 'error');
      navigate('/social');
    } finally {
      setLoading(false);
    }
  }, [id, addToast, navigate]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchPost(); }, [fetchPost]);

  // Character limit warnings
  const selectedPlatforms = accounts
    .filter(a => selectedAccountIds.includes(a.id))
    .map(a => a.platform);
  const uniquePlatforms = [...new Set(selectedPlatforms)];
  const mostRestrictiveLimit = uniquePlatforms.length > 0
    ? Math.min(...uniquePlatforms.map(p => CHAR_LIMITS[p] || 63206))
    : 280;
  const overLimit = content.length > mostRestrictiveLimit;
  const platformWarnings = uniquePlatforms.filter(p => content.length > (CHAR_LIMITS[p] || 63206));

  const isEditable = ['draft', 'scheduled'].includes(status) || !id;

  const handleSave = async () => {
    if (!content.trim() || selectedAccountIds.length === 0) {
      addToast('Content and at least one account are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        content: content.trim(),
        account_ids: selectedAccountIds,
      };

      if (scheduledAt) {
        payload.scheduled_at = new Date(scheduledAt).toISOString();
      }

      if (id) {
        await api.patch(`/social/posts/${id}`, payload);
        addToast('Post updated', 'success');
      } else {
        const { data } = await api.post('/social/posts', payload);
        addToast(scheduledAt ? 'Post scheduled' : 'Post saved as draft', 'success');
        navigate(`/social/compose/${data.id}`);
      }
    } catch {
      addToast('Failed to save post', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!content.trim() || selectedAccountIds.length === 0) {
      addToast('Content and at least one account are required', 'warning');
      return;
    }

    setPublishing(true);
    try {
      let postId = id;

      // Save first if new
      if (!postId) {
        const { data } = await api.post('/social/posts', {
          content: content.trim(),
          account_ids: selectedAccountIds,
        });
        postId = data.id;
      }

      await api.post(`/social/posts/${postId}/publish`);
      addToast('Publishing to selected accounts...', 'success');
      navigate('/social');
    } catch {
      addToast('Failed to publish', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    if (!scheduledAt) {
      addToast('Select a date and time first', 'warning');
      return;
    }

    setSaving(true);
    try {
      let postId = id;

      if (!postId) {
        const { data } = await api.post('/social/posts', {
          content: content.trim(),
          account_ids: selectedAccountIds,
        });
        postId = data.id;
      }

      await api.post(`/social/posts/${postId}/schedule`, {
        scheduled_at: new Date(scheduledAt).toISOString(),
      });
      addToast('Post scheduled', 'success');
      navigate('/social');
    } catch {
      addToast('Failed to schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/social')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {id ? 'Edit Post' : 'Create Post'}
          </h1>
          {id && <PostStatusBadge status={status} />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Content Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Post Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!isEditable}
              rows={8}
              placeholder="What would you like to share?"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {overLimit && (
                  <span className="flex items-center gap-1 text-xs text-red-500">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Over limit for: {platformWarnings.join(', ')}
                  </span>
                )}
              </div>
              <span className={`text-xs ${overLimit ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {content.length} / {mostRestrictiveLimit}
              </span>
            </div>
          </div>

          {/* Platform-specific preview */}
          {content && uniquePlatforms.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Preview</h3>
              <div className="space-y-4">
                {uniquePlatforms.map(platform => {
                  const account = accounts.find(a => a.platform === platform && selectedAccountIds.includes(a.id));
                  const isOver = content.length > (CHAR_LIMITS[platform] || 63206);
                  return (
                    <div key={platform} className={`p-4 rounded-lg border ${isOver ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <PlatformIcon platform={platform} size={16} showLabel />
                        {isOver && <span className="text-xs text-red-500 font-medium">Over {CHAR_LIMITS[platform]} char limit</span>}
                      </div>
                      <div className="flex items-start gap-3">
                        {account?.account_avatar_url ? (
                          <img src={account.account_avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{account?.account_name || platform}</p>
                          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap mt-1">
                            {content.slice(0, CHAR_LIMITS[platform] || 63206)}
                            {isOver && <span className="text-red-500">...</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Settings Panel */}
        <div className="space-y-4">
          {/* Account Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <AccountSelector
              accounts={accounts}
              selectedIds={selectedAccountIds}
              onChange={isEditable ? setSelectedAccountIds : () => {}}
            />
          </div>

          {/* Schedule */}
          {isEditable && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Clock className="h-4 w-4 inline mr-1" /> Schedule (optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Actions */}
          {isEditable && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
              <button
                onClick={handlePublish}
                disabled={publishing || !content.trim() || selectedAccountIds.length === 0 || overLimit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Send className="h-4 w-4" />
                {publishing ? 'Publishing...' : 'Publish Now'}
              </button>

              {scheduledAt && (
                <button
                  onClick={handleSchedule}
                  disabled={saving || !content.trim() || selectedAccountIds.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 disabled:opacity-50 text-sm font-medium"
                >
                  <Clock className="h-4 w-4" />
                  {saving ? 'Scheduling...' : 'Schedule'}
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !content.trim() || selectedAccountIds.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 disabled:opacity-50 text-sm font-medium"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
