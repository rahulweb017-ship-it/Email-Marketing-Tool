import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';

export async function getContactActivity(orgId: string, contactId: string, pagination: PaginationParams) {
  // Verify contact belongs to org
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');

  const countQuery = db('mailing_traces').where('mailing_traces.contact_id', contactId);
  const [{ count }] = await countQuery.count('* as count');

  const traces = await db('mailing_traces')
    .leftJoin('campaigns', 'mailing_traces.campaign_id', 'campaigns.id')
    .where('mailing_traces.contact_id', contactId)
    .select(
      'mailing_traces.id',
      'mailing_traces.campaign_id',
      'campaigns.name as campaign_name',
      'campaigns.subject as campaign_subject',
      'mailing_traces.trace_status',
      'mailing_traces.sent_at',
      'mailing_traces.first_open_at',
      'mailing_traces.last_open_at',
      'mailing_traces.first_click_at',
      'mailing_traces.last_click_at',
      'mailing_traces.bounced_at',
      'mailing_traces.unsubscribed_at',
      'mailing_traces.replied_at',
      'mailing_traces.created_at',
    )
    .orderBy('mailing_traces.created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  // Transform traces into timeline events
  const events: Array<{
    id: string;
    type: string;
    campaign_id: string;
    campaign_name: string | null;
    campaign_subject: string | null;
    timestamp: string;
  }> = [];

  for (const trace of traces) {
    if (trace.sent_at) {
      events.push({
        id: `${trace.id}-sent`,
        type: 'sent',
        campaign_id: trace.campaign_id,
        campaign_name: trace.campaign_name,
        campaign_subject: trace.campaign_subject,
        timestamp: trace.sent_at,
      });
    }
    if (trace.first_open_at) {
      events.push({
        id: `${trace.id}-opened`,
        type: 'opened',
        campaign_id: trace.campaign_id,
        campaign_name: trace.campaign_name,
        campaign_subject: trace.campaign_subject,
        timestamp: trace.first_open_at,
      });
    }
    if (trace.first_click_at) {
      events.push({
        id: `${trace.id}-clicked`,
        type: 'clicked',
        campaign_id: trace.campaign_id,
        campaign_name: trace.campaign_name,
        campaign_subject: trace.campaign_subject,
        timestamp: trace.first_click_at,
      });
    }
    if (trace.bounced_at) {
      events.push({
        id: `${trace.id}-bounced`,
        type: 'bounced',
        campaign_id: trace.campaign_id,
        campaign_name: trace.campaign_name,
        campaign_subject: trace.campaign_subject,
        timestamp: trace.bounced_at,
      });
    }
    if (trace.unsubscribed_at) {
      events.push({
        id: `${trace.id}-unsubscribed`,
        type: 'unsubscribed',
        campaign_id: trace.campaign_id,
        campaign_name: trace.campaign_name,
        campaign_subject: trace.campaign_subject,
        timestamp: trace.unsubscribed_at,
      });
    }
    if (trace.replied_at) {
      events.push({
        id: `${trace.id}-replied`,
        type: 'replied',
        campaign_id: trace.campaign_id,
        campaign_name: trace.campaign_name,
        campaign_subject: trace.campaign_subject,
        timestamp: trace.replied_at,
      });
    }
  }

  // Sort events by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return { data: events, total: Number(count) };
}

export async function getContactCampaigns(orgId: string, contactId: string, pagination: PaginationParams) {
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');

  const countQuery = db('mailing_traces')
    .join('campaigns', 'mailing_traces.campaign_id', 'campaigns.id')
    .where('mailing_traces.contact_id', contactId);
  const [{ count }] = await countQuery.count('* as count');

  const data = await db('mailing_traces')
    .join('campaigns', 'mailing_traces.campaign_id', 'campaigns.id')
    .where('mailing_traces.contact_id', contactId)
    .select(
      'mailing_traces.id as trace_id',
      'campaigns.id as campaign_id',
      'campaigns.name as campaign_name',
      'campaigns.subject',
      'campaigns.state as campaign_status',
      'mailing_traces.trace_status',
      'mailing_traces.sent_at',
      'mailing_traces.first_open_at',
      'mailing_traces.first_click_at',
      'mailing_traces.bounced_at',
      'mailing_traces.open_count',
      'mailing_traces.click_count',
    )
    .orderBy('mailing_traces.created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getContactStats(orgId: string, contactId: string) {
  const contact = await db('contacts').where({ id: contactId, org_id: orgId }).first();
  if (!contact) throw new AppError(404, 'Contact not found');

  const [stats] = await db('mailing_traces')
    .where('contact_id', contactId)
    .select(
      db.raw('COUNT(*) as total_sent'),
      db.raw('COUNT(first_open_at) as total_opened'),
      db.raw('COUNT(first_click_at) as total_clicked'),
    );

  const totalSent = Number(stats.total_sent) || 0;
  const totalOpened = Number(stats.total_opened) || 0;
  const totalClicked = Number(stats.total_clicked) || 0;

  return {
    total_sent: totalSent,
    total_opened: totalOpened,
    total_clicked: totalClicked,
    open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 10000) / 100 : 0,
    click_rate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 10000) / 100 : 0,
  };
}
