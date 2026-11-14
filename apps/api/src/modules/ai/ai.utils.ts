// Pure helpers for the AI module: credit costs and the email renderer. Kept free of I/O so they can be unit tested.

export const AI_CREDIT_COSTS = {
  email_write: 5,
  email_rewrite: 1,
  subject_lines: 2,
  social_write: 2,
  whatsapp_compose: 1,
  whatsapp_suggest: 1,
  whatsapp_auto_reply: 1,
  whatsapp_test: 1,
} as const;

export type AiFeature = keyof typeof AI_CREDIT_COSTS;

export function aiPeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export type EmailSection =
  | { type: 'hero'; heading: string; text: string }
  | { type: 'text'; heading: string; paragraphs: string[] }
  | { type: 'bullets'; heading: string; items: string[] }
  | { type: 'button'; label: string; url: string }
  | { type: 'image'; alt: string };

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Only http(s), mailto and tel links, or a merge tag, ever reach the email. */
export function safeUrl(url: string | undefined): string {
  const value = (url || '').trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(value) || /^\{\{[\w.]+\}\}$/.test(value)) return value;
  return '#';
}

const FONT = 'font-family: Arial, Helvetica, sans-serif;';

function row(inner: string, padding = '12px 32px'): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding: ${padding};">${inner}</td></tr></table>`;
}

function heading(text: string, size = 22): string {
  return text ? `<h2 style="${FONT} margin: 0 0 12px; font-size: ${size}px; line-height: 1.3; color: #111827;">${escapeHtml(text)}</h2>` : '';
}

function paragraph(text: string): string {
  return `<p style="${FONT} margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #374151;">${escapeHtml(text)}</p>`;
}

export function renderSection(section: EmailSection, accent = '#4f46e5'): string {
  switch (section.type) {
    case 'hero':
      return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td style="padding: 40px 32px; background-color: ${accent}; text-align: center;"><h1 style="${FONT} margin: 0 0 12px; font-size: 30px; line-height: 1.25; color: #ffffff;">${escapeHtml(section.heading)}</h1><p style="${FONT} margin: 0; font-size: 17px; line-height: 1.6; color: #e0e7ff;">${escapeHtml(section.text)}</p></td></tr></table>`;
    case 'text':
      return row(heading(section.heading) + section.paragraphs.map(paragraph).join(''));
    case 'bullets':
      return row(heading(section.heading, 18) + `<ul style="${FONT} margin: 0; padding-left: 20px; font-size: 16px; line-height: 1.6; color: #374151;">${section.items.map((i) => `<li style="margin-bottom: 6px;">${escapeHtml(i)}</li>`).join('')}</ul>`);
    case 'button':
      return row(`<div style="text-align: center;"><a href="${escapeHtml(safeUrl(section.url))}" style="display: inline-block; background-color: ${accent}; color: #ffffff; ${FONT} font-size: 16px; font-weight: bold; padding: 14px 32px; border-radius: 6px; text-decoration: none;">${escapeHtml(section.label)}</a></div>`, '20px 32px');
    case 'image':
      return row(`<img src="https://placehold.co/600x300/e0e7ff/4f46e5?text=Your+image" alt="${escapeHtml(section.alt)}" width="536" style="display: block; width: 100%; max-width: 536px; height: auto; border: 0; border-radius: 8px;" />`);
  }
}

export function renderEmailHtml(sections: EmailSection[], footer: string, accent = '#4f46e5'): string {
  const body = sections.map((s) => renderSection(s, accent)).join('');
  const foot = row(`<p style="${FONT} margin: 0; font-size: 12px; line-height: 1.5; color: #9ca3af; text-align: center;">${escapeHtml(footer)}<br /><a href="{{unsubscribe_url}}" style="color: #9ca3af;">Unsubscribe</a></p>`, '24px 32px');
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f3f4f6;"><tr><td align="center" style="padding: 24px 12px;"><table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;"><tr><td>${body}${foot}</td></tr></table></td></tr></table>`;
}

/** Rough plain text from HTML, used to give the AI context about an existing email. */
export function htmlToText(html: string, max = 6000): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
