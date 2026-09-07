import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import api from '../api/client';
import { useToastStore } from '../stores/toast.store';
import PlatformIcon from '../components/social/PlatformIcon';
import PostStatusBadge from '../components/social/PostStatusBadge';

interface CalendarPost {
  id: string;
  content: string;
  status: string;
  scheduled_at?: string;
  published_at?: string;
  accounts: Array<{ platform: string; account_name: string; status: string }>;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SocialCalendarPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [_loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(currentYear, currentMonth, 1).toISOString();
      const end = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString();
      const { data } = await api.get('/social/posts/calendar', { params: { start, end } });
      setPosts(data.data);
    } catch {
      addToast('Failed to load calendar', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentYear, currentMonth, addToast]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const getPostsForDay = (day: number) => {
    return posts.filter(p => {
      const date = p.scheduled_at || p.published_at;
      if (!date) return false;
      const d = new Date(date);
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  };

  const selectedDayPosts = selectedDay ? getPostsForDay(selectedDay) : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/social')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Post Calendar</h1>
        </div>
        <button
          onClick={() => navigate('/social/compose')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
        >
          <Plus className="h-4 w-4" /> New Post
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {MONTHS[currentMonth]} {currentYear}
              </h2>
              <button
                onClick={goToToday}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Today
              </button>
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-px">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 bg-gray-50 dark:bg-gray-850 rounded" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayPosts = getPostsForDay(day);
              const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
              const isSelected = day === selectedDay;

              return (
                <motion.div
                  key={day}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelectedDay(day)}
                  className={`h-20 p-1.5 rounded cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500'
                      : 'bg-gray-50 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 ${
                    isToday
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-600 text-white text-[10px]">
                        {day}
                      </span>
                    ) : day}
                  </div>
                  {dayPosts.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {dayPosts.slice(0, 3).map((post, j) => (
                        <div key={j} className="flex gap-0.5">
                          {post.accounts?.slice(0, 2).map((acc, k) => (
                            <div key={k} className="w-3 h-3">
                              <PlatformIcon platform={acc.platform} size={12} />
                            </div>
                          ))}
                        </div>
                      ))}
                      {dayPosts.length > 3 && (
                        <span className="text-[9px] text-gray-500">+{dayPosts.length - 3}</span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Side Panel: Selected Day's Posts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {selectedDay
              ? `${MONTHS[currentMonth]} ${selectedDay}, ${currentYear}`
              : 'Select a day to view posts'
            }
          </h3>

          {selectedDay && selectedDayPosts.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No posts on this day</p>
              <button
                onClick={() => navigate('/social/compose')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Create a post
              </button>
            </div>
          )}

          <div className="space-y-3">
            {selectedDayPosts.map(post => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate(`/social/compose/${post.id}`)}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex gap-1">
                    {post.accounts?.map((acc, i) => (
                      <PlatformIcon key={i} platform={acc.platform} size={14} />
                    ))}
                  </div>
                  <PostStatusBadge status={post.status} />
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">{post.content}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  {post.scheduled_at
                    ? new Date(post.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : post.published_at
                      ? new Date(post.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''
                  }
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
