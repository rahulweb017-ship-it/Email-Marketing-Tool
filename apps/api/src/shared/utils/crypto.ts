import crypto from 'crypto';
import { env } from '../../config/env.js';

const IV_LENGTH = 16;
const keyCache = new Map<string, Buffer>();

function keyFor(salt: string): Buffer {
  let key = keyCache.get(salt);
  if (!key) {
    key = crypto.scryptSync(env.HMAC_SECRET, salt, 32);
    keyCache.set(salt, key);
  }
  return key;
}

/** AES-256-CBC with a key derived from HMAC_SECRET + salt. Output: "ivHex:cipherHex" (same format as sending configs). */
export function encryptString(text: string, salt: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyFor(salt), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptString(text: string, salt: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyFor(salt), iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
