import { z } from 'zod';

const segmentRuleSchema = z.object({
  field: z.enum(['email', 'first_name', 'last_name', 'company_name', 'country_code', 'created_at', 'source', 'engagement_score']),
  operator: z.enum(['equals', 'not_equals', 'contains', 'starts_with', 'is_set', 'is_not_set', 'gt', 'gte', 'lt', 'lte', 'eq', 'between']),
  value: z.union([z.string(), z.number(), z.null()]).optional(),
});

const filterRulesSchema = z.object({
  match: z.enum(['all', 'any']),
  rules: z.array(segmentRuleSchema).min(1),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  filter_rules: filterRulesSchema,
});

export const updateSegmentSchema = createSegmentSchema.partial();

export type SegmentRule = z.infer<typeof segmentRuleSchema>;
export type FilterRules = z.infer<typeof filterRulesSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
