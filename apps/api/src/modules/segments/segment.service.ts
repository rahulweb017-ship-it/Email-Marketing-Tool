import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateSegmentInput, UpdateSegmentInput, SegmentRule, FilterRules } from './segment.schema.js';
import { SEGMENT_FIELDS, validateRule, daysAgo, escapeLike } from './segment.rules.js';

export function buildSegmentQuery(orgId: string, rules: SegmentRule[], match: string) {
  let query = db('contacts').where('contacts.org_id', orgId);

  const applyRule = (builder: Knex.QueryBuilder, rule: SegmentRule) => {
    // Invalid rules (e.g. saved before validation existed) match nobody rather than everybody.
    if (validateRule(rule)) { builder.whereRaw('false'); return; }
    const def = SEGMENT_FIELDS[rule.field];
    const { value } = rule;
    const column = `contacts.${rule.field}`;

    if (def.kind === 'tag') {
      const tagged = db('contact_tags')
        .join('tags', 'tags.id', 'contact_tags.tag_id')
        .where('tags.org_id', orgId)
        .whereRaw('lower(tags.name) = lower(?)', [String(value).trim()])
        .select('contact_tags.contact_id');
      if (rule.operator === 'has_tag') builder.whereIn('contacts.id', tagged);
      else builder.whereNotIn('contacts.id', tagged);
      return;
    }

    if (def.kind === 'number') {
      const n = Number(value);
      switch (rule.operator) {
        case 'gt': builder.where(column, '>', n); break;
        case 'gte': builder.where(column, '>=', n); break;
        case 'lt': builder.where(column, '<', n); break;
        case 'lte': builder.where(column, '<=', n); break;
        case 'eq': case 'equals': builder.where(column, n); break;
        case 'between': {
          const [a, b] = String(value).split(',').map((p) => Number(p.trim()));
          builder.whereBetween(column, [Math.min(a, b), Math.max(a, b)]);
          break;
        }
      }
      return;
    }

    if (def.kind === 'date') {
      switch (rule.operator) {
        case 'within_days': builder.where(column, '>=', daysAgo(Number(value))); break;
        case 'before_days': builder.where(column, '<', daysAgo(Number(value))); break;
        case 'is_set': builder.whereNotNull(column); break;
        case 'is_not_set': builder.whereNull(column); break;
      }
      return;
    }

    const text = String(value ?? '').trim();
    switch (rule.operator) {
      case 'equals': builder.whereRaw(`lower(${column}) = lower(?)`, [text]); break;
      case 'not_equals':
        builder.where(function () { this.whereNull(column).orWhereRaw(`lower(${column}) <> lower(?)`, [text]); });
        break;
      case 'contains': builder.whereILike(column, `%${escapeLike(text)}%`); break;
      case 'starts_with': builder.whereILike(column, `${escapeLike(text)}%`); break;
      case 'is_set': builder.whereNotNull(column).whereNot(column, ''); break;
      case 'is_not_set': builder.where(function () { this.whereNull(column).orWhere(column, ''); }); break;
    }
  };
  if (match === 'any') {
    query = query.where(function () {
      for (const rule of rules) {
        this.orWhere(function () {
          applyRule(this, rule);
        });
      }
    });
  } else {
    // match === 'all'
    for (const rule of rules) {
      query = query.where(function () {
        applyRule(this, rule);
      });
    }
  }

  return query;
}

export async function listSegments(orgId: string, pagination: PaginationParams) {
  const countQuery = db('segments').where('org_id', orgId);
  const [{ count }] = await countQuery.count('* as count');

  const data = await db('segments')
    .where('org_id', orgId)
    .orderBy('created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

export async function getSegment(orgId: string, segmentId: string) {
  const segment = await db('segments').where({ id: segmentId, org_id: orgId }).first();
  if (!segment) throw new AppError(404, 'Segment not found');
  return segment;
}

export async function createSegment(orgId: string, input: CreateSegmentInput) {
  const id = uuidv4();
  await db('segments').insert({
    id,
    org_id: orgId,
    name: input.name,
    description: input.description || null,
    filter_rules: JSON.stringify(input.filter_rules),
  });

  return getSegment(orgId, id);
}

export async function updateSegment(orgId: string, segmentId: string, input: UpdateSegmentInput) {
  const existing = await db('segments').where({ id: segmentId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Segment not found');

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description || null;
  if (input.filter_rules !== undefined) updates.filter_rules = JSON.stringify(input.filter_rules);

  await db('segments').where({ id: segmentId }).update(updates);
  return getSegment(orgId, segmentId);
}

export async function deleteSegment(orgId: string, segmentId: string) {
  const deleted = await db('segments').where({ id: segmentId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Segment not found');
}

export async function computeSegment(orgId: string, segmentId: string) {
  const segment = await db('segments').where({ id: segmentId, org_id: orgId }).first();
  if (!segment) throw new AppError(404, 'Segment not found');

  const filterRules = typeof segment.filter_rules === 'string'
    ? JSON.parse(segment.filter_rules)
    : segment.filter_rules;

  const { match, rules } = filterRules;
  if (!rules || rules.length === 0) {
    await db('segments').where({ id: segmentId }).update({ cached_count: 0, last_computed_at: new Date() });
    return { cached_count: 0 };
  }

  const query = buildSegmentQuery(orgId, rules, match);
  const [{ count }] = await query.count('* as count');
  const cachedCount = Number(count);

  await db('segments').where({ id: segmentId }).update({
    cached_count: cachedCount,
    last_computed_at: new Date(),
  });

  return { cached_count: cachedCount };
}

export async function getSegmentContacts(orgId: string, segmentId: string, pagination: PaginationParams) {
  const segment = await db('segments').where({ id: segmentId, org_id: orgId }).first();
  if (!segment) throw new AppError(404, 'Segment not found');

  const filterRules = typeof segment.filter_rules === 'string'
    ? JSON.parse(segment.filter_rules)
    : segment.filter_rules;

  const { match, rules } = filterRules;
  if (!rules || rules.length === 0) {
    return { data: [], total: 0 };
  }

  const baseQuery = buildSegmentQuery(orgId, rules, match);
  const countQuery = baseQuery.clone().count('* as count');
  const [{ count }] = await countQuery;

  const data = await buildSegmentQuery(orgId, rules, match)
    .select('contacts.*')
    .orderBy('contacts.created_at', 'desc')
    .limit(pagination.per_page)
    .offset(pagination.offset);

  return { data, total: Number(count) };
}

/** Count and sample contacts for unsaved rules, so the builder can show who would match before saving. */
export async function previewSegment(orgId: string, filterRules: FilterRules) {
  const [{ count }] = await buildSegmentQuery(orgId, filterRules.rules, filterRules.match).count('* as count');
  const sample = await buildSegmentQuery(orgId, filterRules.rules, filterRules.match)
    .select('contacts.id', 'contacts.email', 'contacts.first_name', 'contacts.last_name')
    .orderBy('contacts.created_at', 'desc')
    .limit(5);
  return { count: Number(count), sample };
}
