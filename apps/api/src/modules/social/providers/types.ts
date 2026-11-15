export interface SocialPostPayload {
  content: string;
  media_urls?: string[];
  media_ids?: string[];
  /** Parallel to media_urls: 'image' | 'video' | 'gif'. */
  media_types?: string[];
}

export interface SocialPublishResult {
  success: boolean;
  platform_post_id?: string;
  platform_post_url?: string;
  error?: string;
}

export interface SocialMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  account_id: string;
  account_name: string;
  account_avatar_url?: string;
  account_type?: string;
  scopes?: string;
}

export interface TokenRefreshResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface SocialProvider {
  readonly name: string;
  readonly characterLimit: number;

  getAuthUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenRefreshResult>;
  publish(accessToken: string, payload: SocialPostPayload): Promise<SocialPublishResult>;
  uploadMedia(accessToken: string, fileUrl: string, mimeType: string): Promise<string>;
  getMetrics(accessToken: string, platformPostId: string): Promise<SocialMetrics>;
  verifyToken(accessToken: string): Promise<boolean>;
  /** Optional: post a comment under a published post (used for "first comment"). */
  postComment?(accessToken: string, platformPostId: string, text: string): Promise<void>;
}

export class SocialApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public platform: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'SocialApiError';
  }

  get isRateLimit(): boolean {
    return this.statusCode === 429;
  }
}
