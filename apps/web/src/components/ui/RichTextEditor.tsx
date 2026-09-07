import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';

// TextStyle extended to also carry font-size (no first-party FontSize in TipTap v3)
const TextStyleWithFontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]+/g, '') || null,
        renderHTML: (attrs: { fontSize?: string | null }) =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
    };
  },
});

// Strip script/expression payloads from a CSS style string, leave the rest alone.
function safeStyle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/-moz-binding\s*:/gi, '')
    .trim();
  return cleaned || null;
}

// Build a node attribute spec that preserves a single inline HTML attribute round-trip.
function preservedAttr(name: string, sanitize?: (v: string) => string | null) {
  return {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const v = el.getAttribute(name);
      if (v == null) return null;
      return sanitize ? sanitize(v) : v;
    },
    renderHTML: (attrs: Record<string, unknown>) => {
      const v = attrs[name];
      return v ? { [name]: v } : {};
    },
  };
}

// Add `style` (sanitised) as a global attribute on block nodes so pasted Word/Docs
// paragraph/heading/list styling round-trips. ProseMirror schema otherwise drops it.
const PreserveBlockStyles = Extension.create({
  name: 'preserveBlockStyles',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList'],
        attributes: {
          style: {
            default: null,
            parseHTML: (el: HTMLElement) => safeStyle(el.getAttribute('style')),
            renderHTML: (attrs: { style?: string | null }) => (attrs.style ? { style: attrs.style } : {}),
          },
        },
      },
    ];
  },
});

// Preserve common inline-HTML/email attributes that TipTap's defaults drop.
// These attributes round-trip through paste → save → send so that pasted
// Word/Excel/Docs tables retain their cell colours, borders, alignment, etc.
function preservedAttrs(extras: string[] = []) {
  const base: Record<string, ReturnType<typeof preservedAttr>> = {
    style: preservedAttr('style', safeStyle),
  };
  for (const name of extras) base[name] = preservedAttr(name);
  return base;
}

// Strip MS Word / Office noise before ProseMirror parses, leaving real HTML
// and inline styles intact so pasted formatting survives.
function sanitizePastedHTML(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?\[endif\]-->/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?(o|w|v|m|st\d?):[^>]*>/gi, '')
    .replace(/style="([^"]*)"/gi, (_m, css: string) =>
      `style="${css.split(';').filter((d) => !/^\s*mso-/i.test(d)).join(';')}"`)
    .replace(/\sclass="Mso[^"]*"/gi, '');
}
import { useEffect, useCallback, useState, useRef } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon, Minus,
  Undo2, Redo2, Palette, Type,
} from 'lucide-react';
import clsx from 'clsx';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({ active, onClick, title, children, disabled }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded-md transition-colors',
        active ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
        disabled && 'opacity-30 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-gray-200 mx-0.5" />;
}

export default function RichTextEditor({ value, onChange, placeholder = 'Start writing your email...', minHeight = 280 }: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Image.configure({
        HTMLAttributes: { style: 'max-width: 100%; height: auto;' },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph', 'tableCell', 'tableHeader'],
      }),
      TextStyleWithFontSize,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Table.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            ...preservedAttrs(['width', 'border', 'cellpadding', 'cellspacing']),
          };
        },
      }).configure({
        resizable: true,
        HTMLAttributes: { style: 'border-collapse: collapse; width: 100%;' },
      }),
      TableRow.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            ...preservedAttrs(['bgcolor', 'align', 'valign']),
          };
        },
      }),
      TableHeader.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            ...preservedAttrs(['bgcolor', 'align', 'valign', 'width']),
          };
        },
      }).configure({
        HTMLAttributes: { style: 'border:1px solid #d1d5db;padding:6px 8px;background:#f3f4f6;' },
      }),
      TableCell.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            ...preservedAttrs(['bgcolor', 'align', 'valign', 'width']),
          };
        },
      }).configure({
        HTMLAttributes: { style: 'border:1px solid #d1d5db;padding:6px 8px;vertical-align:top;' },
      }),
      Placeholder.configure({ placeholder }),
      PreserveBlockStyles,
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}px`,
      },
      transformPastedHTML: sanitizePastedHTML,
    },
  });

  // Sync external value changes (e.g. when a template is selected)
  const lastExternalValue = useRef(value);
  useEffect(() => {
    if (editor && value !== lastExternalValue.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
      lastExternalValue.current = value;
    }
  }, [editor, value]);

  // Keep ref in sync on every onChange
  useEffect(() => {
    if (editor) {
      const handler = () => { lastExternalValue.current = editor.getHTML(); };
      editor.on('update', handler);
      return () => { editor.off('update', handler); };
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  useEffect(() => {
    if (showLinkInput && linkInputRef.current) {
      linkInputRef.current.focus();
    }
  }, [showLinkInput]);

  if (!editor) return null;

  const colors = [
    '#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308',
    '#22c55e', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  ];

  const iconSize = 'h-3.5 w-3.5';

  return (
    <div className="border rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b px-2 py-1.5 flex flex-wrap items-center gap-0.5">
        {/* Undo / Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
          <Undo2 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
          <Redo2 className={iconSize} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1">
          <Heading1 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          <Heading2 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          <Heading3 className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Normal text">
          <Type className={iconSize} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Inline formatting */}
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)">
          <Bold className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)">
          <Italic className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)">
          <UnderlineIcon className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough className={iconSize} />
        </ToolbarButton>

        {/* Text color */}
        <div className="relative">
          <ToolbarButton onClick={() => setShowColorPicker(!showColorPicker)} title="Text color">
            <Palette className={iconSize} />
          </ToolbarButton>
          {showColorPicker && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
              <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border p-2 grid grid-cols-6 gap-1 w-36">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                    className="w-5 h-5 rounded-full border border-gray-200 hover:scale-125 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                  className="col-span-6 text-xs text-gray-500 hover:text-gray-700 mt-1"
                >
                  Reset color
                </button>
              </div>
            </>
          )}
        </div>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left">
          <AlignLeft className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center">
          <AlignCenter className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right">
          <AlignRight className={iconSize} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list">
          <ListOrdered className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className={iconSize} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton active={editor.isActive('link')} onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
          } else {
            setLinkUrl(editor.getAttributes('link').href || '');
            setShowLinkInput(true);
          }
        }} title="Insert link">
          <LinkIcon className={iconSize} />
        </ToolbarButton>

        {/* Image */}
        <ToolbarButton onClick={addImage} title="Insert image">
          <ImageIcon className={iconSize} />
        </ToolbarButton>

        {/* Horizontal rule */}
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal line">
          <Minus className={iconSize} />
        </ToolbarButton>
      </div>

      {/* Link input popover */}
      {showLinkInput && (
        <div className="bg-gray-50 border-b px-3 py-2 flex items-center gap-2">
          <LinkIcon className="h-3.5 w-3.5 text-gray-400" />
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } if (e.key === 'Escape') setShowLinkInput(false); }}
            placeholder="https://example.com"
            className="flex-1 text-sm bg-white border rounded px-2 py-1 focus:ring-1 focus:ring-primary-500 focus:outline-none"
          />
          <button type="button" onClick={addLink} className="px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700">
            Apply
          </button>
          <button type="button" onClick={() => setShowLinkInput(false)} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
