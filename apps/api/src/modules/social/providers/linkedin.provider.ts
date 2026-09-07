import { env } from '../../../config/env.js';
import type {
  SocialProvider, SocialPostPayload, SocialPublishResult,
  SocialMetrics, OAuthTokenResponse, TokenRefreshResult,
} from './types.js';
import { SocialApiError } from './types.js';

const LI_API = 'https://api.linkedin.com/v2';
const LI_AUTH = 'https://www.linkedin.com/oauth/v2/authorization';
const LI_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';

export class LinkedInProvider implements SocialProvider {
  readonly name = 'linkedin';
  readonly characterLimit = 3000;

  private get clientId(): string {
    return env.LINKEDIN_CLIENT_ID || '';
  }

  private get clientSecret(): string {
    return env.LINKEDIN_CLIENT_SECRET || '';
  }

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'openid profile w_member_social r_organization_social w_organization_social rw_organization_admin',
    });
    return `${LI_AUTH}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const res = await fetch(LI_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new SocialApiError(`LinkedIn token exchange failed: ${err}`, res.status, 'linkedin');
    }

    const tokens = await res.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      refresh_token_expires_in?: number;
    };

    // Get user profile
    const profileRes = await fetch(`${LI_API}/userinfo`, {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      throw new SocialApiError('Failed to fetch LinkedIn profile', profileRes.status, 'linkedin');
    }

    const profile = await profileRes.json() as {
      sub: string;
      name: string;
      picture?: string;
    };

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      account_id: profile.sub,
      account_name: profile.name,
      account_avatar_url: profile.picture,
      account_type: 'personal',
      scopes: 'openid profile w_member_social',
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<TokenRefreshResult> {
    const res = await fetch(LI_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new SocialApiError(`LinkedIn token refresh failed: ${err}`, res.status, 'linkedin');
    }

    const data = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult> {
    // Get author URN
    const profileRes = await fetch(`${LI_API}/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new SocialApiError('Failed to get LinkedIn profile', profileRes.status, 'linkedin');
    const profile = await profileRes.json() as { sub: string };
    const authorUrn = `urn:li:person:${profile.sub}`;

    const body: Record<string, unknown> = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: payload.content },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    // Add media if present
    if (payload.media_ids && payload.media_ids.length > 0) {
      const shareContent = body.specificContent as Record<string, Record<string, unknown>>;
      shareContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
      shareContent['com.linkedin.ugc.ShareContent'].media = payload.media_ids.map((assetId, i) => ({
        status: 'READY',
        media: assetId,
        title: { text: '' },
        description: { text: '' },
      }));
    }

    const res = await fetch(`${LI_API}/ugcPosts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new SocialApiError(`LinkedIn publish failed: ${err}`, res.status, 'linkedin');
    }

    const postId = res.headers.get('x-restli-id') || '';
    return {
      success: true,
      platform_post_id: postId,
      platform_post_url: `https://www.linkedin.com/feed/update/${postId}`,
    };
  }

  async uploadMedia(accessToken: string, fileUrl: string, _mimeType: string): Promise<string> {
    // Get author URN
    const profileRes = await fetch(`${LI_API}/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json() as { sub: string };
    const ownerUrn = `urn:li:person:${profile.sub}`;

    // Step 1: Register upload
    const registerRes = await fetch(`${LI_API}/assets?action=registerUpload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner: ownerUrn,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          }],
        },
      }),
    });

    if (!registerRes.ok) {
      throw new SocialApiError('LinkedIn media register failed', registerRes.status, 'linkedin');
    }

    const registerData = await registerRes.json() as {
      value: {
        uploadMechanism: {
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
            uploadUrl: string;
          };
        };
        asset: string;
      };
    };

    const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = registerData.value.asset;

    // Step 2: Upload binary
    const fileRes = await fetch(fileUrl);
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      throw new SocialApiError('LinkedIn media upload failed', uploadRes.status, 'linkedin');
    }

    return asset; // e.g., "urn:li:digitalmediaAsset:xxxxx"
  }

  async getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics> {
    const res = await fetch(
      `${LI_API}/socialActions/${encodeURIComponent(platformPostId)}?fields=likes,comments`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      throw new SocialApiError('Failed to fetch LinkedIn metrics', res.status, 'linkedin');
    }

    // LinkedIn's social actions API returns counts
    const data = await res.json() as {
      likes?: { count?: number };
      comments?: { count?: number };
    };

    return {
      likes: data.likes?.count || 0,
      comments: data.comments?.count || 0,
      shares: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
    };
  }

  async verifyToken(accessToken: string): Promise<boolean> {
    const res = await fetch(`${LI_API}/userinfo`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    return res.ok;
  }
}
