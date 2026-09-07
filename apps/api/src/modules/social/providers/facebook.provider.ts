import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const FB_AUTH = 'https://www.facebook.com/v19.0/dialog/oauth';

export class FacebookProvider implements SocialProvider {
  readonly name = 'facebook';
  readonly characterLimit = 63206;

  private get appId(): string {
    return env.FACEBOOK_APP_ID || '';
  }

  private get appSecret(): string {
    return env.FACEBOOK_APP_SECRET || '';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,pages_read_user_content',
      response_type: 'code',
    });
    return `${FB_AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    // Exchange code for short-lived user token
    const tokenRes = await fetch(`${GRAPH_API}/oauth/access_token?` + new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    }));

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new SocialApiError(`Facebook token exchange failed: ${err}`, tokenRes.status, 'facebook');
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    // Exchange for long-lived user token
    const longRes = await fetch(`${GRAPH_API}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: tokenData.access_token,
    }));

    if (!longRes.ok) {
      throw new SocialApiError('Facebook long-lived token exchange failed', longRes.status, 'facebook');
    }

    const longData = await longRes.json() as { access_token: string; expires_in?: number };

    // Get pages the user manages
    const pagesRes = await fetch(`${GRAPH_API}/me/accounts?fields=id,name,access_token,picture`, {
      headers: { 'Authorization': `Bearer ${longData.access_token}` },
    });

    if (!pagesRes.ok) {
      throw new SocialApiError('Failed to fetch Facebook pages', pagesRes.status, 'facebook');
    }

    const pagesData = await pagesRes.json() as {
      data: Array<{ id: string; name: string; access_token: string; picture?: { data?: { url?: string } } }>;
    };

    // Use the first page (in a production app, let user choose)
    const page = pagesData.data[0];
    if (!page) {
      throw new SocialApiError('No Facebook pages found. Please create or manage a Facebook Page first.', 400, 'facebook');
    }

    return {
      access_token: page.access_token, // Page access token (long-lived, doesn't expire)
      expires_in: undefined, // Page tokens don't expire
      account_id: page.id,
      account_name: page.name,
      account_avatar_url: page.picture?.data?.url,
      account_type: 'page',
      scopes: 'pages_manage_posts,pages_read_engagement',
    };
  }

  async refreshToken(_refreshTokenValue: string): Promise<TokenRefreshResult> {
    // Facebook page tokens are long-lived and don't need refresh
    throw new SocialApiError('Facebook page tokens do not require refresh', 400, 'facebook');
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    // Get page ID from token
    const meRes = await fetch(`${GRAPH_API}/me?fields=id`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!meRes.ok) throw new SocialApiError('Failed to get page info', meRes.status, 'facebook');
    const meData = await meRes.json() as { id: string };
    const pageId = meData.id;

    let endpoint = `${GRAPH_API}/${pageId}/feed`;
    const body: Record<string, unknown> = {
      message: payload.content,
      access_token: accessToken,
    };

    // If media, use photos endpoint for single image
    if (payload.media_ids && payload.media_ids.length > 0) {
      if (payload.media_ids.length === 1) {
        endpoint = `${GRAPH_API}/${pageId}/photos`;
        body.url = payload.media_urls?.[0];
      } else {
        // Multi-photo: upload each, then attach to feed post
        const photoIds: string[] = [];
        for (const url of (payload.media_urls || [])) {
          const photoRes = await fetch(`${GRAPH_API}/${pageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              published: false,
              access_token: accessToken,
            }),
          });
          if (photoRes.ok) {
            const photoData = await photoRes.json() as { id: string };
            photoIds.push(photoData.id);
          }
        }
        photoIds.forEach((id, i) => {
          body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
        });
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new SocialApiError(`Facebook publish failed: ${err}`, res.status, 'facebook');
    }

    const data = await res.json() as { id: string; post_id?: string };
    const postId = data.post_id || data.id;
    return {
      success: true,
      platform_post_id: postId,
      platform_post_url: `https://www.facebook.com/${postId}`,
    };
  }

  async uploadMedia(accessToken: string, fileUrl: string, _mimeType: string): Promise<string> {
    // Facebook handles media upload inline with posting via URL
    // Return the URL as the "media ID" — actual upload happens during publish
    return fileUrl;
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const res = await fetch(
      `${GRAPH_API}/${platformPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${accessToken}`,
    );

    if (!res.ok) {
      throw new SocialApiError('Failed to fetch Facebook metrics', res.status, 'facebook');
    }

    const data = await res.json() as {
      likes?: { summary?: { total_count?: number } };
      comments?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    };

    // Try insights for reach/impressions
    let reach = 0;
    let impressions = 0;
    try {
      const insightsRes = await fetch(
        `${GRAPH_API}/${platformPostId}/insights?metric=post_impressions,post_impressions_unique&access_token=${accessToken}`,
      );
      if (insightsRes.ok) {
        const insightsData = await insightsRes.json() as {
          data: Array<{ name: string; values: Array<{ value: number }> }>;
        };
        for (const metric of insightsData.data) {
          if (metric.name === 'post_impressions') impressions = metric.values[0]?.value || 0;
          if (metric.name === 'post_impressions_unique') reach = metric.values[0]?.value || 0;
        }
      }
    } catch { /* insights may not be available for all post types */ }

    return {
      likes: data.likes?.summary?.total_count || 0,
      comments: data.comments?.summary?.total_count || 0,
      shares: data.shares?.count || 0,
      reach,
      impressions,
      clicks: 0,
    };
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${GRAPH_API}/me?access_token=${accessToken}`);
    return res.ok;
  }
}
