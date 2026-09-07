import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { PageLoader } from '../ui/Spinner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCountUp } from '../../hooks/useCountUp';
import api from '../../api/client';

interface CampaignStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
}

function CountUpStat({ value, color, label }: { value: number; color: string; label: string }) {
  const animated = useCountUp(value);
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className="text-2xl font-bold" style={{ color }}>{animated.toLocaleString()}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function CampaignStatsModal({ isOpen, onClose, campaignId, campaignName }: CampaignStatsModalProps) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !campaignId) return;
    setLoading(true);
    api.get(`/campaigns/${campaignId}/stats`)
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [isOpen, campaignId]);

  const chartData = stats ? [
    { name: 'Sent', value: stats.sent || 0, fill: '#6366f1' },
    { name: 'Opened', value: stats.opened || 0, fill: '#f59e0b' },
    { name: 'Clicked', value: stats.clicked || 0, fill: '#22c55e' },
    { name: 'Bounced', value: stats.bounced || 0, fill: '#ef4444' },
    { name: 'Replied', value: stats.replied || 0, fill: '#3b82f6' },
  ] : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Stats - ${campaignName}`} size="lg">
      {loading ? <PageLoader /> : !stats ? (
        <p className="text-center text-gray-500 py-8">No stats available for this campaign</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-5 gap-4">
            {chartData.map((d) => (
              <CountUpStat key={d.name} value={d.value} color={d.fill} label={d.name} />
            ))}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Modal>
  );
}
