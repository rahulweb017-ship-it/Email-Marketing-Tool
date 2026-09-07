import { v4 as uuidv4 } from 'uuid';
import { Knex } from 'knex';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { PaginationParams } from '../../shared/utils/pagination.js';
import type { CreateSegmentInput, UpdateSegmentInput, SegmentRule } from './segment.schema.js';

function buildSegmentQuery(orgId: string, rules: SegmentRule[], match: string) {
  let query = db('contacts').where('contacts.org_id', orgId);

  const ALLOWED_FIELDS = new Set(['email', 'first_name', 'last_name', 'company_name', 'job_title', 'phone', 'city', 'state', 'country', 'is_blacklisted', 'engagement_score']);

  const applyRule = (builder: Knex.QueryBuilder, rule: SegmentRule) => {
    const { field, operator, value } = rule;
    if (!ALLOWED_FIELDS.has(field)) return;
    const column = `contacts.${field}`;

    // Handle engagement_score numeric operators
    if (field === 'engagement_score') {
      const numValue = Number(value);
      switch (operator) {
        case 'gt':
          builder.where(column, '>', numValue);
          break;
        case 'gte':
          builder.where(column, '>=', numValue);
          break;
        case 'lt':
          builder.where(column, '<', numValue);
          break;
        case 'lte':
          builder.where(column, '<=', numValue);
          break;
        case 'eq':
        case 'equals':
          builder.where(column, numValue);
          break;
        case 'between': {
          // value expected as "min,max" string
          const parts = String(value).split(',').map(Number);
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            builder.whereBetween(column, [parts[0], parts[1]]);
          }
          break;
        }
      }
      return;
    }

    switch (operator) {
      case 'equals':
        builder.where(column, value ?? '');
        break;
      case 'not_equals':
        builder.whereNot(column, value ?? '');
        break;
      case 'contains':
        builder.whereILike(column, `%${value}%`);
        break;
      case 'starts_with':
        builder.whereILike(column, `${value}%`);
        break;
      case 'is_set':
        builder.whereNotNull(column).whereNot(column, '');
        break;
      case 'is_not_set':
        builder.where(function () {
          this.whereNull(column).orWhere(column, '');
        });
        break;
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
