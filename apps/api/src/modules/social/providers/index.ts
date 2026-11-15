import type { SocialProvider } from './types.js';
import { TwitterProvider } from './twitter.provider.js';
import { FacebookProvider } from './facebook.provider.js';
import { InstagramProvider } from './instagram.provider.js';
import { LinkedInProvider } from './linkedin.provider.js';
import { YouTubeProvider } from './youtube.provider.js';
import { ThreadsProvider } from './threads.provider.js';
import { PinterestProvider } from './pinterest.provider.js';
import { AppError } from '../../../shared/middleware/error-handler.js';
import { env } from '../../../config/env.js';
import { PLATFORM_CHARACTER_LIMITS, PLATFORM_LABELS, FIRST_COMMENT_PLATFORMS } from '../social.utils.js';

const providers: Record<string, () => SocialProvider> = {
  twitter: () => new TwitterProvider(),
  facebook: () => new FacebookProvider(),
  instagram: () => new InstagramProvider(),
  linkedin: () => new LinkedInProvider(),
  youtube: () => new YouTubeProvider(),
  threads: () => new ThreadsProvider(),
  pinterest: () => new PinterestProvider(),
};

const configured: Record<string, () => boolean> = {
  twitter: () => !!(env.TWITTER_CLIENT_ID && env.TWITTER_CLIENT_SECRET),
  facebook: () => !!(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
  instagram: () => !!(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET),
  linkedin: () => !!(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
  youtube: () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  threads: () => !!(env.THREADS_APP_ID && env.THREADS_APP_SECRET),
  pinterest: () => !!(env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET),
};

export const SUPPORTED_PLATFORMS = Object.keys(providers);

export function createSocialProvider(platform: string): SocialProvider {
  const factory = providers[platform];
  if (!factory) {
    throw new AppError(400, `Unsupported social platform: ${platform}. Supported: ${SUPPORTED_PLATFORMS.join(', ')}`);
  }
  return factory();
}

export function isPlatformConfigured(platform: string): boolean {
  return configured[platform]?.() ?? false;
}

export function assertPlatformConfigured(platform: string): void {
  if (!isPlatformConfigured(platform)) {
    throw new AppError(400, `${PLATFORM_LABELS[platform] || platform} is not configured on this server. Ask your administrator to add its app credentials.`);
  }
}

export function listPlatforms() {
  return SUPPORTED_PLATFORMS.map((id) => ({
    id,
    label: PLATFORM_LABELS[id] || id,
    configured: isPlatformConfigured(id),
    character_limit: PLATFORM_CHARACTER_LIMITS[id] ?? null,
    supports_first_comment: FIRST_COMMENT_PLATFORMS.includes(id),
  }));
}

export { PLATFORM_CHARACTER_LIMITS };

export { type SocialProvider } from './types.js';
