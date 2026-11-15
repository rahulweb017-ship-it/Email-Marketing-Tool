import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const TH_AUTH = 'https://threads.net/oauth/authorize';
const TH_API = 'https://graph.threads.net';
const TH_V = `${TH_API}/v1.0`;
const SCOPES = 'threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies,threads_manage_insights';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ThreadsProvider implements SocialProvider {
  readonly name = 'threads';
  readonly characterLimit = 500;

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: env.THREADS_APP_ID, redirect_uri: redirectUri, scope: SCOPES, response_type: 'code', state,
    });
    return `${TH_AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const res = await fetch(`${TH_API}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.THREADS_APP_ID, client_secret: env.THREADS_APP_SECRET,
        grant_type: 'authorization_code', redirect_uri: redirectUri, code,
      }),
    });
    if (!res.ok) throw new SocialApiError(`Threads token exchange failed: ${await res.text()}`, res.status, 'threads');
    const short = await res.json() as { access_token: string; user_id?: string | number };

    const longRes = await fetch(`${TH_API}/access_token?` + new URLSearchParams({
      grant_type: 'th_exchange_token', client_secret: env.THREADS_APP_SECRET, access_token: short.access_token,
    }));
    if (!longRes.ok) throw new SocialApiError(`Threads long-lived token exchange failed: ${await longRes.text()}`, longRes.status, 'threads');
    const long = await longRes.json() as { access_token: string; expires_in?: number };

    const meRes = await fetch(`${TH_V}/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(long.access_token)}`);
    if (!meRes.ok) throw new SocialApiError('Failed to fetch Threads profile', meRes.status, 'threads');
    const me = await meRes.json() as { id: string; username?: string; threads_profile_picture_url?: string };

    // Threads refreshes a long-lived token with the token itself, so store it as the refresh token too.
    return {
      access_token: long.access_token,
      refresh_token: long.access_token,
      expires_in: long.expires_in,
      account_id: me.id,
      account_name: me.username ? `@${me.username}` : 'Threads profile',
      account_avatar_url: me.threads_profile_picture_url,
      account_type: 'personal',
      scopes: SCOPES,
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<TokenRefreshResult> {
    const res = await fetch(`${TH_API}/refresh_access_token?` + new URLSearchParams({
      grant_type: 'th_refresh_token', access_token: refreshTokenValue,
    }));
    if (!res.ok) throw new SocialApiError(`Threads token refresh failed: ${await res.text()}`, res.status, 'threads');
    const data = await res.json() as { access_token: string; expires_in?: number };
    return { access_token: data.access_token, refresh_token: data.access_token, expires_in: data.expires_in };
  }

  private async createContainer(accessToken: string, params: Record<string, string>): Promise<string> {
    const res = await fetch(`${TH_V}/me/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, access_token: accessToken }),
    });
    if (!res.ok) throw new SocialApiError(`Threads container failed: ${await res.text()}`, res.status, 'threads');
    return (await res.json() as { id: string }).id;
  }

  private async waitUntilReady(accessToken: string, containerId: string) {
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${TH_V}/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(accessToken)}`);
      if (res.ok) {
        const s = await res.json() as { status?: string; error_message?: string };
        if (s.status === 'FINISHED' || s.status === 'PUBLISHED') return;
        if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new SocialApiError(`Threads media processing failed: ${s.error_message || s.status}`, 400, 'threads');
      }
      await sleep(3000);
    }
    throw new SocialApiError('Threads media processing timed out', 504, 'threads');
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    const urls = payload.media_urls || [];
    const types = payload.media_types || [];
    const text = payload.content || '';
    const mediaParams = (url: string, type: string | undefined): Record<string, string> =>
      type === 'video' ? { media_type: 'VIDEO', video_url: url } : { media_type: 'IMAGE', image_url: url };

    let creationId: string;
    if (urls.length === 0) {
      creationId = await this.createContainer(accessToken, { media_type: 'TEXT', text });
    } else if (urls.length === 1) {
      creationId = await this.createContainer(accessToken, { ...mediaParams(urls[0], types[0]), text });
      await this.waitUntilReady(accessToken, creationId);
    } else {
      const children: string[] = [];
      for (let i = 0; i < Math.min(urls.length, 20); i++) {
        const id = await this.createContainer(accessToken, { ...mediaParams(urls[i], types[i]), is_carousel_item: 'true' });
        await this.waitUntilReady(accessToken, id);
        children.push(id);
      }
      creationId = await this.createContainer(accessToken, { media_type: 'CAROUSEL', children: children.join(','), text });
    }

    const pubRes = await fetch(`${TH_V}/me/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ creation_id: creationId, access_token: accessToken }),
    });
    if (!pubRes.ok) throw new SocialApiError(`Threads publish failed: ${await pubRes.text()}`, pubRes.status, 'threads');
    const { id } = await pubRes.json() as { id: string };

    let url: string | undefined;
    try {
      const linkRes = await fetch(`${TH_V}/${id}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`);
      if (linkRes.ok) url = (await linkRes.json() as { permalink?: string }).permalink;
    } catch { /* permalink is optional */ }
    return { success: true, platform_post_id: id, platform_post_url: url };
  }

  async uploadMedia(_accessToken: string, fileUrl: string): Promise<string> {
    return fileUrl;
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const zero = { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
    try {
      const res = await fetch(`${TH_V}/${platformPostId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${encodeURIComponent(accessToken)}`);
      if (!res.ok) return zero;
      const data = await res.json() as { data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> };
      const get = (n: string) => {
        const m = data.data?.find((x) => x.name === n);
        return Number(m?.values?.[0]?.value ?? m?.total_value?.value ?? 0);
      };
      return { likes: get('likes'), comments: get('replies'), shares: get('reposts') + get('quotes'), reach: get('views'), impressions: get('views'), clicks: 0 };
    } catch {
      return zero;
    }
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${TH_V}/me?fields=id&access_token=${encodeURIComponent(accessToken)}`);
    return res.ok;
  }
}
