import dns from 'dns';
import { db } from '../../config/database.js';

/** Normalize email: lowercase, trim, handle Gmail dots, etc. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Basic email format validation */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Top 200 disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'mailnesia.com', 'temp-mail.org', 'fakeinbox.com',
  'mailcatch.com', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.de', 'gettempmail.com', 'tempail.com', 'tempr.email',
  'discard.email', 'discardmail.com', 'discardmail.de', 'emailondeck.com',
  'mailtemp.info', 'harakirimail.com', 'tmail.ws', 'mohmal.com',
  'burnermail.io', 'maildrop.cc', 'mailsac.com', 'mytemp.email',
  'tempmailo.com', 'tempmailaddress.com', 'throwawaymail.com',
  'getairmail.com', 'mailexpire.com', 'mailforspam.com',
  'safetymail.info', 'filzmail.com', 'inboxalias.com',
  'jetable.org', 'nospam.ze.tc', 'trash-mail.com', 'uggsrock.com',
  'spamfree24.org', 'spamgourmet.com', 'mytrashmail.com',
  'mailzilla.com', 'sharklasers.com', 'guerrillamailblock.com',
  'pokemail.net', 'spam4.me', 'binkmail.com', 'bobmail.info',
  'chammy.info', 'devnullmail.com', 'letthemeatspam.com',
  'mailblocks.com', 'mailnull.com', 'mailshell.com', 'mailsiphon.com',
  'msgos.com', 'pookmail.com', 'spambox.us', 'spamcero.com',
  'spamcorptastic.com', 'spamday.com', 'spamfighter.cf',
  'spamfighter.ga', 'spamfighter.gq', 'spamfighter.ml',
  'spamfighter.tk', 'spamherelots.com', 'spamhereplease.com',
  'spamhole.com', 'spaml.com', 'spammotel.com', 'spamobox.com',
  'spamspot.com', 'spamthis.co.uk', 'spamtrail.com', 'speed.1s.fr',
  'suremail.info', 'teleworm.us', 'tempemail.co.za', 'tempemail.net',
  'tempinbox.com', 'tempinbox.co.uk', 'tempmail.eu', 'tempmail2.com',
  'tempomail.fr', 'temporaryemail.net', 'temporaryemail.us',
  'temporaryforwarding.com', 'temporaryinbox.com', 'temporarymailaddress.com',
  'thankyou2010.com', 'thisisnotmyrealemail.com', 'throwam.com',
  'tittbit.in', 'trashmail.at', 'trashmail.org', 'trashymail.com',
  'turual.com', 'twinmail.de', 'tyldd.com', 'uggsrock.com',
  'upliftnow.com', 'venompen.com', 'veryreallyfakeemails.com',
  'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net',
  'viewcastmedia.org', 'vomoto.com', 'vpn.st', 'vsimcard.com',
  'vubby.com', 'wasteland.rfc822.org', 'webemail.me',
  'weg-werf-email.de', 'wegwerfadresse.de', 'wegwerfemail.com',
  'wegwerfemail.de', 'wegwerfmail.de', 'wegwerfmail.net',
  'wegwerfmail.org', 'wh4f.org', 'whatiaas.com', 'whatpaas.com',
  'whyspam.me', 'wikidocuslice.com', 'willhackforfood.biz',
  'willselfdestruct.com', 'winemaven.info', 'wronghead.com',
  'wuzup.net', 'wuzupmail.net', 'wwwnew.eu', 'xagloo.com',
  'xemaps.com', 'xents.com', 'xjoi.com', 'xoxy.net',
  'yep.it', 'yogamaven.com', 'yomail.info', 'yopmail.fr',
  'yopmail.net', 'ypmail.webarnak.fr.eu.org', 'yuurok.com',
  'zehnminutenmail.de', 'zippymail.info', 'zoaxe.com', 'zoemail.org',
  'inboxbear.com', 'mailhero.io', 'nada.email', 'nada.ltd',
  'anonbox.net', 'anonymbox.com', 'antichef.com', 'antichef.net',
  'baxomale.ht.cx', 'beefmilk.com', 'bigstring.com', 'binkmail.com',
  'bio-muesli.net', 'bobmail.info', 'bodhi.lawlita.com', 'bofthew.com',
  'bootybay.de', 'brefmail.com', 'brennendesreich.de', 'broadbandninja.com',
  'bsnow.net', 'bugmenot.com', 'bumpymail.com', 'casualdx.com',
  'centermail.com', 'centermail.net', 'chogmail.com', 'choicemail1.com',
  'clixser.com', 'cmail.net', 'cmail.org', 'coldemail.info',
  'consumerriot.com', 'cool.fr.nf', 'correo.blogos.net', 'cosmorph.com',
  'courriel.fr.nf', 'courrieltemporaire.com', 'crazymailing.com',
  'cubiclink.com', 'curryworld.de', 'cust.in', 'cuvox.de',
  'dacoolest.com', 'dandikmail.com', 'dayrep.com', 'dcemail.com',
  'deadaddress.com', 'deadspam.com', 'dingbone.com', 'disposableaddress.com',
  'disposableemailaddresses.emailmiser.com', 'disposableinbox.com',
  'dispose.it', 'dm.w3internet.co.uk', 'dodgeit.com', 'dodgit.com',
  'donemail.ru', 'dontreg.com', 'dontsendmespam.de', 'drdrb.com',
  'dump-email.info', 'dumpandjunk.com', 'dumpyemail.com',
]);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ValidationResult {
  status: 'valid' | 'invalid' | 'risky' | 'disposable';
  reason: string;
}

export async function validateEmail(email: string): Promise<ValidationResult> {
  // Step 1: Syntax check
  if (!isValidEmail(email)) {
    return { status: 'invalid', reason: 'Invalid email syntax' };
  }

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { status: 'invalid', reason: 'No domain found in email' };
  }

  // Step 2: Check disposable list first (no DNS needed)
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { status: 'disposable', reason: `Disposable email domain: ${domain}` };
  }

  // Step 3: Check cache
  const cached = await db('email_validation_cache')
    .where('email_domain', domain)
    .first();

  let hasMx: boolean;
  let isDisposable: boolean;

  if (cached && (Date.now() - new Date(cached.checked_at).getTime()) < CACHE_TTL_MS) {
    hasMx = cached.has_mx;
    isDisposable = cached.is_disposable;
  } else {
    // Step 4: DNS MX lookup
    try {
      const records = await dns.promises.resolveMx(domain);
      hasMx = records && records.length > 0;
    } catch {
      hasMx = false;
    }

    isDisposable = DISPOSABLE_DOMAINS.has(domain);

    // Upsert cache
    if (cached) {
      await db('email_validation_cache')
        .where('id', cached.id)
        .update({ has_mx: hasMx, is_disposable: isDisposable, checked_at: new Date(), updated_at: new Date() });
    } else {
      await db('email_validation_cache')
        .insert({ email_domain: domain, has_mx: hasMx, is_disposable: isDisposable })
        .onConflict('email_domain')
        .merge();
    }
  }

  // Step 5: Determine status
  if (isDisposable) {
    return { status: 'disposable', reason: `Disposable email domain: ${domain}` };
  }

  if (!hasMx) {
    return { status: 'invalid', reason: `No MX records found for domain: ${domain}` };
  }

  // Check for suspicious patterns (free email with unusual TLD, very new domains, etc.)
  const suspiciousPatterns = [
    /^[a-z]{1,2}\.[a-z]{2}$/, // Very short domains like a.bc
    /\d{4,}/, // Domains with 4+ consecutive digits
  ];
  const isSuspicious = suspiciousPatterns.some((p) => p.test(domain));
  if (isSuspicious) {
    return { status: 'risky', reason: `Suspicious domain pattern: ${domain}` };
  }

  return { status: 'valid', reason: 'Email appears valid with working MX records' };
}
