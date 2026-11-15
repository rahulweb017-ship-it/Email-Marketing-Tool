import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { CHANNEL_COLORS, type HubDaily } from './types';
import { Panel, EmptyState } from './shared';

const SERIES = [
  { key: 'emails', name: 'Emails sent' },
  { key: 'whatsapp', name: 'WhatsApp messages' },
  { key: 'social', name: 'Social posts' },
  { key: 'leads', name: 'New leads' },
] as const;

function label(date: string) {
  try { return format(parseISO(date), 'd MMM'); } catch { return date; }
}

export default function ActivityChart({ daily }: { daily: HubDaily[] }) {
  const hasData = daily.some((d) => SERIES.some((s) => (d[s.key] ?? 0) > 0));
  return (
    <Panel title="Activity over time" hint="Messages sent, posts published and leads captured each day" className="lg:col-span-2">
      {!hasData ? (
        <EmptyState text="Nothing has happened in this period yet. Send a campaign to see activity here." cta="Create a campaign" to="/campaigns" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={daily} margin={{ left: -20, right: 8 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`dash-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHANNEL_COLORS[s.key]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={CHANNEL_COLORS[s.key]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.6} />
            <XAxis dataKey="date" tickFormatter={label} tick={{ fontSize: 11 }} stroke="#9ca3af" minTickGap={20} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip labelFormatter={(v) => label(String(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stackId="1"
                stroke={CHANNEL_COLORS[s.key]} fill={`url(#dash-${s.key})`} strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
