import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';
// force-ssl is needed to post the optional first comment
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ');

/** First line of the text, capped at YouTube's 100 character title limit. */
export function youtubeTitle(content: string): string {
  const first = (content || '').split('\n').map((l) => l.trim()).find(Boolean) || 'New video';
  return first.replace(/[<>]/g, '').slice(0, 100);
}

export class YouTubeProvider implements SocialProvider {
  readonly name = 'youtube';
  readonly characterLimit = 5000;

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return `${GOOGLE_AUTH}?${params.toString()}`;
  }

  private async token(body: Record<string, string>) {
    const res = await fetch(GOOGLE_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, ...body }),
    });
    if (!res.ok) throw new SocialApiError(`YouTube token request failed: ${await res.text()}`, res.status, 'youtube');
    return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const tokens = await this.token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
    const chRes = await fetch(`${YT_API}/channels?part=snippet&mine=true`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!chRes.ok) throw new SocialApiError('Failed to fetch YouTube channel', chRes.status, 'youtube');
    const ch = await chRes.json() as { items?: Array<{ id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }> };
    const channel = ch.items?.[0];
    if (!channel) throw new SocialApiError('No YouTube channel found on this Google account. Create a channel first.', 400, 'youtube');
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      account_id: channel.id,
      account_name: channel.snippet?.title || 'YouTube channel',
      account_avatar_url: channel.snippet?.thumbnails?.default?.url,
      account_type: 'channel',
      scopes: tokens.scope || SCOPES,
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<TokenRefreshResult> {
    const data = await this.token({ grant_type: 'refresh_token', refresh_token: refreshTokenValue });
    return { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in };
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    const urls = payload.media_urls || [];
    const types = payload.media_types || [];
    const idx = types.findIndex((t) => t === 'video');
    const videoUrl = idx >= 0 ? urls[idx] : undefined;
    if (!videoUrl) throw new SocialApiError('YouTube posts need a video', 400, 'youtube');

    const fileRes = await fetch(videoUrl);
    if (!fileRes.ok) throw new SocialApiError(`Could not download the video (${fileRes.status})`, 400, 'youtube');
    const buf = Buffer.from(await fileRes.arrayBuffer());
    const mime = fileRes.headers.get('content-type') || 'video/mp4';

    const content = payload.content || '';
    const initRes = await fetch(`${YT_UPLOAD}?uploadType=resumable&part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime,
        'X-Upload-Content-Length': String(buf.length),
      },
      body: JSON.stringify({
        snippet: { title: youtubeTitle(content), description: content.slice(0, 5000) },
        status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
      }),
    });
    if (!initRes.ok) throw new SocialApiError(`YouTube upload init failed: ${await initRes.text()}`, initRes.status, 'youtube');
    const location = initRes.headers.get('location');
    if (!location) throw new SocialApiError('YouTube did not return an upload URL', 500, 'youtube');

    const upRes = await fetch(location, {
      method: 'PUT',
      headers: { 'Content-Type': mime, 'Content-Length': String(buf.length) },
      body: buf,
    });
    if (!upRes.ok) throw new SocialApiError(`YouTube upload failed: ${await upRes.text()}`, upRes.status, 'youtube');
    const video = await upRes.json() as { id: string };
    return { success: true, platform_post_id: video.id, platform_post_url: `https://www.youtube.com/watch?v=${video.id}` };
  }

  async postComment(accessToken: string, platformPostId: string, text: string): Promise<void> {
    const res = await fetch(`${YT_API}/commentThreads?part=snippet`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ snippet: { videoId: platformPostId, topLevelComment: { snippet: { textOriginal: text } } } }),
    });
    if (!res.ok) throw new SocialApiError(`YouTube comment failed: ${await res.text()}`, res.status, 'youtube');
  }

  async uploadMedia(_accessToken: string, fileUrl: string): Promise<string> {
    return fileUrl;
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const res = await fetch(`${YT_API}/videos?part=statistics&id=${encodeURIComponent(platformPostId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new SocialApiError('Failed to fetch YouTube metrics', res.status, 'youtube');
    const data = await res.json() as { items?: Array<{ statistics?: Record<string, string> }> };
    const s = data.items?.[0]?.statistics || {};
    const views = Number(s.viewCount || 0);
    return { likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0), shares: 0, reach: views, impressions: views, clicks: 0 };
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${YT_API}/channels?part=id&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return res.ok;
  }
}
