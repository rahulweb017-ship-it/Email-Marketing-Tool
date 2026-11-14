import { Worker, Job } from 'bullmq';
import { db } from '../config/database.js';
import { redis } from '../config/redis.js';
import { bestSendHour } from '../shared/utils/send-time.js';

const BATCH_SIZE = 500;

/**
 * Calculate engagement score for contacts based on mailing_traces.
 * Scoring:
 *   - Each first_open_at: +1
 *   - Each first_click_at: +3
 *   - Each trace_status = 'bounced': -10
 *   - Time decay: events older than 30 days get 50% weight, older than 90 days get 25% weight
 */
export async function recalculateEngagementScores(orgId?: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  let offset = 0;
  let processed = 0;

  while (true) {
    // Fetch a batch of contact IDs
    let contactQuery = db('contacts').select('id');
    if (orgId) {
      contactQuery = contactQuery.where('org_id', orgId);
    }
    const contacts = await contactQuery
      .orderBy('id')
      .limit(BATCH_SIZE)
      .offset(offset);

    if (contacts.length === 0) break;

    const contactIds = contacts.map((c: { id: string }) => c.id);

    // Fetch all relevant traces for this batch
    const traces = await db('mailing_traces')
      .whereIn('contact_id', contactIds)
      .select(
        'contact_id',
        'sent_at',
        'first_open_at',
        'last_open_at',
        'first_click_at',
        'trace_status',
      );

    // Group traces by contact_id
    const tracesByContact = new Map<string, typeof traces>();
    for (const trace of traces) {
      const existing = tracesByContact.get(trace.contact_id) || [];
      existing.push(trace);
      tracesByContact.set(trace.contact_id, existing);
    }

    // Calculate scores and batch update
    const updates: Array<{ id: string; score: number; hour: number | null }> = [];

    for (const contactId of contactIds) {
      const contactTraces = tracesByContact.get(contactId) || [];
      let score = 0;

      for (const trace of contactTraces) {
        // Determine the event timestamp for time decay
        // Use the most relevant timestamp from the trace
        const eventTime = trace.first_click_at || trace.first_open_at || trace.sent_at;
        const weight = getTimeDecayWeight(eventTime, now, thirtyDaysAgo, ninetyDaysAgo);

        // Score open events
        if (trace.first_open_at) {
          score += 1 * weight;
        }

        // Score click events
        if (trace.first_click_at) {
          score += 3 * weight;
        }

        // Penalty for bounced
        if (trace.trace_status === 'bounced') {
          score -= 10 * weight;
        }
      }

      // Clamp to 0 minimum
      const opens = contactTraces.flatMap((t) => {
        const times = [t.first_open_at];
        if (t.last_open_at && String(t.last_open_at) !== String(t.first_open_at)) times.push(t.last_open_at);
        return times;
      });
      updates.push({ id: contactId, score: Math.max(0, Math.round(score)), hour: bestSendHour(opens) });
    }

    // Batch update using a single raw query for efficiency
    if (updates.length > 0) {
      const cases = updates.map((u) => `WHEN '${u.id}' THEN ${u.score}`).join(' ');
      const hourCases = updates.map((u) => `WHEN '${u.id}' THEN ${u.hour === null ? 'NULL' : u.hour}`).join(' ');
      const ids = updates.map((u) => `'${u.id}'`).join(',');

      await db.raw(`
        UPDATE contacts
        SET engagement_score = CASE id ${cases} END,
            best_send_hour = (CASE id ${hourCases} END)::smallint,
            engagement_updated_at = NOW()
        WHERE id IN (${ids})
      `);
    }

    processed += contacts.length;
    offset += BATCH_SIZE;
  }

  console.log(`[engagement-scorer] Recalculated scores for ${processed} contacts${orgId ? ` (org: ${orgId})` : ''}`);
  return { processed };
}

function getTimeDecayWeight(
  eventTime: string | Date | null,
  now: Date,
  thirtyDaysAgo: Date,
  ninetyDaysAgo: Date,
): number {
  if (!eventTime) return 1;
  const t = new Date(eventTime);
  if (t < ninetyDaysAgo) return 0.25;
  if (t < thirtyDaysAgo) return 0.5;
  return 1;
}

async function processEngagementScoring(job: Job) {
  const orgId = job.data?.orgId as string | undefined;
  console.log(`[engagement-scorer] Starting engagement score recalculation${orgId ? ` for org ${orgId}` : ' (all orgs)'}...`);
  return recalculateEngagementScores(orgId);
}

export function createEngagementScorerWorker() {
  return new Worker('engagement-scoring', processEngagementScoring, {
    connection: redis,
    concurrency: 1,
  });
}
