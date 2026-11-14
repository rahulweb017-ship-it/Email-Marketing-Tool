import { db } from '../../config/database.js';
import type { BrandProfileInput } from './ai.schema.js';

const FIELDS = ['business_name', 'website', 'industry', 'description', 'products', 'audience', 'tone', 'language', 'words_to_use', 'words_to_avoid', 'sample_copy'] as const;

export async function getBrandProfile(orgId: string) {
  const row = await db('brand_profiles').where('org_id', orgId).first();
  if (row) return row;
  const org = await db('organizations').where('id', orgId).select('name').first();
  return { org_id: orgId, business_name: org?.name ?? null, ...Object.fromEntries(FIELDS.slice(1).map((f) => [f, null])) };
}

export async function saveBrandProfile(orgId: string, userId: string, input: BrandProfileInput) {
  const values = { ...Object.fromEntries(FIELDS.map((f) => [f, input[f]?.trim() || null])), updated_by: userId, updated_at: new Date() };
  await db('brand_profiles').insert({ org_id: orgId, ...values }).onConflict('org_id').merge();
  return getBrandProfile(orgId);
}

/** The brand voice as a prompt block, shared by every AI feature. */
export async function brandBlock(orgId: string): Promise<string> {
  const b: any = await getBrandProfile(orgId);
  const lines = [
    ['Business name', b.business_name], ['Website', b.website], ['Industry', b.industry], ['About the business', b.description],
    ['Products and services', b.products], ['Target audience', b.audience], ['Tone of voice', b.tone], ['Default language', b.language],
    ['Words and phrases to use', b.words_to_use], ['Words and phrases to avoid', b.words_to_avoid], ['Example of our writing', b.sample_copy],
  ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
  return `<brand_voice>\n${lines.length ? lines.join('\n') : 'No brand profile yet. Write in a friendly, clear, professional voice.'}\n</brand_voice>`;
}
