import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root (config/ -> src/ -> api/ -> apps/ -> root)
dotenv.config({ path: resolve(__dirname, '../../../../.env') });
// Also try local .env in apps/api/
dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://openpg:openpgpwd@localhost:5432/self_hosted_email',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // HMAC for tracking tokens
  HMAC_SECRET: process.env.HMAC_SECRET || 'dev-hmac-secret-change-in-production',

  // URLs
  APP_URL: process.env.APP_URL || 'http://localhost:3001',

  // Uploaded email media (served publicly at APP_URL/media/...)
  MEDIA_DIR: process.env.MEDIA_DIR || resolve(__dirname, '../../uploads'),
  MEDIA_MAX_MB: parseInt(process.env.MEDIA_MAX_MB || '10', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Super Admin
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || 'superadmin@system.local',

  // Social Media OAuth
  TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID || '',
  TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET || '',
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || '',
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || '',
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
  // Organization scopes (w_organization_social etc.) require LinkedIn's Community Management API product
  LINKEDIN_SCOPES: process.env.LINKEDIN_SCOPES || 'openid profile w_member_social',
  SOCIAL_OAUTH_CALLBACK_URL: process.env.SOCIAL_OAUTH_CALLBACK_URL || '',
  // YouTube (Google OAuth client)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  THREADS_APP_ID: process.env.THREADS_APP_ID || '',
  THREADS_APP_SECRET: process.env.THREADS_APP_SECRET || '',
  PINTEREST_APP_ID: process.env.PINTEREST_APP_ID || '',
  PINTEREST_APP_SECRET: process.env.PINTEREST_APP_SECRET || '',

  // WhatsApp (Meta Cloud API webhooks) — app secret falls back to the Facebook app secret
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
  WHATSAPP_GRAPH_VERSION: process.env.WHATSAPP_GRAPH_VERSION || 'v21.0',

  // AI (Claude API) for WhatsApp compose, reply suggestions and auto-replies
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  WHATSAPP_AI_MODEL: process.env.WHATSAPP_AI_MODEL || 'claude-opus-5-5',
  // Model for platform-wide AI features (email, subject lines, social, WhatsApp)
  AI_MODEL: process.env.AI_MODEL || process.env.WHATSAPP_AI_MODEL || 'claude-opus-5-5',
  // AI image generation (OpenAI image API)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
} as const;
