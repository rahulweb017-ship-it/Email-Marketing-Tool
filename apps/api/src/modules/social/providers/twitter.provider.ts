import crypto from 'crypto';
import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const TWITTER_API = 'https://api.twitter.com/2';
const TWITTER_UPLOAD_API = 'https://upload.twitter.com/1.1';
const TWITTER_AUTH = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN = 'https://api.twitter.com/2/oauth2/token';

export class TwitterProvider implements SocialProvider {
  readonly name = 'twitter';
  readonly characterLimit = 280;

  private get clientId(): string {
    return env.TWITTER_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return env.TWITTER_CLIENT_SECRET || '';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read tweet.write users.read offline.access',
      state: JSON.stringify({ state, code_verifier: codeVerifier }),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return `${TWITTER_AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const res = await fetch(TWITTER_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier || '',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new SocialApiError(`Twitter token exchange failed: ${err}`, res.status, 'twitter');
    }

    const tokens = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };

    // Fetch user info
    const userRes = await fetch(`${TWITTER_API}/users/me?user.fields=profile_image_url`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) {
      throw new SocialApiError('Failed to fetch Twitter user info', userRes.status, 'twitter');
    }

    const userData = await userRes.json() as { data: { id: string; username: string; name: string; profile_image_url?: string } };

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      account_id: userData.data.id,
      account_name: `@${userData.data.username}`,
      account_avatar_url: userData.data.profile_image_url,
      account_type: 'personal',
      scopes: 'tweet.read tweet.write users.read offline.access',
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<TokenRefreshResult> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const res = await fetch(TWITTER_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new SocialApiError(`Twitter token refresh failed: ${err}`, res.status, 'twitter');
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    const body: Record<string, unknown> = { text: payload.content };

    if (payload.media_ids && payload.media_ids.length > 0) {
      body.media = { media_ids: payload.media_ids };
    }

    const res = await fetch(`${TWITTER_API}/tweets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      const retryAfter = res.headers.get('retry-after');
      throw new SocialApiError(`Twitter publish failed: ${err}`, res.status, 'twitter',
        retryAfter ? parseInt(retryAfter) : undefined);
    }

    const data = await res.json() as { data: { id: string } };
    return {
      success: true,
      platform_post_id: data.data.id,
      platform_post_url: `https://twitter.com/i/web/status/${data.data.id}`,
    };
  }

  async uploadMedia(accessToken: string, fileUrl: string, mimeType: string): Promise<string> {
    // Download the file first
    const fileRes = await fetch(fileUrl);
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
    const totalBytes = fileBuffer.length;

    // INIT
    const initRes = await fetch(`${TWITTER_UPLOAD_API}/media/upload.json`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: new URLSearchParams({
        command: 'INIT',
        total_bytes: totalBytes.toString(),
        media_type: mimeType,
      }),
    });

    if (!initRes.ok) throw new SocialApiError('Twitter media INIT failed', initRes.status, 'twitter');
    const initData = await initRes.json() as { media_id_string: string };
    const mediaId = initData.media_id_string;

    // APPEND (single chunk for images)
    const form = new FormData();
    form.append('command', 'APPEND');
    form.append('media_id', mediaId);
    form.append('segment_index', '0');
    form.append('media_data', fileBuffer.toString('base64'));

    const appendRes = await fetch(`${TWITTER_UPLOAD_API}/media/upload.json`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: form,
    });

    if (!appendRes.ok) throw new SocialApiError('Twitter media APPEND failed', appendRes.status, 'twitter');

    // FINALIZE
    const finalRes = await fetch(`${TWITTER_UPLOAD_API}/media/upload.json`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      body: new URLSearchParams({
        command: 'FINALIZE',
        media_id: mediaId,
      }),
    });

    if (!finalRes.ok) throw new SocialApiError('Twitter media FINALIZE failed', finalRes.status, 'twitter');

    return mediaId;
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const res = await fetch(
      `${TWITTER_API}/tweets/${platformPostId}?tweet.fields=public_metrics`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      throw new SocialApiError('Failed to fetch Twitter metrics', res.status, 'twitter');
    }

    const data = await res.json() as {
      data: {
        public_metrics: {
          retweet_count: number; reply_count: number;
          like_count: number; quote_count: number;
          impression_count?: number; bookmark_count?: number;
        };
      };
    };

    const m = data.data.public_metrics;
    return {
      likes: m.like_count,
      comments: m.reply_count,
      shares: m.retweet_count + m.quote_count,
      reach: 0,
      impressions: m.impression_count || 0,
      clicks: 0,
    };
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${TWITTER_API}/users/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return res.ok;
  }
}
