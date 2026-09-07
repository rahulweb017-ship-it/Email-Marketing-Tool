import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import { SmtpProvider } from './providers/smtp.provider.js';
import { SendGridProvider } from './providers/sendgrid.provider.js';
import { MailgunProvider } from './providers/mailgun.provider.js';
import { PostmarkProvider } from './providers/postmark.provider.js';
import type { EmailProvider } from './providers/types.js';

const ENCRYPTION_KEY = crypto.scryptSync(env.HMAC_SECRET, 'sending-config', 32);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function listSendingConfigs(orgId: string) {
  const configs = await db('sending_configs').where('org_id', orgId).orderBy('created_at', 'desc');
  // Strip encrypted settings for list view
  return configs.map((c: Record<string, unknown>) => ({
    ...c,
    settings: undefined,
    has_settings: true,
  }));
}

export async function getSendingConfig(orgId: string, configId: string) {
  const config = await db('sending_configs').where({ id: configId, org_id: orgId }).first();
  if (!config) throw new AppError(404, 'Sending config not found');

  // Decrypt settings
  if (config.settings_encrypted) {
    config.settings = JSON.parse(decrypt(config.settings_encrypted));
  }
  delete config.settings_encrypted;
  return config;
}

export async function createSendingConfig(orgId: string, input: {
  name: string;
  provider: string;
  settings: Record<string, unknown>;
  is_default?: boolean;
}) {
  const id = uuidv4();
  const settings_encrypted = encrypt(JSON.stringify(input.settings));

  if (input.is_default) {
    // Unset other defaults
    await db('sending_configs').where({ org_id: orgId, is_default: true }).update({ is_default: false });
  }

  await db('sending_configs').insert({
    id,
    org_id: orgId,
    name: input.name,
    provider: input.provider,
    settings_encrypted,
    is_default: input.is_default ?? false,
    is_active: true,
  });

  return getSendingConfig(orgId, id);
}

export async function testSendingConfig(orgId: string, configId: string): Promise<{ success: boolean; message: string }> {
  const config = await getSendingConfig(orgId, configId);
  const provider = createProviderFromConfig(config);

  try {
    const success = await provider.testConnection();
    return { success, message: success ? 'Connection successful' : 'Connection failed' };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function updateSendingConfig(orgId: string, configId: string, input: {
  name?: string;
  settings?: Record<string, unknown>;
  is_default?: boolean;
}) {
  const existing = await db('sending_configs').where({ id: configId, org_id: orgId }).first();
  if (!existing) throw new AppError(404, 'Sending config not found');

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.settings !== undefined) updates.settings_encrypted = encrypt(JSON.stringify(input.settings));
  if (input.is_default !== undefined) {
    if (input.is_default) {
      await db('sending_configs').where({ org_id: orgId, is_default: true }).update({ is_default: false });
    }
    updates.is_default = input.is_default;
  }

  if (Object.keys(updates).length > 0) {
    updates.updated_at = new Date();
    await db('sending_configs').where({ id: configId, org_id: orgId }).update(updates);
  }

  return getSendingConfig(orgId, configId);
}

export async function deleteSendingConfig(orgId: string, configId: string) {
  const deleted = await db('sending_configs').where({ id: configId, org_id: orgId }).del();
  if (!deleted) throw new AppError(404, 'Sending config not found');
}

export function createProviderFromConfig(config: Record<string, unknown>): EmailProvider {
  const settings = config.settings as Record<string, unknown>;
  switch (config.provider) {
    case 'smtp':
      return new SmtpProvider({
        host: settings.host as string,
        port: settings.port as number,
        secure: settings.secure as boolean ?? false,
        auth: settings.username ? { user: settings.username as string, pass: settings.password as string } : undefined,
      });
    case 'sendgrid':
      return new SendGridProvider({ api_key: settings.api_key as string });
    case 'mailgun':
      return new MailgunProvider({
        api_key: settings.api_key as string,
        domain: settings.domain as string,
        region: (settings.region as 'us' | 'eu') || 'us',
      });
    case 'postmark':
      return new PostmarkProvider({
        server_token: settings.server_token as string,
        message_stream: settings.message_stream as string | undefined,
      });
    default:
      throw new AppError(400, `Unknown provider: ${config.provider}`);
  }
}
