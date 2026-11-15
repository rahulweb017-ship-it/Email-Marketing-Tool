import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import { ChannelAvatar } from './PlatformIcon';
import { getQueueSlots, saveQueueSlots, saveQueueTimezone, apiErrorMessage, type QueueSlot, type SocialAccount } from '../../api/social';
import { useToastStore } from '../../stores/toast.store';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMEZONES = ['Asia/Kolkata', 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];

export default function QueueSettingsModal({ isOpen, onClose, accounts }: { isOpen: boolean; onClose: () => void; accounts: SocialAccount[] }) {
  const addToast = useToastStore((s) => s.addToast);
  const [accountId, setAccountId] = useState('');
  const [slots, setSlots] = useState<QueueSlot[]>([]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [newTime, setNewTime] = useState('09:00');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && !accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [isOpen, accounts, accountId]);

  useEffect(() => {
    if (!isOpen || !accountId) return;
    setLoading(true);
    getQueueSlots(accountId)
      .then((d) => { setSlots(d.slots || []); setTimezone(d.timezone || 'Asia/Kolkata'); })
      .catch(() => addToast('Could not load posting times', 'error'))
      .finally(() => setLoading(false));
  }, [isOpen, accountId, addToast]);

  const times = [...new Set(slots.map((s) => s.time_of_day))].sort();
  const has = (d: number, t: string) => slots.some((s) => s.day_of_week === d && s.time_of_day === t);
  const toggle = (d: number, t: string) =>
    setSlots((s) => has(d, t) ? s.filter((x) => !(x.day_of_week === d && x.time_of_day === t)) : [...s, { day_of_week: d, time_of_day: t }]);
  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime) || newDays.length === 0) return;
    setSlots((s) => [...s.filter((x) => x.time_of_day !== newTime || !newDays.includes(x.day_of_week)), ...newDays.map((d) => ({ day_of_week: d, time_of_day: newTime }))]);
  };

  const save = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await Promise.all([saveQueueSlots(accountId, slots), saveQueueTimezone(timezone)]);
      addToast('Posting schedule saved', 'success');
      onClose();
    } catch (err) {
      addToast(apiErrorMessage(err, 'Could not save the schedule'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const tzOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Queue settings" size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={save} disabled={saving || !accountId} className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save schedule'}
          </button>
        </div>
      }>
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500">Connect a channel first to set its posting times.</p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            "Next available" and "Prioritize" put posts into these time slots. Channels without times use 9:00, 13:00 and 17:00 every day.
          </p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <button key={a.id} type="button" onClick={() => setAccountId(a.id)}
                className={`flex items-center gap-2 rounded-full border px-2 py-1 pr-3 text-sm ${accountId === a.id ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}>
                <ChannelAvatar platform={a.platform} name={a.account_name} avatarUrl={a.account_avatar_url} size={24} />
                <span className="max-w-[140px] truncate">{a.account_name}</span>
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Timezone (all channels)</span>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
              {tzOptions.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>
          <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Add a posting time</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100" />
              {DAYS.map((d, i) => (
                <button key={d} type="button" onClick={() => setNewDays((s) => s.includes(i) ? s.filter((x) => x !== i) : [...s, i])}
                  className={`rounded px-2 py-1 text-xs ${newDays.includes(i) ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{d}</button>
              ))}
              <button type="button" onClick={addTime} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><Plus className="h-4 w-4" /> Add</button>
            </div>
          </div>
          {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div> : times.length === 0 ? (
            <p className="text-sm text-gray-500">No custom times for this channel yet (defaults apply).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr><th className="py-1 text-left text-gray-500">Time</th>{DAYS.map((d) => <th key={d} className="py-1 text-gray-500">{d}</th>)}<th /></tr></thead>
                <tbody>
                  {times.map((t) => (
                    <tr key={t} className="border-t dark:border-gray-700">
                      <td className="py-1.5 font-medium text-gray-800 dark:text-gray-200">{t}</td>
                      {DAYS.map((_, d) => (
                        <td key={d} className="text-center"><input type="checkbox" checked={has(d, t)} onChange={() => toggle(d, t)} /></td>
                      ))}
                      <td className="text-right">
                        <button type="button" onClick={() => setSlots((s) => s.filter((x) => x.time_of_day !== t))} className="p-1 text-gray-400 hover:text-red-600" aria-label={`Remove ${t}`}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
