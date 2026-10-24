import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { generateShortCode } from '../../shared/utils/short-code.js';
import { generateTraceToken, generateUnsubscribeToken } from '../../shared/utils/hmac.js';

/**
 * Rewrite all links in HTML to tracked redirect URLs.
 * Mirrors Odoo's link_tracker integration in mass_mailing.
 *
 * Transforms: <a href="https://example.com">
 * Into:       <a href="https://app.example.com/r/aBcDeF/m/:traceId">
 *
 * Also injects:
 * - Open tracking pixel at end of body
 * - List-Unsubscribe headers
 */
export async function rewriteLinks(
  html: string,
  campaignId: string,
  traceId: string,
  contactId: string,
  contactEmail: string,
): Promise<{ html: string; headers: Record<string, string> }> {
  const baseUrl = env.APP_URL;

  // Rewrite <a href="..."> links to tracked redirects
  const linkRegex = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi;
  const processedUrls = new Map<string, string>();

  let rewrittenHtml = html;
  const matches = [...html.matchAll(linkRegex)];

  for (const match of matches) {
    const originalUrl = match[2];

    // Skip mailto, tel, anchor links, and unsubscribe links
    if (originalUrl.startsWith('mailto:') || originalUrl.startsWith('tel:') ||
        originalUrl.startsWith('#') || originalUrl.includes('/unsubscribe')) {
      continue;
    }

    if (!processedUrls.has(originalUrl)) {
      // Find or create tracked link
      let trackedLink = await db('tracked_links')
        .where({ campaign_id: campaignId, original_url: originalUrl })
        .first();

      if (!trackedLink) {
        const shortCode = generateShortCode();
        const id = uuidv4();
        await db('tracked_links').insert({
          id,
          campaign_id: campaignId,
          original_url: originalUrl,
          short_code: shortCode,
        });
        trackedLink = { short_code: shortCode };
      }

      const trackedUrl = `${baseUrl}/r/${trackedLink.short_code}/m/${traceId}`;
      processedUrls.set(originalUrl, trackedUrl);
    }

    const trackedUrl = processedUrls.get(originalUrl)!;
    rewrittenHtml = rewrittenHtml.replace(
      match[0],
      match[0].replace(originalUrl, trackedUrl),
    );
  }

  // Inject open tracking pixel before </body>
  const traceToken = generateTraceToken(traceId);
  const pixelUrl = `${baseUrl}/t/${traceId}/${traceToken}/pixel.gif`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;border:0" />`;

  if (rewrittenHtml.includes('</body>')) {
    rewrittenHtml = rewrittenHtml.replace('</body>', `${pixelTag}</body>`);
  } else {
    rewrittenHtml += pixelTag;
  }

  // Generate unsubscribe headers (RFC 8058)
  const unsubToken = generateUnsubscribeToken(campaignId, contactId, contactEmail);
  const unsubUrl = `${baseUrl}/unsubscribe/${campaignId}?contact_id=${contactId}&token=${unsubToken}`;
  const oneClickUrl = `${baseUrl}/unsubscribe/${campaignId}/oneclick`;

  const headers: Record<string, string> = {
    'List-Unsubscribe': `<${unsubUrl}>, <${oneClickUrl}?contact_id=${contactId}&token=${unsubToken}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Mailer': 'RabbitGrowth/1.0',
  };

  return { html: rewrittenHtml, headers };
}

/**
 * Replace merge tags in HTML with contact data.
 * {{first_name}}, {{last_name}}, {{email}}, {{company_name}}, {{custom.field_name}}
 */
export function renderMergeTags(html: string, contact: Record<string, unknown>): string {
  return html.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, tag: string) => {
    if (tag === 'preferences_url') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return `${frontendUrl}/preferences/${contact.preferences_token || ''}`;
    }
    if (tag.startsWith('custom.')) {
      const fieldName = tag.substring(7);
      const customFields = (contact.custom_fields || {}) as Record<string, unknown>;
      return String(customFields[fieldName] ?? '');
    }
    return String(contact[tag] ?? '');
  });
}
