import { describe, expect, it } from 'vitest';
import { AI_CREDIT_COSTS, aiPeriod, escapeHtml, htmlToText, renderEmailHtml, safeUrl } from './ai.utils.js';

describe('ai utils', () => {
  it('escapes AI text before it reaches HTML', () => {
    const html = renderEmailHtml([{ type: 'text', heading: '<script>x</script>', paragraphs: ['a & "b"'] }], 'Footer');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; &quot;b&quot;');
  });

  it('only allows safe button links', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl(' https://example.com/x ')).toBe('https://example.com/x');
    expect(safeUrl('{{unsubscribe_url}}')).toBe('{{unsubscribe_url}}');
    expect(safeUrl(undefined)).toBe('#');
    const html = renderEmailHtml([{ type: 'button', label: 'Go', url: 'javascript:alert(1)' }], '');
    expect(html).toContain('href="#"');
  });

  it('always includes an unsubscribe link', () => {
    expect(renderEmailHtml([], 'x')).toContain('{{unsubscribe_url}}');
  });

  it('formats the billing period and strips html', () => {
    expect(aiPeriod(new Date(2026, 0, 5))).toBe('2026-01');
    expect(htmlToText('<p>Hi&nbsp;<b>there</b></p><style>p{}</style>')).toBe('Hi there');
    expect(escapeHtml("'")).toBe('&#39;');
  });

  it('charges every feature at least one credit', () => {
    for (const cost of Object.values(AI_CREDIT_COSTS)) expect(cost).toBeGreaterThan(0);
  });
});
