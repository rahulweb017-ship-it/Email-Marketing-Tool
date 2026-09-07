import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Share2, Calendar, Users, ArrowRight, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { useToastStore } from '../stores/toast.store';
import PostStatusBadge from '../components/social/PostStatusBadge';
import PlatformIcon from '../components/social/PlatformIcon';
import { CardGridSkeleton } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_avatar_url?: string;
  is_active: boolean;
  last_error?: string;
}

interface SocialPost {
  id: string;
  content: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  created_at: string;
  accounts: Array<{
    platform: string;
    account_name: string;
    status: string;
  }>;
}

export default function SocialMediaPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountsRes, postsRes] = await Promise.all([
        api.get('/social/accounts'),
        api.get('/social/posts', { params: { per_page: '10' } }),
      ]);
      setAccounts(accountsRes.data.data);
      setPosts(postsRes.data.data);
    } catch {
      addToast('Failed to load social media data', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeAccounts = accounts.filter(a => a.is_active);
  const scheduledCount = posts.filter(p => p.status === 'scheduled').length;
  const publishedCount = posts.filter(p => p.status === 'published').length;
  const failedCount = posts.filter(p => ['failed', 'partially_failed'].includes(p.status)).length;

  if (loading) return <CardGridSkeleton />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Social Media</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage accounts and publish to multiple platforms</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/social/calendar')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Calendar className="h-4 w-4" /> Calendar
          </button>
          <button
            onClick={() => navigate('/social/compose')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Plus className="h-4 w-4" /> New Post
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeAccounts.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Connected Accounts</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{scheduledCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Scheduled</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{publishedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Published</p>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failedCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Connected Accounts */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Connected Accounts</h2>
          <button
            onClick={() => navigate('/social/accounts')}
            className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            Manage <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <EmptyState
              icon={Share2}
              title="No accounts connected"
              description="Connect your social media accounts to start posting"
              action={{ label: 'Connect Account', onClick: () => navigate('/social/accounts') }}
            />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {accounts.map(account => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 min-w-[200px]"
              >
                <div className="flex items-center gap-3">
                  {account.account_avatar_url ? (
                    <img src={account.account_avatar_url} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <PlatformIcon platform={account.platform} size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{account.account_name}</p>
                    <div className="flex items-center gap-1.5">
                      <PlatformIcon platform={account.platform} size={12} />
                      <span className={`w-1.5 h-1.5 rounded-full ${account.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Posts</h2>
        </div>
        {posts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <EmptyState
              icon={Share2}
              title="No posts yet"
              description="Create your first social media post"
              action={{ label: 'Create Post', onClick: () => navigate('/social/compose') }}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/social/compose/${post.id}`)}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1">
                          {post.accounts?.map((acc, j) => (
                            <PlatformIcon key={j} platform={acc.platform} size={14} />
                          ))}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {post.scheduled_at
                            ? `Scheduled: ${new Date(post.scheduled_at).toLocaleDateString()}`
                            : post.published_at
                              ? `Published: ${new Date(post.published_at).toLocaleDateString()}`
                              : new Date(post.created_at).toLocaleDateString()
                          }
                        </span>
                      </div>
                    </div>
                    <PostStatusBadge status={post.status} />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
