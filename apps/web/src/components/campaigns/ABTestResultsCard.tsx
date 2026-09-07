import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Send, BarChart3, MousePointerClick, Mail, Loader2 } from 'lucide-react';
import Badge from '../ui/Badge';
import { Spinner, ButtonSpinner } from '../ui/Spinner';
import { useToastStore } from '../../stores/toast.store';
import clsx from 'clsx';
import api from '../../api/client';

interface ABTestResultsCardProps {
  groupId: string;
}

interface VariantData {
  id: string;
  name: string;
  subject: string;
  state: string;
  stat_sent: number;
  stat_opened: number;
  stat_clicked: number;
  open_rate: string;
  click_rate: string;
}

interface AbTestGroup {
  id: string;
  name: string;
  status: string;
  test_percentage: number;
  winner_criteria: string;
  evaluation_hours: number;
  winner_campaign_id: string | null;
  variants: VariantData[];
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'neutral' | 'warning' | 'info' | 'success' }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  testing: { label: 'Testing', variant: 'info' },
  winner_picked: { label: 'Winner Picked', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
};

export default function ABTestResultsCard({ groupId }: ABTestResultsCardProps) {
  const addToast = useToastStore((s) => s.addToast);
  const [data, setData] = useState<AbTestGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingWinner, setSendingWinner] = useState(false);
  const [pickingWinner, setPickingWinner] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: result } = await api.get(`/ab-tests/${groupId}`);
      setData(result);
    } catch {
      addToast('Failed to load A/B test results', 'error');
    } finally {
      setLoading(false);
    }
  }, [groupId, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePickWinner = async () => {
    setPickingWinner(true);
    try {
      await api.post(`/ab-tests/${groupId}/pick-winner`);
      addToast('Winner picked successfully', 'success');
      fetchData();
    } catch {
      addToast('Failed to pick winner', 'error');
    } finally {
      setPickingWinner(false);
    }
  };

  const handleSendWinner = async () => {
    setSendingWinner(true);
    try {
      await api.post(`/ab-tests/${groupId}/send-winner`);
      addToast('Winner sent to remaining recipients', 'success');
      fetchData();
    } catch {
      addToast('Failed to send winner', 'error');
    } finally {
      setSendingWinner(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  const config = statusConfig[data.status] || statusConfig.draft;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">{data.name}</h3>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Winner by {data.winner_criteria === 'click_rate' ? 'click rate' : 'open rate'}
            {' '}&middot;{' '}
            Test: {data.test_percentage}% &middot; Evaluation: {data.evaluation_hours}h
          </p>
        </div>
        <div className="flex gap-2">
          {data.status === 'testing' && (
            <button onClick={handlePickWinner} disabled={pickingWinner}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              {pickingWinner ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4 text-amber-500" />}
              Pick Winner
            </button>
          )}
          {data.status === 'winner_picked' && (
            <button onClick={handleSendWinner} disabled={sendingWinner}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
              {sendingWinner ? <ButtonSpinner /> : <Send className="h-4 w-4" />}
              Send Winner to Remaining
            </button>
          )}
        </div>
      </div>

      {/* Variant comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.variants.map((variant, i) => {
          const isWinner = variant.id === data.winner_campaign_id;
          return (
            <motion.div
              key={variant.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className={clsx(
                'border-2 rounded-xl p-4 relative transition-all',
                isWinner ? 'border-green-400 bg-green-50/50 ring-2 ring-green-100' : 'border-gray-100',
              )}
            >
              {isWinner && (
                <div className="absolute -top-3 -right-3 bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                  <Trophy className="h-4 w-4" />
                </div>
              )}

              <div className="mb-3">
                <h4 className="font-medium text-sm">{variant.name}</h4>
                <p className="text-xs text-gray-500 mt-0.5 truncate" title={variant.subject}>
                  {variant.subject}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Mail className="h-3.5 w-3.5" /> Sent
                  </div>
                  <span className="text-sm font-semibold">{variant.stat_sent}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <BarChart3 className="h-3.5 w-3.5" /> Open Rate
                  </div>
                  <span className={clsx(
                    'text-sm font-semibold',
                    isWinner && data.winner_criteria === 'open_rate' ? 'text-green-600' : '',
                  )}>
                    {variant.open_rate}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MousePointerClick className="h-3.5 w-3.5" /> Click Rate
                  </div>
                  <span className={clsx(
                    'text-sm font-semibold',
                    isWinner && data.winner_criteria === 'click_rate' ? 'text-green-600' : '',
                  )}>
                    {variant.click_rate}%
                  </span>
                </div>

                {/* Visual bar for the winning metric */}
                {data.status !== 'draft' && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={clsx('h-full rounded-full', isWinner ? 'bg-green-500' : 'bg-primary-400')}
                        initial={{ width: '0%' }}
                        animate={{
                          width: `${Math.min(100, parseFloat(
                            data.winner_criteria === 'click_rate' ? variant.click_rate : variant.open_rate,
                          ) * 2)}%`,
                        }}
                        transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
