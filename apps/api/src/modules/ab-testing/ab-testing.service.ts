import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { campaignProcessQueue } from '../../config/queue.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateAbTestInput, UpdateAbTestInput } from './ab-testing.schema.js';

/**
 * Create a new A/B test group with variant campaigns.
 */
export async function createAbTest(orgId: string, data: CreateAbTestInput) {
  const groupId = uuidv4();
  const variantPercentage = Math.floor(data.test_percentage / data.variants.length);

  await db.transaction(async (trx) => {
    // Create the ab_test_groups row
    await trx('ab_test_groups').insert({
      id: groupId,
      org_id: orgId,
      name: data.name,
      test_percentage: data.test_percentage,
      winner_criteria: data.winner_criteria,
      evaluation_hours: data.evaluation_hours,
      status: 'draft',
    });

    // Create a campaign for each variant
    for (let i = 0; i < data.variants.length; i++) {
      const variant = data.variants[i];
      const campaignId = uuidv4();

      await trx('campaigns').insert({
        id: campaignId,
        org_id: orgId,
        name: `${data.name} - ${variant.name}`,
        subject: variant.subject,
        preview_text: variant.preview_text || null,
        body_html: variant.body_html,
        email_from: data.email_from,
        reply_to: data.reply_to || null,
        sending_config_id: data.sending_config_id || null,
        state: 'draft',
        ab_test_enabled: true,
        ab_test_group_id: groupId,
        ab_test_percentage: variantPercentage,
        use_blacklist: true,
        stat_total: 0,
        stat_sent: 0,
        stat_delivered: 0,
        stat_opened: 0,
        stat_clicked: 0,
        stat_replied: 0,
        stat_bounced: 0,
        stat_failed: 0,
        stat_unsubscribed: 0,
      });

      // Link campaign to the selected lists
      if (data.list_ids.length > 0) {
        await trx('campaign_lists').insert(
          data.list_ids.map((list_id) => ({ campaign_id: campaignId, list_id })),
        );
      }
    }
  });

  return getAbTest(orgId, groupId);
}

/**
 * Get an A/B test group with its variant campaigns and stats.
 */
export async function getAbTest(orgId: string, groupId: string) {
  const group = await db('ab_test_groups').where({ id: groupId, org_id: orgId }).first();
  if (!group) throw new AppError(404, 'A/B test group not found');

  const variants = await db('campaigns')
    .where({ ab_test_group_id: groupId, org_id: orgId })
    .orderBy('created_at', 'asc');

  // Compute rates for each variant
  const variantsWithRates = variants.map((v: Record<string, unknown>) => {
    const sent = Number(v.stat_sent) || 0;
    const opened = Number(v.stat_opened) || 0;
    const clicked = Number(v.stat_clicked) || 0;
    return {
      ...v,
      open_rate: sent > 0 ? ((opened / sent) * 100).toFixed(2) : '0.00',
      click_rate: sent > 0 ? ((clicked / sent) * 100).toFixed(2) : '0.00',
    };
  });

  // Get list associations from the first variant
  let lists: unknown[] = [];
  if (variants.length > 0) {
    lists = await db('mailing_lists')
      .join('campaign_lists', 'mailing_lists.id', 'campaign_lists.list_id')
      .where('campaign_lists.campaign_id', (variants[0] as { id: string }).id)
      .select('mailing_lists.*');
  }

  return {
    ...group,
    variants: variantsWithRates,
    lists,
  };
}

/**
 * List all A/B tests for an org (paginated).
 */
export async function listAbTests(orgId: string, pagination: PaginationParams) {
  const countQuery = db('ab_test_groups').where('org_id', orgId);
  const [{ count }] = await countQuery.count('* as count');

  const groups = await db('ab_test_groups')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  // Enrich each group with variant count and basic stats
  const data = await Promise.all(
    groups.map(async (g: Record<string, unknown>) => {
      const variants = await db('campaigns')
        .where({ ab_test_group_id: g.id as string, org_id: orgId })
        .select('id', 'name', 'subject', 'state', 'stat_sent', 'stat_opened', 'stat_clicked');

      return {
        ...g,
        variant_count: variants.length,
        variants,
      };
    }),
  );

  return { data, total: Number(count) };
}

/**
 * Update A/B test group settings (not variants).
 */
export async function updateAbTest(orgId: string, groupId: string, data: UpdateAbTestInput) {
  const group = await db('ab_test_groups').where({ id: groupId, org_id: orgId }).first();
  if (!group) throw new AppError(404, 'A/B test group not found');
  if (group.status !== 'draft') throw new AppError(400, 'Can only edit A/B tests in draft status');

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.test_percentage !== undefined) updates.test_percentage = data.test_percentage;
  if (data.winner_criteria !== undefined) updates.winner_criteria = data.winner_criteria;
  if (data.evaluation_hours !== undefined) updates.evaluation_hours = data.evaluation_hours;

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('ab_test_groups').where({ id: groupId }).update(updates);
  }

  // Update variant campaigns if relevant fields changed
  if (data.email_from || data.reply_to !== undefined || data.sending_config_id !== undefined) {
    const campaignUpdates: Record<string, unknown> = {};
    if (data.email_from) campaignUpdates.email_from = data.email_from;
    if (data.reply_to !== undefined) campaignUpdates.reply_to = data.reply_to || null;
    if (data.sending_config_id !== undefined) campaignUpdates.sending_config_id = data.sending_config_id || null;

    if (Object.keys(campaignUpdates).length > 0) {
      campaignUpdates.updated_at = new Date();
      await db('campaigns').where({ ab_test_group_id: groupId, org_id: orgId }).update(campaignUpdates);
    }
  }

  // Update list associations if list_ids provided
  if (data.list_ids) {
    const variants = await db('campaigns').where({ ab_test_group_id: groupId, org_id: orgId }).select('id');
    await db.transaction(async (trx) => {
      for (const v of variants) {
        await trx('campaign_lists').where('campaign_id', (v as { id: string }).id).del();
        if (data.list_ids!.length > 0) {
          await trx('campaign_lists').insert(
            data.list_ids!.map((list_id) => ({ campaign_id: (v as { id: string }).id, list_id })),
          );
        }
      }
    });
  }

  return getAbTest(orgId, groupId);
}

/**
 * Launch the A/B test: set variant campaigns to in_queue.
 */
export async function sendAbTest(orgId: string, groupId: string) {
  const group = await db('ab_test_groups').where({ id: groupId, org_id: orgId }).first();
  if (!group) throw new AppError(404, 'A/B test group not found');
  if (group.status !== 'draft') throw new AppError(400, 'A/B test must be in draft status to send');

  const variants = await db('campaigns')
    .where({ ab_test_group_id: groupId, org_id: orgId })
    .orderBy('created_at', 'asc');

  if (variants.length < 2) throw new AppError(400, 'A/B test must have at least 2 variants');

  // Validate each variant has body content
  for (const v of variants) {
    if (!(v as { body_html: string | null }).body_html) {
      throw new AppError(400, `Variant "${(v as { name: string }).name}" has no email body content`);
    }
  }

  // Validate at least one list is linked
  const lists = await db('campaign_lists')
    .where('campaign_id', (variants[0] as { id: string }).id);
  if (lists.length === 0) throw new AppError(400, 'A/B test must have at least one mailing list');

  // Distribute test_percentage evenly across variants
  const perVariant = Math.floor(group.test_percentage / variants.length);

  await db.transaction(async (trx) => {
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i] as { id: string };
      const pct = i === variants.length - 1
        ? group.test_percentage - (perVariant * (variants.length - 1))
        : perVariant;

      await trx('campaigns').where({ id: v.id }).update({
        state: 'in_queue',
        ab_test_percentage: pct,
        updated_at: new Date(),
      });

      await campaignProcessQueue.add('process-campaign', { campaignId: v.id });
    }

    await trx('ab_test_groups').where({ id: groupId }).update({
      status: 'testing',
      updated_at: new Date(),
    });
  });

  return getAbTest(orgId, groupId);
}

/**
 * Pick a winner based on winner_criteria (manual or auto).
 */
export async function pickWinner(orgId: string, groupId: string) {
  const group = await db('ab_test_groups').where({ id: groupId, org_id: orgId }).first();
  if (!group) throw new AppError(404, 'A/B test group not found');
  if (group.status !== 'testing') throw new AppError(400, 'A/B test must be in testing status to pick a winner');

  const variants = await db('campaigns')
    .where({ ab_test_group_id: groupId, org_id: orgId })
    .orderBy('created_at', 'asc');

  if (variants.length === 0) throw new AppError(400, 'No variants found');

  // Determine winner
  let winnerId: string | null = null;
  let bestRate = -1;

  for (const v of variants) {
    const sent = Number((v as Record<string, unknown>).stat_sent) || 0;
    if (sent === 0) continue;

    let rate: number;
    if (group.winner_criteria === 'click_rate') {
      rate = Number((v as Record<string, unknown>).stat_clicked) / sent;
    } else {
      rate = Number((v as Record<string, unknown>).stat_opened) / sent;
    }

    if (rate > bestRate) {
      bestRate = rate;
      winnerId = (v as { id: string }).id;
    }
  }

  // If no sends yet, pick the first variant
  if (!winnerId) {
    winnerId = (variants[0] as { id: string }).id;
  }

  await db('ab_test_groups').where({ id: groupId }).update({
    winner_campaign_id: winnerId,
    status: 'winner_picked',
    updated_at: new Date(),
  });

  return getAbTest(orgId, groupId);
}

/**
 * Send the winning variant to remaining recipients.
 */
export async function sendWinner(orgId: string, groupId: string) {
  const group = await db('ab_test_groups').where({ id: groupId, org_id: orgId }).first();
  if (!group) throw new AppError(404, 'A/B test group not found');
  if (group.status !== 'winner_picked') throw new AppError(400, 'Must pick a winner before sending');
  if (!group.winner_campaign_id) throw new AppError(400, 'No winner selected');

  const winnerCampaign = await db('campaigns').where({ id: group.winner_campaign_id, org_id: orgId }).first();
  if (!winnerCampaign) throw new AppError(404, 'Winner campaign not found');

  // Create a new campaign for the remaining audience (100% - test_percentage)
  const finalCampaignId = uuidv4();
  const { id, created_at, updated_at, state, sent_date, stat_total, stat_sent, stat_delivered, stat_opened, stat_clicked, stat_replied, stat_bounced, stat_failed, stat_unsubscribed, ab_test_percentage, ...rest } = winnerCampaign;

  await db.transaction(async (trx) => {
    await trx('campaigns').insert({
      ...rest,
      id: finalCampaignId,
      name: `${group.name} - Winner`,
      state: 'in_queue',
      ab_test_enabled: true,
      ab_test_group_id: groupId,
      ab_test_percentage: 100 - group.test_percentage,
      sent_date: null,
      stat_total: 0,
      stat_sent: 0,
      stat_delivered: 0,
      stat_opened: 0,
      stat_clicked: 0,
      stat_replied: 0,
      stat_bounced: 0,
      stat_failed: 0,
      stat_unsubscribed: 0,
    });

    // Copy list associations from winner
    const lists = await trx('campaign_lists').where('campaign_id', group.winner_campaign_id);
    if (lists.length > 0) {
      await trx('campaign_lists').insert(
        lists.map((l: { list_id: string }) => ({ campaign_id: finalCampaignId, list_id: l.list_id })),
      );
    }

    // Update group status
    await trx('ab_test_groups').where({ id: groupId }).update({
      status: 'completed',
      updated_at: new Date(),
    });
  });

  // Queue the final campaign for processing
  await campaignProcessQueue.add('process-campaign', { campaignId: finalCampaignId });

  return getAbTest(orgId, groupId);
}

/**
 * Delete an A/B test group and its variant campaigns.
 */
export async function deleteAbTest(orgId: string, groupId: string) {
  const group = await db('ab_test_groups').where({ id: groupId, org_id: orgId }).first();
  if (!group) throw new AppError(404, 'A/B test group not found');
  if (!['draft', 'completed'].includes(group.status)) {
    throw new AppError(400, 'Can only delete A/B tests in draft or completed status');
  }

  await db.transaction(async (trx) => {
    // Delete campaign_lists for variant campaigns
    const variantIds = await trx('campaigns')
      .where({ ab_test_group_id: groupId, org_id: orgId })
      .pluck('id');

    if (variantIds.length > 0) {
      await trx('campaign_lists').whereIn('campaign_id', variantIds).del();
      await trx('campaigns').whereIn('id', variantIds).del();
    }

    await trx('ab_test_groups').where({ id: groupId }).del();
  });
}
