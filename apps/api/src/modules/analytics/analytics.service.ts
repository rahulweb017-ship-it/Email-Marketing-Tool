import { db } from '../../config/database.js';
import { HUB_TZ, dayKeys, mergeRecent, rate, zeroFillDaily, type RecentItem } from './analytics.utils.js';

const n = (v: unknown) => Number(v ?? 0) || 0;
const dayExpr = (col: string) => db.raw(`to_char((${col} AT TIME ZONE '${HUB_TZ}')::date, 'YYYY-MM-DD') AS day`);
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : '');

/** Runs a section query; a missing table/column for one section yields null instead of failing the hub. */
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[analytics/hub] section "${label}" failed:`, (err as Error)?.message ?? err);
    return null;
  }
}

type DayRows = Array<{ day: string; count: unknown }>;

async function contactsSection(orgId: string, from: Date) {
  const row: any = await db('contacts').where('org_id', orgId)
    .select(db.raw('COUNT(*) AS total'), db.raw('COUNT(*) FILTER (WHERE created_at >= ?) AS new_in_period', [from]))
    .first();
  const unsub = await safe('contacts.unsubscribed', async () => {
    const [r]: any = await db('subscriptions').join('contacts', 'contacts.id', 'subscriptions.contact_id')
      .where('contacts.org_id', orgId).where('subscriptions.opt_out', true).where('subscriptions.opt_out_at', '>=', from)
      .countDistinct('subscriptions.contact_id as c');
    return n(r?.c);
  });
  const reachable = await safe('contacts.whatsapp', async () => {
    const [r]: any = await db('contacts').where({ org_id: orgId, whatsapp_opt_out: false }).whereNotNull('phone_e164').count('id as c');
    return n(r?.c);
  });
  return {
    total: n(row?.total),
    new_in_period: n(row?.new_in_period),
    unsubscribed_in_period: unsub,
    whatsapp_reachable: reachable,
  };
}

async function emailSection(orgId: string, from: Date) {
  const r: any = await db('mailing_traces').join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
    .where('campaigns.org_id', orgId).where('mailing_traces.sent_at', '>=', from)
    .select(
      db.raw('COUNT(*) AS sent'),
      db.raw('COUNT(*) FILTER (WHERE mailing_traces.delivered_at IS NOT NULL) AS delivered'),
      db.raw('COUNT(*) FILTER (WHERE mailing_traces.first_open_at IS NOT NULL) AS opened'),
      db.raw('COUNT(*) FILTER (WHERE mailing_traces.first_click_at IS NOT NULL) AS clicked'),
      db.raw("COUNT(*) FILTER (WHERE mailing_traces.trace_status = 'bounced') AS bounced"),
      db.raw('COUNT(*) FILTER (WHERE mailing_traces.unsubscribed_at IS NOT NULL) AS unsubscribed'),
    ).first();
  const campaignsSent = await safe('email.campaigns', async () => {
    const [c]: any = await db('campaigns').where({ org_id: orgId, state: 'done', is_automation: false })
      .where('sent_date', '>=', from).count('* as c');
    return n(c?.c);
  });
  const sent = n(r?.sent);
  return {
    campaigns_sent: campaignsSent,
    sent,
    delivered: n(r?.delivered),
    opened: n(r?.opened),
    clicked: n(r?.clicked),
    bounced: n(r?.bounced),
    unsubscribed: n(r?.unsubscribed),
    open_rate: rate(n(r?.opened), sent),
    click_rate: rate(n(r?.clicked), sent),
  };
}

async function transactionalSection(orgId: string, from: Date) {
  const r: any = await db('transactional_messages').where('org_id', orgId).where('created_at', '>=', from)
    .select(
      db.raw('COUNT(*) AS total'),
      db.raw('COUNT(*) FILTER (WHERE sent_at IS NOT NULL) AS sent'),
      db.raw("COUNT(*) FILTER (WHERE status = 'failed') AS failed"),
      db.raw("COUNT(*) FILTER (WHERE status = 'queued') AS queued"),
    ).first();
  return { total: n(r?.total), sent: n(r?.sent), failed: n(r?.failed), queued: n(r?.queued) };
}

async function whatsappSection(orgId: string, from: Date) {
  const out: any = await db('whatsapp_messages').where({ org_id: orgId, direction: 'out' }).where('created_at', '>=', from)
    .select(
      db.raw(`COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent`),
      db.raw(`COUNT(*) FILTER (WHERE status IN ('delivered','read')) AS delivered`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'read') AS read`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'failed') AS failed`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'queued') AS queued`),
    ).first();
  const inbound: any = await db('whatsapp_messages').where({ org_id: orgId, direction: 'in' }).where('created_at', '>=', from)
    .select(db.raw('COUNT(*) AS received'), db.raw('COUNT(DISTINCT conversation_id) AS active_chats')).first();
  const conv: any = await db('whatsapp_conversations').where('org_id', orgId)
    .select(db.raw(`COUNT(*) FILTER (WHERE status = 'needs_human') AS needs_human`), db.raw('COUNT(*) FILTER (WHERE unread_count > 0) AS unread')).first();
  const [camp]: any = await db('whatsapp_campaigns').where('org_id', orgId).where('created_at', '>=', from).count('* as c');
  const [acc]: any = await db('whatsapp_accounts').where('org_id', orgId).count('* as c');
  const sent = n(out?.sent);
  return {
    sent,
    delivered: n(out?.delivered),
    read: n(out?.read),
    failed: n(out?.failed),
    queued: n(out?.queued),
    inbound: n(inbound?.received),
    active_chats: n(inbound?.active_chats),
    needs_human: n(conv?.needs_human),
    unread_conversations: n(conv?.unread),
    campaigns: n(camp?.c),
    accounts: n(acc?.c),
    read_rate: rate(n(out?.read), sent),
  };
}

async function socialSection(orgId: string, from: Date) {
  const posts: any = await db('social_posts').where('org_id', orgId)
    .select(
      db.raw(`COUNT(*) FILTER (WHERE status = 'published' AND published_at >= ?) AS published`, [from]),
      db.raw(`COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled`),
      db.raw(`COUNT(*) FILTER (WHERE status IN ('failed','partially_failed') AND updated_at >= ?) AS failed`, [from]),
    ).first();
  const [acc]: any = await db('social_accounts').where({ org_id: orgId, is_active: true }).count('* as c');
  const engagement = await safe('social.metrics', async () => {
    // Metrics are snapshots; only the latest row per post/account pair counts.
    const r: any = await db.raw(
      `SELECT COALESCE(SUM(likes),0) AS likes, COALESCE(SUM(comments),0) AS comments, COALESCE(SUM(shares),0) AS shares,
              COALESCE(SUM(reach),0) AS reach, COALESCE(SUM(impressions),0) AS impressions, COALESCE(SUM(clicks),0) AS clicks
       FROM (
         SELECT DISTINCT ON (m.post_account_id) m.*
         FROM social_post_metrics m
         JOIN social_post_accounts pa ON pa.id = m.post_account_id
         JOIN social_posts p ON p.id = pa.post_id
         WHERE p.org_id = ? AND p.published_at >= ?
         ORDER BY m.post_account_id, m.fetched_at DESC
       ) latest`, [orgId, from]);
    const row = r?.rows?.[0] ?? {};
    return { likes: n(row.likes), comments: n(row.comments), shares: n(row.shares), reach: n(row.reach), impressions: n(row.impressions), clicks: n(row.clicks) };
  });
  return {
    published: n(posts?.published),
    scheduled: n(posts?.scheduled),
    failed: n(posts?.failed),
    accounts_connected: n(acc?.c),
    engagement,
  };
}

async function leadsSection(orgId: string, from: Date) {
  const r: any = await db('leads').where('org_id', orgId)
    .select(
      db.raw('COUNT(*) FILTER (WHERE created_at >= ?) AS new', [from]),
      db.raw(`COUNT(*) FILTER (WHERE created_at >= ? AND temperature = 'hot') AS hot`, [from]),
      db.raw(`COUNT(*) FILTER (WHERE status = 'converted' AND updated_at >= ?) AS converted`, [from]),
      db.raw(`COUNT(*) FILTER (WHERE status IN ('new','contacted','qualified')) AS open`),
    ).first();
  const bySource = await db('leads').where('org_id', orgId).where('created_at', '>=', from)
    .select('source', db.raw('COUNT(*) AS count')).groupBy('source').orderBy('count', 'desc');
  return {
    new: n(r?.new),
    hot: n(r?.hot),
    converted: n(r?.converted),
    open: n(r?.open),
    by_source: bySource.map((s: any) => ({ source: String(s.source ?? 'unknown'), count: n(s.count) })),
  };
}

async function automationsSection(orgId: string, from: Date) {
  const [active]: any = await db('automation_campaigns').where({ org_id: orgId, state: 'running' }).count('* as c');
  const [participants]: any = await db('automation_participants')
    .join('automation_campaigns', 'automation_campaigns.id', 'automation_participants.campaign_id')
    .where('automation_campaigns.org_id', orgId).where('automation_participants.state', 'running')
    .count('automation_participants.id as c');
  const emails = await safe('automations.emails', async () => {
    const [r]: any = await db('mailing_traces').join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where({ 'campaigns.org_id': orgId, 'campaigns.is_automation': true })
      .where('mailing_traces.sent_at', '>=', from).count('mailing_traces.id as c');
    return n(r?.c);
  });
  return { active: n(active?.c), contacts_in_progress: n(participants?.c), emails_sent: emails };
}

async function dailySection(orgId: string, from: Date, days: number) {
  const [emails, whatsapp, social, leads, contacts] = await Promise.all([
    safe('daily.emails', () => db('mailing_traces').join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
      .where('campaigns.org_id', orgId).where('mailing_traces.sent_at', '>=', from)
      .select(dayExpr('mailing_traces.sent_at'), db.raw('COUNT(*) AS count')).groupByRaw('1') as Promise<DayRows>),
    safe('daily.whatsapp', () => db('whatsapp_messages').where('org_id', orgId).where('created_at', '>=', from)
      .where((q) => q.where('direction', 'in').orWhereIn('status', ['sent', 'delivered', 'read']))
      .select(dayExpr('created_at'), db.raw('COUNT(*) AS count')).groupByRaw('1') as Promise<DayRows>),
    safe('daily.social', () => db('social_posts').where('org_id', orgId).where('published_at', '>=', from)
      .select(dayExpr('published_at'), db.raw('COUNT(*) AS count')).groupByRaw('1') as Promise<DayRows>),
    safe('daily.leads', () => db('leads').where('org_id', orgId).where('created_at', '>=', from)
      .select(dayExpr('created_at'), db.raw('COUNT(*) AS count')).groupByRaw('1') as Promise<DayRows>),
    safe('daily.contacts', () => db('contacts').where('org_id', orgId).where('created_at', '>=', from)
      .select(dayExpr('created_at'), db.raw('COUNT(*) AS count')).groupByRaw('1') as Promise<DayRows>),
  ]);
  return zeroFillDaily(dayKeys(days), { emails, whatsapp, social, leads, contacts },
    ['emails', 'whatsapp', 'social', 'leads', 'contacts'] as const);
}

async function recentSection(orgId: string) {
  const limit = 15;
  const groups = await Promise.all([
    safe('recent.opens', async (): Promise<RecentItem[]> => {
      const rows = await db('mailing_traces').join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
        .where('campaigns.org_id', orgId).whereNotNull('mailing_traces.first_open_at')
        .select('mailing_traces.email', 'mailing_traces.first_open_at as at', 'campaigns.name')
        .orderBy('mailing_traces.first_open_at', 'desc').limit(limit);
      return rows.map((r: any) => ({ type: 'email_open', title: r.email ?? 'Someone', subtitle: `Opened "${r.name ?? 'a campaign'}"`, at: iso(r.at) }));
    }),
    safe('recent.clicks', async (): Promise<RecentItem[]> => {
      const rows = await db('mailing_traces').join('campaigns', 'campaigns.id', 'mailing_traces.campaign_id')
        .where('campaigns.org_id', orgId).whereNotNull('mailing_traces.first_click_at')
        .select('mailing_traces.email', 'mailing_traces.first_click_at as at', 'campaigns.name')
        .orderBy('mailing_traces.first_click_at', 'desc').limit(limit);
      return rows.map((r: any) => ({ type: 'email_click', title: r.email ?? 'Someone', subtitle: `Clicked a link in "${r.name ?? 'a campaign'}"`, at: iso(r.at) }));
    }),
    safe('recent.leads', async (): Promise<RecentItem[]> => {
      const rows = await db('leads').where('org_id', orgId)
        .select('name', 'email', 'phone', 'source', 'temperature', 'created_at as at').orderBy('created_at', 'desc').limit(limit);
      return rows.map((r: any) => ({
        type: 'lead',
        title: r.name || r.email || r.phone || 'New lead',
        subtitle: `New ${r.temperature === 'hot' ? 'hot ' : ''}lead from ${r.source ?? 'unknown source'}`,
        at: iso(r.at),
      }));
    }),
    safe('recent.whatsapp', async (): Promise<RecentItem[]> => {
      const rows = await db('whatsapp_messages as m')
        .leftJoin('whatsapp_conversations as c', 'c.id', 'm.conversation_id')
        .where({ 'm.org_id': orgId, 'm.direction': 'in' })
        .select('m.phone_e164', 'm.body', 'm.type', 'c.profile_name', 'm.created_at as at').orderBy('m.created_at', 'desc').limit(limit);
      return rows.map((r: any) => ({
        type: 'whatsapp_in',
        title: r.profile_name || r.phone_e164 || 'WhatsApp contact',
        subtitle: r.body ? String(r.body).slice(0, 80) : `Sent a ${r.type ?? 'message'}`,
        at: iso(r.at),
      }));
    }),
    safe('recent.social', async (): Promise<RecentItem[]> => {
      const rows = await db('social_posts').where({ org_id: orgId, status: 'published' }).whereNotNull('published_at')
        .select('content', 'published_at as at').orderBy('published_at', 'desc').limit(limit);
      return rows.map((r: any) => ({ type: 'social_post', title: 'Social post published', subtitle: String(r.content ?? '').slice(0, 80), at: iso(r.at) }));
    }),
    safe('recent.contacts', async (): Promise<RecentItem[]> => {
      const rows = await db('contacts').where('org_id', orgId)
        .select('email', 'phone_e164', 'first_name', 'last_name', 'source', 'created_at as at').orderBy('created_at', 'desc').limit(limit);
      return rows.map((r: any) => ({
        type: 'contact',
        title: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || r.phone_e164 || 'New contact',
        subtitle: r.source ? `Added via ${r.source}` : 'New contact added',
        at: iso(r.at),
      }));
    }),
  ]);
  return mergeRecent(groups, limit);
}

export async function getHub(orgId: string, days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const [contacts, email, transactional, whatsapp, social, leads, automations, daily, recent] = await Promise.all([
    safe('contacts', () => contactsSection(orgId, from)),
    safe('email', () => emailSection(orgId, from)),
    safe('transactional', () => transactionalSection(orgId, from)),
    safe('whatsapp', () => whatsappSection(orgId, from)),
    safe('social', () => socialSection(orgId, from)),
    safe('leads', () => leadsSection(orgId, from)),
    safe('automations', () => automationsSection(orgId, from)),
    safe('daily', () => dailySection(orgId, from, days)),
    safe('recent', () => recentSection(orgId)),
  ]);
  const channel_mix = [
    { channel: 'email', messages: (email?.sent ?? 0) + (transactional?.sent ?? 0) },
    { channel: 'whatsapp', messages: (whatsapp?.sent ?? 0) + (whatsapp?.inbound ?? 0) },
    { channel: 'social', messages: social?.published ?? 0 },
  ];
  return {
    range: { days, from: from.toISOString(), to: to.toISOString() },
    contacts, email, transactional, whatsapp, social, leads, automations,
    daily: daily ?? zeroFillDaily(dayKeys(days), {}, ['emails', 'whatsapp', 'social', 'leads', 'contacts'] as const),
    channel_mix,
    recent: recent ?? [],
  };
}
