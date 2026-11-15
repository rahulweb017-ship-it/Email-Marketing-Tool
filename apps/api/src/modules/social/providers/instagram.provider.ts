import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const FB_AUTH = 'https://www.facebook.com/v19.0/dialog/oauth';

export class InstagramProvider implements SocialProvider {
  readonly name = 'instagram';
  readonly characterLimit = 2200;

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
      scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
      response_type: 'code',
    });
    return `${FB_AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    // Exchange code for user token (same as Facebook)
    const tokenRes = await fetch(`${GRAPH_API}/oauth/access_token?` + new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    }));

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new SocialApiError(`Instagram token exchange failed: ${err}`, tokenRes.status, 'instagram');
    }

    const tokenData = await tokenRes.json() as { access_token: string };

    // Exchange for long-lived token
    const longRes = await fetch(`${GRAPH_API}/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: tokenData.access_token,
    }));

    if (!longRes.ok) {
      throw new SocialApiError('Instagram long-lived token exchange failed', longRes.status, 'instagram');
    }

    const longData = await longRes.json() as { access_token: string; expires_in?: number };

    // Get pages, then find connected Instagram Business Account
    const pagesRes = await fetch(`${GRAPH_API}/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}`, {
      headers: { 'Authorization': `Bearer ${longData.access_token}` },
    });

    if (!pagesRes.ok) {
      throw new SocialApiError('Failed to fetch pages for Instagram', pagesRes.status, 'instagram');
    }

    const pagesData = await pagesRes.json() as {
      data: Array<{
        id: string;
        name: string;
        instagram_business_account?: { id: string; username: string; profile_picture_url?: string };
      }>;
    };

    // Find first page with an IG business account
    const pageWithIg = pagesData.data.find(p => p.instagram_business_account);
    if (!pageWithIg || !pageWithIg.instagram_business_account) {
      throw new SocialApiError(
        'No Instagram Business account found. Connect an Instagram Business or Creator account to a Facebook Page first.',
        400, 'instagram',
      );
    }

    const ig = pageWithIg.instagram_business_account;

    // Get the page access token (long-lived) for this page
    const pageTokenRes = await fetch(`${GRAPH_API}/${pageWithIg.id}?fields=access_token`, {
      headers: { 'Authorization': `Bearer ${longData.access_token}` },
    });

    const pageTokenData = await pageTokenRes.json() as { access_token: string };

    return {
      access_token: pageTokenData.access_token,
      expires_in: undefined,
      account_id: ig.id,
      account_name: `@${ig.username}`,
      account_avatar_url: ig.profile_picture_url,
      account_type: 'business',
      scopes: 'instagram_basic,instagram_content_publish',
    };
  }

  async refreshToken(_refreshTokenValue: string): Promise<TokenRefreshResult> {
    throw new SocialApiError('Instagram page tokens do not require refresh', 400, 'instagram');
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    // Instagram requires media — container-based publish flow
    if (!payload.media_urls || payload.media_urls.length === 0) {
      throw new SocialApiError('Instagram posts require at least one image', 400, 'instagram');
    }

    // Get IG user ID
    const meRes = await fetch(`${GRAPH_API}/me?fields=instagram_business_account{id}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    let igUserId: string;
    if (meRes.ok) {
      const meData = await meRes.json() as { instagram_business_account?: { id: string }; id?: string };
      igUserId = meData.instagram_business_account?.id || meData.id || '';
    } else {
      // Might already be the IG account ID in the token context
      throw new SocialApiError('Failed to resolve Instagram account', meRes.status, 'instagram');
    }

    const videoIdx = (payload.media_types || []).findIndex((t) => t === 'video');
    if (videoIdx >= 0) {
      const cRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ media_type: 'REELS', video_url: payload.media_urls[videoIdx], caption: payload.content }),
      });
      if (!cRes.ok) throw new SocialApiError(`Instagram video container failed: ${await cRes.text()}`, cRes.status, 'instagram');
      const { id: containerId } = await cRes.json() as { id: string };
      // Video containers must finish processing before they can be published
      let ready = false;
      for (let i = 0; i < 40 && !ready; i++) {
        await new Promise((res) => setTimeout(res, 3000));
        const sRes = await fetch(`${GRAPH_API}/${containerId}?fields=status_code`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
        const s = sRes.ok ? await sRes.json() as { status_code?: string } : {};
        if (s.status_code === 'FINISHED') ready = true;
        if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new SocialApiError('Instagram could not process the video', 400, 'instagram');
      }
      if (!ready) throw new SocialApiError('Instagram video processing timed out', 504, 'instagram');
      const pRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ creation_id: containerId }),
      });
      if (!pRes.ok) throw new SocialApiError(`Instagram publish failed: ${await pRes.text()}`, pRes.status, 'instagram');
      const pData = await pRes.json() as { id: string };
      return { success: true, platform_post_id: pData.id, platform_post_url: `https://www.instagram.com/p/${pData.id}/` };
    }

    if (payload.media_urls.length === 1) {
      // Single image post
      const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          image_url: payload.media_urls[0],
          caption: payload.content,
        }),
      });

      if (!containerRes.ok) {
        const err = await containerRes.text();
        throw new SocialApiError(`Instagram container creation failed: ${err}`, containerRes.status, 'instagram');
      }

      const containerData = await containerRes.json() as { id: string };

      // Publish the container
      const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ creation_id: containerData.id }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.text();
        throw new SocialApiError(`Instagram publish failed: ${err}`, publishRes.status, 'instagram');
      }

      const publishData = await publishRes.json() as { id: string };
      return {
        success: true,
        platform_post_id: publishData.id,
        platform_post_url: `https://www.instagram.com/p/${publishData.id}/`,
      };
    } else {
      // Carousel post
      const childIds: string[] = [];
      for (const url of payload.media_urls) {
        const childRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
          }),
        });
        if (childRes.ok) {
          const childData = await childRes.json() as { id: string };
          childIds.push(childData.id);
        }
      }

      const carouselRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          caption: payload.content,
          children: childIds,
        }),
      });

      if (!carouselRes.ok) {
        const err = await carouselRes.text();
        throw new SocialApiError(`Instagram carousel creation failed: ${err}`, carouselRes.status, 'instagram');
      }

      const carouselData = await carouselRes.json() as { id: string };

      const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ creation_id: carouselData.id }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.text();
        throw new SocialApiError(`Instagram carousel publish failed: ${err}`, publishRes.status, 'instagram');
      }

      const publishData = await publishRes.json() as { id: string };
      return {
        success: true,
        platform_post_id: publishData.id,
        platform_post_url: `https://www.instagram.com/p/${publishData.id}/`,
      };
    }
  }

  async uploadMedia(_accessToken: string, fileUrl: string, _mimeType: string): Promise<string> {
    // Instagram handles media via URL during container creation
    return fileUrl;
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const res = await fetch(
      `${GRAPH_API}/${platformPostId}?fields=like_count,comments_count,insights.metric(impressions,reach)`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      throw new SocialApiError('Failed to fetch Instagram metrics', res.status, 'instagram');
    }

    const data = await res.json() as {
      like_count?: number;
      comments_count?: number;
      insights?: { data: Array<{ name: string; values: Array<{ value: number }> }> };
    };

    let impressions = 0;
    let reach = 0;
    if (data.insights?.data) {
      for (const m of data.insights.data) {
        if (m.name === 'impressions') impressions = m.values[0]?.value || 0;
        if (m.name === 'reach') reach = m.values[0]?.value || 0;
      }
    }

    return {
      likes: data.like_count || 0,
      comments: data.comments_count || 0,
      shares: 0,
      reach,
      impressions,
      clicks: 0,
    };
  }

  async postComment(accessToken: string, platformPostId: string, text: string): Promise<void> {
    const res = await fetch(`${GRAPH_API}/${platformPostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) throw new SocialApiError(`Instagram comment failed: ${await res.text()}`, res.status, 'instagram');
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${GRAPH_API}/me?access_token=${accessToken}`);
    return res.ok;
  }
}
