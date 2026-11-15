import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Flame } from 'lucide-react';
import { CHANNEL_COLORS, num, pct, type EngagementDist, type HubData } from './types';
import { Bar, EmptyState, Panel } from './shared';

const SOURCE_LABELS: Record<string, string> = { whatsapp: 'WhatsApp', facebook_ads: 'Facebook Ads', google_ads: 'Google Ads', linkedin: 'LinkedIn' };
const sourceLabel = (src: string | null | undefined) => {
  const key = (src ?? 'other').toLowerCase();
  return SOURCE_LABELS[key] ?? key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const MIX_META: Record<string, { label: string; color: string }> = {
  email: { label: 'Email', color: CHANNEL_COLORS.emails },
  whatsapp: { label: 'WhatsApp', color: CHANNEL_COLORS.whatsapp },
  social: { label: 'Social', color: CHANNEL_COLORS.social },
};

export function ChannelMix({ mix }: { mix: HubData['channel_mix'] }) {
  const data = (mix ?? []).map((m) => ({ ...m, messages: num(m.messages), ...(MIX_META[m.channel] ?? { label: m.channel, color: '#9ca3af' }) }));
  const total = data.reduce((s, d) => s + d.messages, 0);
  return (
    <Panel title="Channel mix" hint="Share of messages and posts by channel in this period">
      {total === 0 ? (
        <EmptyState text="No messages or posts yet in this period." cta="Start a campaign" to="/campaigns" />
      ) : (
        <div className="flex flex-col items-center">
          <div className="relative w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.filter((d) => d.messages > 0)} dataKey="messages" nameKey="label" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                  {data.filter((d) => d.messages > 0).map((d) => <Cell key={d.channel} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{total.toLocaleString()}</span>
              <span className="text-[11px] text-gray-400">total</span>
            </div>
          </div>
          <div className="w-full space-y-1.5 mt-2">
            {data.map((d) => (
              <div key={d.channel} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="flex-1 text-gray-600 dark:text-gray-300">{d.label}</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100">{d.messages.toLocaleString()}</span>
                <span className="text-xs text-gray-400 w-12 text-right">{pct(d.messages, total)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function EmailFunnel({ email, transactional }: { email: HubData['email']; transactional: HubData['transactional'] }) {
  const sent = num(email?.sent);
  return (
    <Panel title="Email" hint="Of the emails sent, how many were opened and clicked">
      {!email || sent === 0 ? (
        <EmptyState text="No emails sent in this period." cta="New campaign" to="/campaigns" />
      ) : (
        <div className="space-y-3">
          <Bar label="Sent" value={sent} max={sent} color={CHANNEL_COLORS.emails} />
          <Bar label="Opened" value={num(email.opened)} max={sent} color="#e04848" suffix={`${pct(email.opened, sent)}%`} />
          <Bar label="Clicked" value={num(email.clicked)} max={sent} color="#f08080" suffix={`${pct(email.clicked, sent)}%`} />
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <Stat label="Campaigns" value={num(email.campaigns_sent)} />
            <Stat label="Bounced" value={num(email.bounced)} />
            <Stat label="Unsubscribed" value={num(email.unsubscribed)} />
          </div>
        </div>
      )}
      {num(transactional?.total) > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Plus {num(transactional?.sent).toLocaleString()} transactional emails sent
          {num(transactional?.failed) > 0 && `, ${num(transactional?.failed).toLocaleString()} failed`}.
        </p>
      )}
    </Panel>
  );
}

export function WhatsAppFunnel({ whatsapp }: { whatsapp: HubData['whatsapp'] }) {
  const sent = num(whatsapp?.sent);
  const inbound = num(whatsapp?.inbound);
  if (!whatsapp || (num(whatsapp.accounts) === 0 && sent === 0 && inbound === 0)) {
    return (
      <Panel title="WhatsApp" hint="Messages delivered to and read by your contacts">
        <EmptyState text="WhatsApp is not connected yet." cta="Connect WhatsApp" to="/whatsapp/accounts" />
      </Panel>
    );
  }
  return (
    <Panel title="WhatsApp" hint="Messages delivered to and read by your contacts">
      {sent === 0 && inbound === 0 ? (
        <EmptyState text="No WhatsApp messages in this period." cta="WhatsApp campaign" to="/whatsapp/campaigns" />
      ) : (
        <div className="space-y-3">
          <Bar label="Sent" value={sent} max={sent} color={CHANNEL_COLORS.whatsapp} />
          <Bar label="Delivered" value={num(whatsapp.delivered)} max={sent} color="#22c55e" suffix={`${pct(whatsapp.delivered, sent)}%`} />
          <Bar label="Read" value={num(whatsapp.read)} max={sent} color="#86efac" suffix={`${pct(whatsapp.read, sent)}%`} />
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <Stat label="Replies in" value={inbound} />
            <Stat label="Active chats" value={num(whatsapp.active_chats)} />
            <Stat label="Failed" value={num(whatsapp.failed)} />
          </div>
          {num(whatsapp.needs_human) > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{num(whatsapp.needs_human)} chats are waiting for a human reply.</p>
          )}
        </div>
      )}
    </Panel>
  );
}

export function SocialPanel({ social }: { social: HubData['social'] }) {
  if (!social || num(social.accounts_connected) === 0) {
    return (
      <Panel title="Social media" hint="Posts published to your connected accounts">
        <EmptyState text="No social accounts connected yet." cta="Connect a social account" to="/social/accounts" />
      </Panel>
    );
  }
  const e = social.engagement;
  return (
    <Panel title="Social media" hint="Posts published to your connected accounts">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Published" value={num(social.published)} />
        <Stat label="Scheduled" value={num(social.scheduled)} />
        <Stat label="Failed" value={num(social.failed)} />
      </div>
      {e && (num(e.likes) + num(e.comments) + num(e.shares) + num(e.reach)) > 0 ? (
        <div className="grid grid-cols-4 gap-2 text-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <Stat label="Likes" value={num(e.likes)} />
          <Stat label="Comments" value={num(e.comments)} />
          <Stat label="Shares" value={num(e.shares)} />
          <Stat label="Reach" value={num(e.reach)} />
        </div>
      ) : num(social.published) === 0 ? (
        <EmptyState text="No posts published in this period." cta="New post" to="/social/compose" />
      ) : null}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{num(social.accounts_connected)} connected accounts</p>
    </Panel>
  );
}

export function LeadsPanel({ leads }: { leads: HubData['leads'] }) {
  const sources = (leads?.by_source ?? []).filter((s) => num(s.count) > 0);
  const max = Math.max(0, ...sources.map((s) => num(s.count)));
  return (
    <Panel title="Leads by source" hint="Where your new leads came from">
      {!leads || sources.length === 0 ? (
        <EmptyState text="No new leads in this period." cta="View leads" to="/leads" />
      ) : (
        <div className="space-y-3">
          {sources.slice(0, 6).map((s) => (
            <Bar key={s.source} label={sourceLabel(s.source)} value={num(s.count)} max={max} color={CHANNEL_COLORS.leads} />
          ))}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <Stat label="Hot" value={num(leads.hot)} />
            <Stat label="Converted" value={num(leads.converted)} />
            <Stat label="Open" value={num(leads.open)} />
          </div>
        </div>
      )}
    </Panel>
  );
}

export function EngagementPanel({ dist }: { dist: EngagementDist | null }) {
  const tiers = [
    { label: 'Cold (0-20)', value: num(dist?.cold), color: '#9ca3af' },
    { label: 'Warm (21-50)', value: num(dist?.warm), color: '#facc15' },
    { label: 'Hot (51-80)', value: num(dist?.hot), color: '#f97316' },
    { label: 'Very hot (81+)', value: num(dist?.very_hot), color: '#cc0000' },
  ];
  const total = tiers.reduce((s, t) => s + t.value, 0);
  return (
    <Panel title="Contact engagement" hint="How actively your contacts interact, scored 0 to 100">
      {total === 0 ? (
        <EmptyState text="Engagement scores appear once contacts open or click your emails." cta="Add contacts" to="/contacts" />
      ) : (
        <div className="space-y-3">
          {tiers.map((t) => <Bar key={t.label} label={t.label} value={t.value} max={total} color={t.color} suffix={`${pct(t.value, total)}%`} />)}
          <p className="text-xs text-gray-400 flex items-center gap-1"><Flame className="h-3 w-3 text-primary-500" />Scores update every hour.</p>
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 py-2">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value.toLocaleString()}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
