import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Normalize a free-text phone number to E.164 (e.g. "098765 43210" -> "+919876543210").
 * Returns null when the number is not valid for the given/default region.
 */
export function toE164(raw: string | null | undefined, defaultCountry: string = 'IN'): string | null {
  if (!raw) return null;
  const cleaned = String(raw).trim();
  if (!cleaned) return null;
  const region = (defaultCountry || 'IN').toUpperCase() as CountryCode;
  // "00" international prefix -> "+"
  const input = cleaned.startsWith('00') ? '+' + cleaned.slice(2) : cleaned;
  const parsed = parsePhoneNumberFromString(input, region);
  return parsed?.isValid() ? parsed.number : null;
}

/** "+919876543210" -> "919876543210" (WhatsApp wire format for Meta "to" and Baileys JIDs) */
export function e164ToWaId(e164: string): string {
  return e164.replace(/^\+/, '');
}

/** "919876543210" or "919876543210@s.whatsapp.net" -> "+919876543210" */
export function waIdToE164(waId: string): string {
  const digits = waId.split('@')[0].split(':')[0].replace(/\D/g, '');
  return '+' + digits;
}
