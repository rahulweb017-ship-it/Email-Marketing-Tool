import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const PIN_AUTH = 'https://www.pinterest.com/oauth/';
const PIN_API = 'https://api.pinterest.com/v5';
const SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';

export class PinterestProvider implements SocialProvider {
  readonly name = 'pinterest';
  readonly characterLimit = 500;

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: env.PINTEREST_APP_ID, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES, state,
    });
    return `${PIN_AUTH}?${params.toString()}`;
  }

  private async token(body: Record<string, string>) {
    const basic = Buffer.from(`${env.PINTEREST_APP_ID}:${env.PINTEREST_APP_SECRET}`).toString('base64');
    const res = await fetch(`${PIN_API}/oauth/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    });
    if (!res.ok) throw new SocialApiError(`Pinterest token request failed: ${await res.text()}`, res.status, 'pinterest');
    return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const tokens = await this.token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    const meRes = await fetch(`${PIN_API}/user_account`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!meRes.ok) throw new SocialApiError('Failed to fetch Pinterest profile', meRes.status, 'pinterest');
    const me = await meRes.json() as { username?: string; profile_image?: string; account_type?: string; id?: string };
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      account_id: me.id || me.username || 'pinterest',
      account_name: me.username ? `@${me.username}` : 'Pinterest',
      account_avatar_url: me.profile_image,
      account_type: (me.account_type || 'personal').toLowerCase(),
      scopes: tokens.scope || SCOPES,
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<TokenRefreshResult> {
    const data = await this.token({ grant_type: 'refresh_token', refresh_token: refreshTokenValue });
    return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in };
  }

  /** Pins go to the account's first board; there is no board picker yet. */
  private async firstBoardId(accessToken: string): Promise<string> {
    const res = await fetch(`${PIN_API}/boards?page_size=1`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new SocialApiError(`Could not list Pinterest boards: ${await res.text()}`, res.status, 'pinterest');
    const data = await res.json() as { items?: Array<{ id: string }> };
    const id = data.items?.[0]?.id;
    if (!id) throw new SocialApiError('Create a Pinterest board first, then try again', 400, 'pinterest');
    return id;
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    const urls = payload.media_urls || [];
    const types = payload.media_types || [];
    const idx = types.length ? types.findIndex((t) => t !== 'video') : 0;
    const imageUrl = idx >= 0 ? urls[idx] : undefined;
    if (!imageUrl) throw new SocialApiError('Pinterest pins need an image', 400, 'pinterest');

    const boardId = await this.firstBoardId(accessToken);
    const content = payload.content || '';
    const title = (content.split('\n').find((l) => l.trim()) || '').trim().slice(0, 100);
    const link = content.match(/https?:\/\/\S+/)?.[0];

    const res = await fetch(`${PIN_API}/pins`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: boardId,
        title: title || undefined,
        description: content.slice(0, 500),
        link,
        media_source: { source_type: 'image_url', url: imageUrl },
      }),
    });
    if (!res.ok) throw new SocialApiError(`Pinterest publish failed: ${await res.text()}`, res.status, 'pinterest');
    const pin = await res.json() as { id: string };
    return { success: true, platform_post_id: pin.id, platform_post_url: `https://www.pinterest.com/pin/${pin.id}/` };
  }

  async uploadMedia(_accessToken: string, fileUrl: string): Promise<string> {
    return fileUrl;
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const zero = { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
    try {
      const res = await fetch(`${PIN_API}/pins/${platformPostId}?pin_metrics=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return zero;
      const data = await res.json() as { pin_metrics?: { all_time?: Record<string, number>; lifetime_metrics?: Record<string, number> } };
      const m = data.pin_metrics?.all_time || data.pin_metrics?.lifetime_metrics || {};
      return {
        likes: Number(m.reaction || 0), comments: Number(m.comment || 0), shares: Number(m.save || 0),
        reach: Number(m.impression || 0), impressions: Number(m.impression || 0), clicks: Number(m.pin_click || m.outbound_click || 0),
      };
    } catch {
      return zero;
    }
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${PIN_API}/user_account`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.ok;
  }
}
