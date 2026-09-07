import type { SocialProvider } from './types.js';
import { TwitterProvider } from './twitter.provider.js';
import { FacebookProvider } from './facebook.provider.js';
import { InstagramProvider } from './instagram.provider.js';
import { LinkedInProvider } from './linkedin.provider.js';
import { AppError } from '../../../shared/middleware/error-handler.js';

const providers: Record<string, () => SocialProvider> = {
  twitter: () => new TwitterProvider(),
  facebook: () => new FacebookProvider(),
  instagram: () => new InstagramProvider(),
  linkedin: () => new LinkedInProvider(),
};

export const SUPPORTED_PLATFORMS = Object.keys(providers);

export function createSocialProvider(platform: string): SocialProvider {
  const factory = providers[platform];
  if (!factory) {
    throw new AppError(400, `Unsupported social platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`);
  }
  return factory();
}

export const PLATFORM_CHARACTER_LIMITS: Record<string, number> = {
  twitter: 280,
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
};

export { type SocialProvider } from './types.js';
