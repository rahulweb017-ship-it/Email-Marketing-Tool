// AI image generation (OpenAI image API). Images are saved straight into the media library.
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { uploadMedia } from '../media/media.service.js';
import { withCredits } from './ai.client.js';
import { getBrandProfile } from './brand.service.js';

export const IMAGE_SIZES = {
  square: '1024x1024',
  landscape: '1536x1024',
  portrait: '1024x1536',
} as const;

export const IMAGE_STYLES = {
  photo: 'Realistic, natural-light product or lifestyle photography.',
  illustration: 'Clean, modern flat illustration with soft shapes.',
  '3d': 'Polished 3D render with soft studio lighting.',
  minimal: 'Minimal, lots of empty space, simple composition, calm colours.',
} as const;

export const generateImageSchema = z.object({
  prompt: z.string().trim().min(5).max(2000),
  size: z.enum(Object.keys(IMAGE_SIZES) as [keyof typeof IMAGE_SIZES, ...(keyof typeof IMAGE_SIZES)[]]).default('landscape'),
  style: z.enum(Object.keys(IMAGE_STYLES) as [keyof typeof IMAGE_STYLES, ...(keyof typeof IMAGE_STYLES)[]]).default('photo'),
  use_brand: z.boolean().default(true),
});
export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export async function generateImage(orgId: string, userId: string, input: GenerateImageInput) {
  if (!env.OPENAI_API_KEY) throw new AppError(503, 'AI images are not configured on this server (OPENAI_API_KEY is missing)');

  let brandHint = '';
  if (input.use_brand) {
    const brand = await getBrandProfile(orgId).catch(() => null);
    if (brand?.business_name || brand?.industry) {
      brandHint = ` The image is for ${[brand.business_name, brand.industry && `(${brand.industry})`].filter(Boolean).join(' ')}.`;
    }
  }
  const prompt = `${input.prompt}\n\nStyle: ${IMAGE_STYLES[input.style]}${brandHint} Do not add any text, words, letters or logos to the image unless the description asks for them; marketing copy is added separately.`;

  return withCredits({ orgId, userId, feature: 'image_generate' }, async () => {
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: env.OPENAI_IMAGE_MODEL, prompt, size: IMAGE_SIZES[input.size], n: 1 }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch {
      throw new AppError(502, 'Could not reach the image service. Try again.');
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new AppError(503, 'The image AI key on this server is invalid');
      if (res.status === 429) throw new AppError(429, 'The image AI is busy right now. Try again in a minute.');
      if (res.status === 400 && /safety|policy|moderation/i.test(msg)) {
        throw new AppError(422, 'The image AI declined this description. Try rephrasing it.');
      }
      throw new AppError(502, `Image generation failed: ${msg}`);
    }
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64) throw new AppError(502, 'The image AI returned no image. Try again.');
    const buffer = Buffer.from(b64, 'base64');
    const name = `ai-${input.prompt.slice(0, 40).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'image'}.png`;
    return uploadMedia(orgId, userId, { buffer, originalname: name, size: buffer.length });
  });
}
