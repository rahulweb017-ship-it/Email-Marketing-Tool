import type { Editor, Component } from 'grapesjs';

/**
 * Text placed directly inside a <td> becomes a non-editable textnode in GrapesJS,
 * so every block keeps its words inside <div>/<p>/<h*>/<a> elements.
 */
const PLACEHOLDER_IMG = 'https://placehold.co/600x260/e5e7eb/6b7280?text=Double-click+to+add+image';
const PLACEHOLDER_THUMB = 'https://placehold.co/600x340/1f2937/f9fafb?text=%E2%96%B6+Video+thumbnail';

const icon = (svg: string) => `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><g fill="none">${svg}</g></svg>`;

export const MEDIA_BLOCK_IDS = new Set(['image-block', 'image-text-block', 'video-block']);

export const emailBlocks = [
  {
    id: 'heading-block',
    label: 'Heading',
    category: 'Basic',
    media: icon('<path d="M6 4v16M18 4v16M6 12h12"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 24px;"><tr><td>
      <h2 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; color: #111827;">Your heading here</h2>
    </td></tr></table>`,
  },
  {
    id: 'text-block',
    label: 'Text',
    category: 'Basic',
    media: icon('<path d="M4 6h16M4 10h16M4 14h12M4 18h8"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 12px 24px;"><tr><td>
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #374151;">Write your message here. Double-click this text to edit it.</p>
    </td></tr></table>`,
  },
  {
    id: 'image-block',
    label: 'Image',
    category: 'Basic',
    media: icon('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 12px 24px;"><tr><td align="center">
      <img src="${PLACEHOLDER_IMG}" alt="Image" width="552" style="display: block; width: 100%; max-width: 552px; height: auto; border: 0; border-radius: 8px;" />
    </td></tr></table>`,
  },
  {
    id: 'button-block',
    label: 'Button',
    category: 'Basic',
    media: icon('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M9 12h6"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 24px;"><tr><td align="center">
      <a href="https://example.com" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 12px 28px; border-radius: 6px; text-decoration: none;">Click here</a>
    </td></tr></table>`,
  },
  {
    id: 'divider-block',
    label: 'Divider',
    category: 'Basic',
    media: icon('<path d="M3 12h18"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 8px 24px;"><tr><td style="border-top: 1px solid #e5e7eb; font-size: 0; line-height: 0; height: 1px;">&nbsp;</td></tr></table>`,
  },
  {
    id: 'spacer-block',
    label: 'Spacer',
    category: 'Basic',
    media: icon('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height: 32px; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>`,
  },
  {
    id: 'header-block',
    label: 'Header',
    category: 'Sections',
    media: icon('<rect x="3" y="4" width="18" height="6" rx="1"/><path d="M7 7h10"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #4f46e5;"><tr><td align="center" style="padding: 20px 24px;">
      <div style="font-family: Arial, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff;">Your Company</div>
    </td></tr></table>`,
  },
  {
    id: 'hero-block',
    label: 'Hero',
    category: 'Sections',
    media: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M9 12h6"/><rect x="9" y="15" width="6" height="3" rx="1.5"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 24px; text-align: center;"><tr><td align="center">
      <h1 style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 30px; color: #111827;">Main headline</h1>
      <p style="margin: 0 0 24px; font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #6b7280;">A short line that explains why the reader should care.</p>
      <a href="https://example.com" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 12px 28px; border-radius: 6px; text-decoration: none;">Call to action</a>
    </td></tr></table>`,
  },
  {
    id: 'image-text-block',
    label: 'Image + Text',
    category: 'Sections',
    media: icon('<rect x="3" y="6" width="8" height="12" rx="1"/><path d="M14 8h7M14 12h7M14 16h4"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 24px;"><tr>
      <td width="45%" valign="top" style="padding-right: 12px;"><img src="${PLACEHOLDER_IMG}" alt="Image" width="250" style="display: block; width: 100%; height: auto; border: 0; border-radius: 8px;" /></td>
      <td width="55%" valign="top" style="padding-left: 12px;">
        <h3 style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 18px; color: #111827;">Feature title</h3>
        <p style="margin: 0 0 12px; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #4b5563;">Describe the product, offer or story next to the picture.</p>
        <a href="https://example.com" style="font-family: Arial, sans-serif; font-size: 14px; font-weight: bold; color: #4f46e5;">Learn more &rarr;</a>
      </td>
    </tr></table>`,
  },
  {
    id: 'video-block',
    label: 'Video',
    category: 'Sections',
    media: icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>'),
    // Email clients cannot play video, so this is a clickable thumbnail that opens the video link
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 12px 24px;"><tr><td align="center">
      <a href="https://www.youtube.com/" style="display: block;"><img src="${PLACEHOLDER_THUMB}" alt="Watch the video" width="552" style="display: block; width: 100%; max-width: 552px; height: auto; border: 0; border-radius: 8px;" /></a>
      <p style="margin: 8px 0 0; font-family: Arial, sans-serif; font-size: 13px; color: #6b7280;">Click the picture to watch the video</p>
    </td></tr></table>`,
  },
  {
    id: 'two-column',
    label: '2 Columns',
    category: 'Sections',
    media: icon('<rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 24px;"><tr>
      <td width="50%" valign="top" style="padding-right: 10px;">
        <h3 style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 17px; color: #111827;">Column 1</h3>
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #4b5563;">Content for the first column.</p>
      </td>
      <td width="50%" valign="top" style="padding-left: 10px;">
        <h3 style="margin: 0 0 8px; font-family: Arial, sans-serif; font-size: 17px; color: #111827;">Column 2</h3>
        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #4b5563;">Content for the second column.</p>
      </td>
    </tr></table>`,
  },
  {
    id: 'social-block',
    label: 'Social Links',
    category: 'Sections',
    media: icon('<circle cx="6" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 24px;"><tr><td align="center">
      <div style="font-family: Arial, sans-serif; font-size: 14px;">
        <a href="https://facebook.com" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">Facebook</a>
        <a href="https://instagram.com" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">Instagram</a>
        <a href="https://linkedin.com" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">LinkedIn</a>
        <a href="https://x.com" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">X</a>
      </div>
    </td></tr></table>`,
  },
  {
    id: 'footer-block',
    label: 'Footer',
    category: 'Sections',
    media: icon('<rect x="3" y="14" width="18" height="6" rx="1"/><path d="M7 17h10"/>'),
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6;"><tr><td align="center" style="padding: 20px 24px;">
      <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280;">Your Company Name, 123 Street, City</p>
      <p style="margin: 8px 0 0; font-family: Arial, sans-serif; font-size: 12px; color: #6b7280;"><a href="{{unsubscribe_url}}" style="color: #4f46e5;">Unsubscribe</a></p>
    </td></tr></table>`,
  },
];

const INLINE_TAGS = new Set(['a', 'span', 'b', 'strong', 'i', 'em', 'u', 'br', 'font', 'small', 'sup', 'sub', 'strike', 's']);

function isInline(c: Component) {
  if (c.get('type') === 'textnode') return true;
  if (c.get('type') === 'image') return false;
  return INLINE_TAGS.has(String(c.get('tagName') || '').toLowerCase());
}

/**
 * Older templates put text straight into table cells, which GrapesJS cannot edit.
 * Wrap each run of loose text (and inline tags around it) in an editable <div>.
 */
export function makeCellTextEditable(root: Component) {
  const cells: Component[] = [];
  const walk = (c: Component) => {
    const tag = String(c.get('tagName') || '').toLowerCase();
    if (tag === 'td' || tag === 'th') cells.push(c);
    c.components().forEach(walk);
  };
  walk(root);

  let changed = 0;
  for (const cell of cells) {
    const children = cell.components();
    let run: Component[] = [];
    const flush = () => {
      const hasText = run.some((c) => c.get('type') === 'textnode' && String(c.get('content') || '').trim());
      if (hasText) {
        const at = children.indexOf(run[0]);
        const html = run.map((c) => c.toHTML()).join('');
        run.forEach((c) => c.remove());
        children.add(`<div>${html}</div>`, { at });
        changed++;
      }
      run = [];
    };
    for (const child of [...children.models]) {
      if (isInline(child)) run.push(child);
      else flush();
    }
    flush();
  }
  return changed;
}

export function makeEditorTextEditable(editor: Editor) {
  const wrapper = editor.getWrapper();
  return wrapper ? makeCellTextEditable(wrapper) : 0;
}
