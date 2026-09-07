import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { db } from '../../config/database.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { CreateApiKeyInput } from './api-key.schema.js';

/**
 * Generate a new API key.
 * Returns the full key only once — after that only the prefix is available.
 */
export async function createApiKey(orgId: string, data: CreateApiKeyInput) {
  const id = uuidv4();

  // Generate a random 32-byte key
  const rawKey = crypto.randomBytes(32).toString('hex');
  const fullKey = `sk-${rawKey}`;
  const keyPrefix = `sk-...${rawKey.slice(-8)}`;
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  let expiresAt: Date | null = null;
  if (data.expires_in_days) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + data.expires_in_days);
  }

  await db('api_keys').insert({
    id,
    org_id: orgId,
    name: data.name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes: JSON.stringify(data.scopes),
    expires_at: expiresAt,
    is_active: true,
    last_used_at: null,
  });

  return {
    id,
    name: data.name,
    key: fullKey,
    key_prefix: keyPrefix,
    scopes: data.scopes,
    expires_at: expiresAt,
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

/**
 * List all API keys for an org.
 * Never exposes the key_hash — only the prefix.
 */
export async function listApiKeys(orgId: string) {
  const keys = await db('api_keys')
    .where({ org_id: orgId })
    .select('id', 'name', 'key_prefix', 'scopes', 'expires_at', 'is_active', 'last_used_at', 'created_at')
    .orderBy('created_at', 'desc');

  return keys.map((k: Record<string, unknown>) => ({
    ...k,
    scopes: typeof k.scopes === 'string' ? JSON.parse(k.scopes as string) : k.scopes,
  }));
}

/**
 * Revoke (soft-delete) an API key.
 */
export async function revokeApiKey(orgId: string, keyId: string) {
  const key = await db('api_keys').where({ id: keyId, org_id: orgId }).first();
  if (!key) throw new AppError(404, 'API key not found');

  await db('api_keys').where({ id: keyId }).update({
    is_active: false,
    updated_at: new Date(),
  });
}

/**
 * Validate an API key by hashing it and looking up the hash.
 * Returns the key record if valid, null otherwise.
 */
export async function validateApiKey(key: string) {
  if (!key || !key.startsWith('sk-')) return null;

  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const record = await db('api_keys')
    .where({ key_hash: keyHash, is_active: true })
    .first();

  if (!record) return null;

  // Check expiration
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at
  await db('api_keys').where({ id: record.id }).update({
    last_used_at: new Date(),
  });

  return {
    id: record.id,
    org_id: record.org_id,
    name: record.name,
    scopes: typeof record.scopes === 'string' ? JSON.parse(record.scopes) : record.scopes,
  };
}
