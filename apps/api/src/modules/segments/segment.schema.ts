import { z } from 'zod';
import { validateRule } from './segment.rules.js';

const segmentRuleSchema = z.object({
  field: z.string().max(50),
  operator: z.string().max(30),
  value: z.union([z.string().max(500), z.number(), z.null()]).optional(),
}).superRefine((rule, ctx) => {
  const problem = validateRule(rule);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
});

const filterRulesSchema = z.object({
  match: z.enum(['all', 'any']),
  rules: z.array(segmentRuleSchema).min(1).max(30),
});

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  filter_rules: filterRulesSchema,
});

export const updateSegmentSchema = createSegmentSchema.partial();

export const previewSegmentSchema = z.object({ filter_rules: filterRulesSchema });

export type SegmentRule = z.infer<typeof segmentRuleSchema>;
export type FilterRules = z.infer<typeof filterRulesSchema>;
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;
