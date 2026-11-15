import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { createPost, getQueueTimezone, computeQueueSlot, type SocialActor } from './social.service.js';
import { isValidTimeZone } from './social.utils.js';
import type { TemplateInput, CreateIdeaInput, UpdateIdeaInput } from './social.schema.js';

async function orgTagIds(orgId: string, ids: string[] | undefined): Promise<string[] | undefined> {
  if (!ids) return undefined;
  if (!ids.length) return [];
  const rows = await db('social_tags').where('org_id', orgId).whereIn('id', ids).select('id');
  const ok = new Set(rows.map((r: any) => r.id));
  return ids.filter((i) => ok.has(i));
}

async function assertAccount(orgId: string, accountId: string) {
  const acc = await db('social_accounts').where({ id: accountId, org_id: orgId }).first();
  if (!acc) throw new AppError(404, 'Social account not found');
}

// ─── Queue ───

export async function getQueueSlots(orgId: string, accountId?: string) {
  if (accountId) await assertAccount(orgId, accountId);
  let q = db('social_queue_slots').where('org_id', orgId);
  if (accountId) q = q.where('account_id', accountId);
  const slots = await q.orderBy(['account_id', 'day_of_week', 'time_of_day'])
    .select('id', 'account_id', 'day_of_week', 'time_of_day');
  return { slots, timezone: await getQueueTimezone(orgId) };
}

export async function replaceQueueSlots(orgId: string, accountId: string, slots: Array<{ day_of_week: number; time_of_day: string }>) {
  await assertAccount(orgId, accountId);
  const unique = [...new Map(slots.map((s) => [`${s.day_of_week}-${s.time_of_day}`, s])).values()];
  await db.transaction(async (trx) => {
    await trx('social_queue_slots').where({ org_id: orgId, account_id: accountId }).delete();
    if (unique.length) {
      await trx('social_queue_slots').insert(unique.map((s) => ({
        id: uuidv4(), org_id: orgId, account_id: accountId, day_of_week: s.day_of_week, time_of_day: s.time_of_day,
      })));
    }
  });
  return getQueueSlots(orgId, accountId);
}

export async function setQueueTimezone(orgId: string, timezone: string) {
  if (!isValidTimeZone(timezone)) throw new AppError(400, 'Unknown timezone');
  await db('social_queue_settings')
    .insert({ org_id: orgId, timezone, created_at: new Date(), updated_at: new Date() })
    .onConflict('org_id')
    .merge({ timezone, updated_at: new Date() });
  return { timezone };
}

export async function previewNextSlot(orgId: string, accountIds: string[], mode: 'queue' | 'queue_top') {
  const rows = await db('social_accounts').where('org_id', orgId).whereIn('id', accountIds).select('id');
  if (rows.length !== accountIds.length) throw new AppError(400, 'One or more selected accounts are invalid');
  const at = await computeQueueSlot(orgId, accountIds, mode);
  return { scheduled_at: at.toISOString(), timezone: await getQueueTimezone(orgId) };
}

// ─── Tags ───

export async function listTags(orgId: string) {
  return db('social_tags').where('org_id', orgId).orderBy('name', 'asc').select('id', 'name', 'color');
}

export async function createTag(orgId: string, input: { name: string; color?: string }) {
  const existing = await db('social_tags').where('org_id', orgId).whereRaw('lower(name) = lower(?)', [input.name]).first();
  if (existing) return existing;
  const [row] = await db('social_tags')
    .insert({ id: uuidv4(), org_id: orgId, name: input.name, color: input.color || '#cc0000' })
    .returning(['id', 'name', 'color']);
  return row;
}

export async function updateTag(orgId: string, id: string, input: { name: string; color?: string }) {
  const n = await db('social_tags').where({ id, org_id: orgId })
    .update({ name: input.name, ...(input.color ? { color: input.color } : {}), updated_at: new Date() });
  if (!n) throw new AppError(404, 'Tag not found');
  return db('social_tags').where({ id, org_id: orgId }).first('id', 'name', 'color');
}

export async function deleteTag(orgId: string, id: string) {
  const n = await db('social_tags').where({ id, org_id: orgId }).delete();
  if (!n) throw new AppError(404, 'Tag not found');
  // Drop the tag id from the jsonb arrays that reference it
  for (const table of ['social_posts', 'social_ideas', 'social_templates']) {
    await db(table).where('org_id', orgId).whereRaw('tags @> ?::jsonb', [JSON.stringify([id])])
      .update({ tags: db.raw('tags - ?', [id]) });
  }
}

// ─── Templates ───

export async function listTemplates(orgId: string) {
  return db('social_templates').where('org_id', orgId).orderBy('updated_at', 'desc');
}

export async function createTemplate(orgId: string, userId: string, input: TemplateInput) {
  const [row] = await db('social_templates').insert({
    id: uuidv4(), org_id: orgId, name: input.name, content: input.content,
    tags: JSON.stringify((await orgTagIds(orgId, input.tags)) || []), created_by: userId,
  }).returning('*');
  return row;
}

export async function updateTemplate(orgId: string, id: string, input: TemplateInput) {
  const tags = await orgTagIds(orgId, input.tags);
  const n = await db('social_templates').where({ id, org_id: orgId }).update({
    name: input.name, content: input.content, ...(tags ? { tags: JSON.stringify(tags) } : {}), updated_at: new Date(),
  });
  if (!n) throw new AppError(404, 'Template not found');
  return db('social_templates').where({ id, org_id: orgId }).first();
}

export async function deleteTemplate(orgId: string, id: string) {
  const n = await db('social_templates').where({ id, org_id: orgId }).delete();
  if (!n) throw new AppError(404, 'Template not found');
}

// ─── Ideas ───

export async function listIdeas(orgId: string) {
  return db('social_ideas').where('org_id', orgId).orderBy([{ column: 'stage' }, { column: 'position' }, { column: 'created_at', order: 'desc' }]);
}

async function getIdea(orgId: string, id: string) {
  const idea = await db('social_ideas').where({ id, org_id: orgId }).first();
  if (!idea) throw new AppError(404, 'Idea not found');
  return idea;
}

export async function createIdea(orgId: string, userId: string, input: CreateIdeaInput) {
  if (!input.title.trim() && !input.body?.trim()) throw new AppError(400, 'Give the idea a title or some text');
  const max = await db('social_ideas').where({ org_id: orgId, stage: input.stage }).max('position as max').first();
  const [row] = await db('social_ideas').insert({
    id: uuidv4(), org_id: orgId, title: input.title, body: input.body ?? null,
    media: JSON.stringify(input.media || []), tags: JSON.stringify((await orgTagIds(orgId, input.tags)) || []),
    stage: input.stage, position: Number((max as any)?.max ?? -1) + 1, created_by: userId,
  }).returning('*');
  return row;
}

export async function updateIdea(orgId: string, id: string, input: UpdateIdeaInput) {
  await getIdea(orgId, id);
  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.media) updates.media = JSON.stringify(input.media);
  const tags = await orgTagIds(orgId, input.tags);
  if (tags) updates.tags = JSON.stringify(tags);
  await db('social_ideas').where({ id, org_id: orgId }).update(updates);
  return getIdea(orgId, id);
}

export async function moveIdea(orgId: string, id: string, stage: string, position: number) {
  await getIdea(orgId, id);
  await db.transaction(async (trx) => {
    const others = await trx('social_ideas').where({ org_id: orgId, stage }).whereNot('id', id)
      .orderBy([{ column: 'position' }, { column: 'created_at', order: 'desc' }]).select('id');
    const ids = others.map((o: any) => o.id);
    ids.splice(Math.min(position, ids.length), 0, id);
    for (let i = 0; i < ids.length; i++) {
      await trx('social_ideas').where({ id: ids[i], org_id: orgId })
        .update({ position: i, ...(ids[i] === id ? { stage, updated_at: new Date() } : {}) });
    }
  });
  return getIdea(orgId, id);
}

export async function deleteIdea(orgId: string, id: string) {
  const n = await db('social_ideas').where({ id, org_id: orgId }).delete();
  if (!n) throw new AppError(404, 'Idea not found');
}

export async function convertIdea(orgId: string, actor: SocialActor, id: string) {
  const idea = await getIdea(orgId, id);
  const content = [idea.title, idea.body].map((s: string | null) => (s || '').trim()).filter(Boolean).join('\n\n');
  const media = (Array.isArray(idea.media) ? idea.media : []) as Array<{ url: string; type: 'image' | 'video' | 'gif' }>;
  const post = await createPost(orgId, actor, {
    content, account_ids: [], media, tags: Array.isArray(idea.tags) ? idea.tags : [], idea_id: idea.id, schedule_mode: 'draft',
  });
  return { post_id: post.id };
}
