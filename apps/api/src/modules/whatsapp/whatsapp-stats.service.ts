import { db } from '../../config/database.js';
import { getOrgLimits, getWhatsAppUsage } from '../usage/usage.service.js';
import { listAccounts } from './whatsapp-accounts.service.js';

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Headline numbers for the WhatsApp dashboard. */
export async function getOverview(orgId: string, days = 30) {
  const from = since(days);
  const out = await db('whatsapp_messages')
    .where({ org_id: orgId, direction: 'out' })
    .where('created_at', '>=', from)
    .select(
      db.raw(`COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent`),
      db.raw(`COUNT(*) FILTER (WHERE status IN ('delivered','read')) AS delivered`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'read') AS read`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'failed') AS failed`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'queued') AS queued`),
      db.raw(`COUNT(*) FILTER (WHERE sent_by = 'ai' AND status IN ('sent','delivered','read')) AS ai_replies`),
      db.raw(`COUNT(*) FILTER (WHERE campaign_id IS NOT NULL AND status IN ('sent','delivered','read')) AS campaign_sent`),
    )
    .first();
  const inbound = await db('whatsapp_messages')
    .where({ org_id: orgId, direction: 'in' })
    .where('created_at', '>=', from)
    .select(db.raw('COUNT(*) AS received'), db.raw('COUNT(DISTINCT conversation_id) AS conversations_with_replies'))
    .first();
  const [{ opted_out }] = await db('contacts').where({ org_id: orgId, whatsapp_opt_out: true })
    .where('whatsapp_opt_out_at', '>=', from).count('id as opted_out');
  const conv = await db('whatsapp_conversations').where('org_id', orgId)
    .select(
      db.raw(`COUNT(*) FILTER (WHERE status = 'open') AS open`),
      db.raw(`COUNT(*) FILTER (WHERE status = 'needs_human') AS needs_human`),
      db.raw(`COUNT(*) FILTER (WHERE unread_count > 0) AS unread`),
    ).first();
  const [{ campaigns_reached }] = await db('whatsapp_messages')
    .where({ org_id: orgId, direction: 'out' })
    .whereNotNull('campaign_id')
    .whereIn('status', ['sent', 'delivered', 'read'])
    .where('created_at', '>=', from)
    .countDistinct('conversation_id as campaigns_reached');
  const [{ campaigns_replied }] = await db('whatsapp_campaigns').where('org_id', orgId).where('created_at', '>=', from)
    .sum('stat_replied as campaigns_replied');

  const n = (v: unknown) => Number(v || 0);
  const sent = n(out?.sent);
  const limits = await getOrgLimits(orgId);
  return {
    days,
    sent,
    delivered: n(out?.delivered),
    read: n(out?.read),
    failed: n(out?.failed),
    queued: n(out?.queued),
    received: n(inbound?.received),
    conversations_with_replies: n(inbound?.conversations_with_replies),
    ai_replies: n(out?.ai_replies),
    opted_out: n(opted_out),
    delivery_rate: sent ? n(out?.delivered) / sent : 0,
    read_rate: sent ? n(out?.read) / sent : 0,
    campaign_reply_rate: n(campaigns_reached) ? n(campaigns_replied) / n(campaigns_reached) : 0,
    open_conversations: n(conv?.open),
    needs_human: n(conv?.needs_human),
    unread_conversations: n(conv?.unread),
    usage_this_month: await getWhatsAppUsage(orgId),
    monthly_limit: limits.max_whatsapp_messages_per_month,
  };
}

/** Daily sent vs received (+ delivered/read) for the chart. Dates are India local days. */
export async function getDaily(orgId: string, days = 30) {
  const rows = await db('whatsapp_messages')
    .where('org_id', orgId)
    .where('created_at', '>=', since(days))
    .select(
      db.raw(`to_char((created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day`),
      db.raw(`COUNT(*) FILTER (WHERE direction = 'out' AND status IN ('sent','delivered','read')) AS sent`),
      db.raw(`COUNT(*) FILTER (WHERE direction = 'out' AND status IN ('delivered','read')) AS delivered`),
      db.raw(`COUNT(*) FILTER (WHERE direction = 'out' AND status = 'read') AS read`),
      db.raw(`COUNT(*) FILTER (WHERE direction = 'out' AND status = 'failed') AS failed`),
      db.raw(`COUNT(*) FILTER (WHERE direction = 'in') AS received`),
    )
    .groupByRaw('1')
    .orderBy('day');
  const byDay = new Map(rows.map((r: any) => [r.day, r]));
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(since(i));
    const r: any = byDay.get(day);
    result.push({
      day,
      sent: Number(r?.sent || 0),
      delivered: Number(r?.delivered || 0),
      read: Number(r?.read || 0),
      failed: Number(r?.failed || 0),
      received: Number(r?.received || 0),
    });
  }
  return result;
}

export async function getAccountHealth(orgId: string) {
  const accounts = await listAccounts(orgId);
  const since7 = since(7);
  return Promise.all(accounts.map(async (a) => {
    const s = await db('whatsapp_messages').where({ account_id: a.id, direction: 'out' }).where('created_at', '>=', since7)
      .select(
        db.raw(`COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')) AS sent`),
        db.raw(`COUNT(*) FILTER (WHERE status = 'failed') AS failed`),
        db.raw(`COUNT(*) FILTER (WHERE status = 'queued') AS queued`),
      ).first() as any;
    const sent = Number(s?.sent || 0);
    const failed = Number(s?.failed || 0);
    return {
      id: a.id,
      name: a.name,
      provider: a.provider,
      status: a.status,
      phone_e164: a.phone_e164,
      sent_today: a.sent_today,
      daily_cap: a.daily_cap,
      warmup_day: a.warmup_day,
      queued: Number(s?.queued || 0),
      sent_7d: sent,
      failure_rate_7d: sent + failed ? failed / (sent + failed) : 0,
      last_error: a.last_error,
    };
  }));
}

export async function getCampaignStats(orgId: string, campaignId: string) {
  const campaign = await db('whatsapp_campaigns').where({ id: campaignId, org_id: orgId }).first();
  if (!campaign) return null;
  const byStatus = await db('whatsapp_messages').where('campaign_id', campaignId).groupBy('status')
    .select('status', db.raw('COUNT(*) AS count'));
  const readsByHour = await db('whatsapp_messages').where('campaign_id', campaignId).whereNotNull('read_at')
    .select(db.raw(`EXTRACT(HOUR FROM read_at AT TIME ZONE 'Asia/Kolkata')::int AS hour`), db.raw('COUNT(*) AS count'))
    .groupByRaw('1').orderBy('hour');
  return {
    campaign,
    by_status: Object.fromEntries(byStatus.map((r: any) => [r.status, Number(r.count)])),
    reads_by_hour: readsByHour.map((r: any) => ({ hour: Number(r.hour), count: Number(r.count) })),
  };
}
