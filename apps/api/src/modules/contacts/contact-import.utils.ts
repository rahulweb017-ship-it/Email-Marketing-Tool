import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { toE164 } from '../../shared/utils/phone.js';
import { isValidEmail, normalizeEmail } from '../../shared/utils/email-validator.js';

/** One raw CSV row as mapped by the importer UI (all values are untrusted strings). */
export type RawImportRow = Record<string, unknown>;

export interface CleanContact {
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  country_code: string | null;
}

export interface CleanResult {
  contact: CleanContact;
  /** Human-readable notes about what was auto-corrected. */
  fixes: string[];
  /** Why a value had to be dropped (row may still be importable). */
  warnings: string[];
  /** Set when the row has neither a usable email nor a usable phone. */
  error: string | null;
}

const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF\u00A0]/g;

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim();
}

// ---- Country ----

const COUNTRY_NAMES: Record<string, CountryCode> = {
  india: 'IN', bharat: 'IN', ind: 'IN',
  usa: 'US', 'united states': 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', 'united kingdom': 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB',
  uae: 'AE', 'united arab emirates': 'AE', dubai: 'AE',
  canada: 'CA', australia: 'AU', germany: 'DE', france: 'FR', spain: 'ES', italy: 'IT',
  netherlands: 'NL', sweden: 'SE', switzerland: 'CH', singapore: 'SG', japan: 'JP',
  brazil: 'BR', mexico: 'MX', nepal: 'NP', bangladesh: 'BD', 'sri lanka': 'LK', pakistan: 'PK',
  'saudi arabia': 'SA', ksa: 'SA', qatar: 'QA', oman: 'OM', kuwait: 'KW', bahrain: 'BH',
  malaysia: 'MY', indonesia: 'ID', philippines: 'PH', 'south africa': 'ZA', nigeria: 'NG', kenya: 'KE',
  'new zealand': 'NZ', ireland: 'IE', china: 'CN',
};
// Where several countries share a calling code, pick the one people almost always mean.
const MAIN_FOR_CALLING_CODE: Record<string, CountryCode> = { '1': 'US', '7': 'RU', '44': 'GB', '61': 'AU', '47': 'NO', '590': 'GP', '262': 'RE', '212': 'MA' };
const SUPPORTED = new Set<string>(getCountries());

export function cleanCountry(raw: unknown): CountryCode | null {
  const s = str(raw).toLowerCase().replace(/\./g, '');
  if (!s) return null;
  if (COUNTRY_NAMES[s]) return COUNTRY_NAMES[s];
  const upper = s.toUpperCase();
  if (upper.length === 2 && SUPPORTED.has(upper)) return upper as CountryCode;
  const dial = s.replace(/^\+/, '').replace(/^0+(?=\d)/, '');
  if (/^\d{1,3}$/.test(dial)) {
    if (MAIN_FOR_CALLING_CODE[dial]) return MAIN_FOR_CALLING_CODE[dial];
    const match = getCountries().find((c) => getCountryCallingCode(c) === dial);
    if (match) return match;
  }
  return null;
}

// ---- Email ----

const DOMAIN_TYPOS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com', 'gmail.om': 'gmail.com', 'gmail.comm': 'gmail.com', 'g.mail.com': 'gmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yhaoo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'outllook.com': 'outlook.com',
  'rediffmail.con': 'rediffmail.com', 'redifmail.com': 'rediffmail.com', 'icloud.con': 'icloud.com',
};

export function cleanEmail(raw: unknown): { email: string | null; fixed: boolean; invalid: boolean } {
  const original = str(raw);
  if (!original) return { email: null, fixed: false, invalid: false };
  let s = original;
  const angle = s.match(/<([^>]+)>/);
  if (angle) s = angle[1];
  s = s.replace(/^mailto:/i, '').replace(/\s*@\s*/g, '@').replace(/\s*\.\s*/g, '.');
  // Several addresses in one cell: keep the first
  s = s.split(/[;\s|]+|,(?=\s*[^@,]+@)/).find((p) => p.includes('@')) ?? s;
  s = s.replace(/\s+/g, '').replace(/^["'(\[]+|["')\].,;:]+$/g, '').toLowerCase();
  s = s.replace(/@+/g, '@').replace(/\.{2,}/g, '.').replace(/,(?=[a-z]{2,}$)/, '.');
  const at = s.lastIndexOf('@');
  if (at > 0) {
    let domain = s.slice(at + 1).replace(/^\.+/, '');
    domain = domain.replace(/\.(con|cmo|ocm|vom|xom|comm)$/, '.com');
    domain = DOMAIN_TYPOS[domain] ?? domain;
    s = s.slice(0, at) + '@' + domain;
  }
  if (!isValidEmail(s)) return { email: null, fixed: false, invalid: true };
  return { email: s, fixed: s !== original.toLowerCase(), invalid: false };
}

// ---- Phone ----

export function cleanPhone(raw: unknown, region: string): { phone: string | null; e164: string | null; fixed: boolean; reason: string | null } {
  const original = str(raw);
  if (!original) return { phone: null, e164: null, fixed: false, reason: null };
  let s = original.replace(/^(tel:|phone:|ph:|mob(ile)?:|p:)\s*/i, '').replace(/^[='"]+|["']+$/g, '');

  // Excel turns long numbers into 9.18872544458E+11 or appends ".0"
  const sci = s.replace(/\s/g, '').match(/^(\d)(?:[.,](\d+))?e\+?(\d+)$/i);
  if (sci) {
    const digits = sci[1] + (sci[2] ?? '');
    const total = Number(sci[3]) + 1;
    if (digits.length > total) return { phone: original, e164: null, fixed: false, reason: 'not a phone number' };
    if (digits.length < total) {
      return { phone: original, e164: null, fixed: false, reason: 'number was shortened by Excel (scientific notation); re-export the column as text' };
    }
    s = digits;
  }
  s = s.replace(/^(\d+)\.0+$/, '$1');

  // Several numbers in one cell: try each, keep the first valid one
  const parts = s.split(/\s*(?:\/|,|;|\||\bor\b|&)\s*/i).filter(Boolean);
  for (const part of parts) {
    const e164 = toE164(part, region) ?? (/^\d{11,15}$/.test(part.replace(/\D/g, '')) ? toE164('+' + part.replace(/\D/g, ''), region) : null);
    if (e164) return { phone: part, e164, fixed: part !== original, reason: null };
  }
  return { phone: original, e164: null, fixed: false, reason: 'invalid phone number' };
}

// ---- Names ----

function tidyName(raw: unknown, max: number): string | null {
  const s = str(raw).replace(/^[-_.,]+|[-_.,]+$/g, '');
  if (!s) return null;
  const letters = s.replace(/[^\p{L}]/gu, '');
  // Only re-case when the whole value is shouty or all lowercase
  const recase = letters.length > 1 && (letters === letters.toUpperCase() || letters === letters.toLowerCase());
  const out = recase ? s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, p, c) => p + c.toUpperCase()) : s;
  return out.slice(0, max);
}

function splitFullName(full: string): { first: string; last: string | null } {
  const parts = full.split(' ');
  return parts.length === 1 ? { first: parts[0], last: null } : { first: parts[0], last: parts.slice(1).join(' ') };
}

// ---- Row ----

export function cleanImportRow(row: RawImportRow, defaultRegion = 'IN'): CleanResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  const rawCountry = str(row.country_code ?? row.country);
  const country = cleanCountry(rawCountry);
  if (rawCountry && !country) warnings.push(`unknown country "${rawCountry}"`);
  else if (country && rawCountry !== country) fixes.push('country');

  const em = cleanEmail(row.email);
  if (em.fixed) fixes.push('email');
  if (em.invalid) warnings.push('invalid email');

  const ph = cleanPhone(row.phone, country || defaultRegion);
  if (ph.fixed) fixes.push('phone');
  if (ph.reason) warnings.push(ph.reason);

  let first = tidyName(row.first_name, 100);
  let last = tidyName(row.last_name, 100);
  const full = tidyName(row.full_name ?? row.name, 200);
  if (full && !first && !last) {
    const split = splitFullName(full);
    first = split.first.slice(0, 100);
    last = split.last?.slice(0, 100) ?? null;
    fixes.push('name split');
  }
  if ((first && first !== str(row.first_name)) || (last && last !== str(row.last_name) && !full)) fixes.push('name');

  const contact: CleanContact = {
    email: em.email,
    phone: ph.e164 ? ph.phone : null,
    phone_e164: ph.e164,
    first_name: first,
    last_name: last,
    company_name: str(row.company_name).slice(0, 200) || null,
    country_code: country ?? (ph.e164 ? null : null),
  };

  const error = !contact.email && !contact.phone_e164
    ? (warnings.length ? `no usable email or phone (${warnings.join(', ')})` : 'no email or phone')
    : null;

  return { contact, fixes: [...new Set(fixes)], warnings, error };
}

/** Key used to spot the same person twice: email first, then phone. */
export function dedupeKeys(c: Pick<CleanContact, 'email' | 'phone_e164'>): string[] {
  const keys: string[] = [];
  if (c.email) keys.push('e:' + normalizeEmail(c.email));
  if (c.phone_e164) keys.push('p:' + c.phone_e164);
  return keys;
}
