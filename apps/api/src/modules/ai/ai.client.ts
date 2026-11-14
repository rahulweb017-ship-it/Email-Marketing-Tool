// Shared Claude client for every AI feature, with per-organisation monthly AI credits.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod/v4';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { redis } from '../../config/redis.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { getOrgLimits } from '../usage/usage.service.js';
import { AI_CREDIT_COSTS, aiPeriod, type AiFeature } from './ai.utils.js';

let client: Anthropic | null = null;
function ai(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new AppError(503, 'AI is not configured on this server (ANTHROPIC_API_KEY is missing)');
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const creditKey = (orgId: string) => `org:ai:${orgId}:${aiPeriod()}`;

export async function getAiCreditUsage(orgId: string) {
  const limits = await getOrgLimits(orgId);
  const used = parseInt(await redis.get(creditKey(orgId)) || '0');
  return { period: aiPeriod(), used, limit: limits.max_ai_credits_per_month, costs: AI_CREDIT_COSTS };
}

/** Atomically takes credits, so parallel requests can't overshoot the monthly allowance. */
async function reserveCredits(orgId: string, cost: number): Promise<void> {
  const limits = await getOrgLimits(orgId);
  const limit = limits.max_ai_credits_per_month;
  if (limit <= 0) throw new AppError(402, 'AI features are not included in your plan. Upgrade to use them.');
  const key = creditKey(orgId);
  const used = await redis.incrby(key, cost);
  if (used === cost) await redis.expire(key, 40 * 24 * 60 * 60);
  if (used > limit) {
    await redis.decrby(key, cost);
    throw new AppError(402, `You have used all ${limit} AI credits for this month. Upgrade your plan or wait until next month.`);
  }
}

export interface CreditCharge { orgId: string; userId?: string | null; feature: AiFeature }

/** One structured Claude call, charged to the organisation's AI credits (refunded if the call fails). */
export async function generate<T extends z.ZodType>(opts: {
  charge: CreditCharge;
  system: Anthropic.Beta.BetaTextBlockParam[];
  prompt: string;
  schema: T;
  effort: 'low' | 'medium';
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const cost = AI_CREDIT_COSTS[opts.charge.feature];
  const anthropic = ai();
  await reserveCredits(opts.charge.orgId, cost);
  try {
    let response;
    try {
      response = await anthropic.beta.messages.parse({
        model: env.AI_MODEL,
        max_tokens: opts.maxTokens ?? 4000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
        output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      });
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) throw new AppError(429, 'The AI is busy right now. Try again in a minute.');
      if (err instanceof Anthropic.AuthenticationError) throw new AppError(503, 'The AI key on this server is invalid');
      if (err instanceof Anthropic.APIError) throw new AppError(502, `AI request failed: ${err.message}`);
      throw err;
    }
    if (response.stop_reason === 'refusal') throw new AppError(422, 'The AI declined to write this. Try rephrasing the request.');
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new AppError(502, 'The AI returned an incomplete answer. Try again.');
    await db('ai_usage_events').insert({
      org_id: opts.charge.orgId, user_id: opts.charge.userId ?? null, feature: opts.charge.feature, credits: cost,
    }).catch(() => undefined);
    return response.parsed_output as z.infer<T>;
  } catch (err) {
    await redis.decrby(creditKey(opts.charge.orgId), cost).catch(() => undefined);
    throw err;
  }
}
