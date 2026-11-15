import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Undo2, Redo2, CheckCircle, Circle, ImagePlus, Sparkles } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import grapesjs, { type Editor, type Component } from 'grapesjs';
import newsletterPreset from 'grapesjs-preset-newsletter';
import 'grapesjs/dist/css/grapes.min.css';
import '../styles/grapesjs-overrides.css';
import { ButtonSpinner } from '../components/ui/Spinner';
import { PageLoader } from '../components/ui/Spinner';
import { useToastStore } from '../stores/toast.store';
import api from '../api/client';
import TemplateGallery from '../components/templates/TemplateGallery';
import EditorOnboarding from '../components/templates/EditorOnboarding';
import DragHint from '../components/templates/DragHint';
import EditorHelpButton from '../components/templates/EditorHelpButton';
import SaveCelebration from '../components/templates/SaveCelebration';
import MediaLibraryModal from '../components/media/MediaLibraryModal';
import AiEmailWriterModal from '../components/ai/AiEmailWriterModal';
import type { MediaAsset } from '../api/media';
import { emailBlocks, MEDIA_BLOCK_IDS, makeCellTextEditable, makeEditorTextEditable } from '../components/templates/editorBlocks';

interface AssetPickerProps {
  select: (asset: string, complete?: boolean) => void;
}

type PickedMedia = Pick<MediaAsset, 'url' | 'name' | 'kind' | 'width' | 'height'>;

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function mediaSnippet(asset: PickedMedia) {
  const url = escapeAttr(asset.url);
  if (asset.kind === 'image') {
    const width = asset.width ? Math.min(asset.width, 552) : 552;
    return `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 12px 24px;"><tr><td align="center"><img src="${url}" alt="${escapeAttr(asset.name)}" width="${width}" style="display: block; width: 100%; max-width: ${width}px; height: auto; border: 0; border-radius: 8px;" /></td></tr></table>`;
  }
  const label = asset.kind === 'video' ? '&#9654; Watch the video' : 'Download PDF';
  return `<table width="100%" cellpadding="0" cellspacing="0" style="padding: 16px 24px;"><tr><td align="center"><a href="${url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-family: Arial, sans-serif; font-size: 15px; font-weight: bold; padding: 12px 28px; border-radius: 6px; text-decoration: none;">${label}</a></td></tr></table>`;
}

const ONBOARDING_KEY = 'mailforge_editor_onboarding_done';

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);
  const editorRef = useRef<Editor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Phase 4 state
  const [showGallery, setShowGallery] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasUndo, setHasUndo] = useState(false);
  const [hasRedo, setHasRedo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'idle'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const templateBodyRef = useRef<string>('');
  const [assetPicker, setAssetPicker] = useState<AssetPickerProps | null>(null);
  const [showMedia, setShowMedia] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiSelectedText, setAiSelectedText] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    if (!editorRef.current || !id) return;
    setSaving(true);
    try {
      const editor = editorRef.current;
      const body_html = editor.runCommand('gjs-get-inlined-html') || editor.getHtml();
      const body_design = editor.getProjectData();

      await api.patch(`/templates/${id}`, { body_html, body_design });
      setSaveStatus('saved');
      setShowCelebration(true);
    } catch {
      addToast('Failed to save template', 'error');
    } finally {
      setSaving(false);
    }
  }, [id, addToast]);

  // Keyboard shortcut: Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    if (!id || !containerRef.current) return;

    const loadTemplate = async () => {
      try {
        const { data } = await api.get(`/templates/${id}`);
        setTemplateName(data.name);
        templateBodyRef.current = data.body_html || '';

        // Initialize GrapesJS
        const editor = grapesjs.init({
          container: containerRef.current!,
          // The preset reads its options from its second argument; keying pluginsOpts by the function never applied them
          plugins: [
            (ed: Editor) => newsletterPreset(ed, {
              modalTitleImport: 'Import HTML',
              importPlaceholder: '<table>...</table>',
              blocks: ['sect100', 'sect50', 'sect30', 'sect37', 'grid-items', 'list-items', 'quote'],
              block: () => ({ category: 'Layouts' }),
              useCustomTheme: false,
              showBlocksOnLoad: true,
              showStylesOnChange: true,
            }),
          ],
          storageManager: false,
          height: '100%',
          width: 'auto',
          deviceManager: {
            devices: [
              { name: 'Desktop', width: '' },
              { name: 'Mobile', width: '375px', widthMedia: '480px' },
            ],
          },
          assetManager: {
            custom: {
              open: (props: AssetPickerProps) => setAssetPicker({ select: props.select }),
              close: () => setAssetPicker(null),
            },
          },
          blockManager: { blocks: emailBlocks },
          // Style the clicked element itself rather than every element sharing its CSS class
          selectorManager: { componentFirst: true },
        });

        editor.on('block:drag:stop', (dropped: Component | Component[] | undefined, block?: { getId?: () => string }) => {
          const comps = (Array.isArray(dropped) ? dropped : [dropped]).filter(Boolean) as Component[];
          if (!comps.length) return;
          comps.forEach((c) => makeCellTextEditable(c));
          if (block?.getId && MEDIA_BLOCK_IDS.has(block.getId())) {
            const img = comps[0].get('type') === 'image' ? comps[0] : comps[0].find('img')[0];
            if (img) {
              editor.select(img);
              editor.AssetManager.open({
                target: img,
                types: ['image'],
                select: (asset: { getSrc: () => string }, complete?: boolean) => {
                  img.set({ src: asset.getSrc() });
                  if (complete) editor.AssetManager.close();
                },
              });
            }
          }
        });

        editor.onReady(() => {
          const titles: Record<string, string> = {
            'open-sm': 'Style: colors, fonts, spacing',
            'open-tm': 'Settings: links, image alt text',
            'open-layers': 'Layers: page structure',
            'open-blocks': 'Blocks: drag content into your email',
          };
          Object.entries(titles).forEach(([btnId, title]) => {
            editor.Panels.getButton('views', btnId)?.set('attributes', { title, 'data-label': title.split(':')[0] });
          });
          editor.StyleManager.getSectors().forEach((sector: { setOpen: (open: boolean) => void }) => sector.setOpen(true));
        });
        // Load existing content
        const hasDesign = data.body_design && Object.keys(data.body_design).length > 0;
        const hasHtml = data.body_html && data.body_html.trim().length > 0;

        if (hasDesign) {
          editor.loadProjectData(data.body_design);
        } else if (hasHtml) {
          editor.setComponents(data.body_html);
        }
        if (makeEditorTextEditable(editor) > 0) editor.UndoManager.clear();

        // Track undo/redo availability
        const updateUndoRedo = () => {
          setHasUndo(editor.UndoManager.hasUndo());
          setHasRedo(editor.UndoManager.hasRedo());
        };

        // Track changes for auto-save indicator
        editor.on('change:changesCount', () => {
          setSaveStatus('unsaved');
          updateUndoRedo();

          // Debounced auto-save (30s)
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            handleSave();
          }, 30000);
        });

        editor.on('undo', updateUndoRedo);
        editor.on('redo', updateUndoRedo);

        editorRef.current = editor;
        setLoading(false);

        // Decide whether to show gallery or onboarding
        if (!hasDesign && !hasHtml) {
          setShowGallery(true);
        } else if (!localStorage.getItem(ONBOARDING_KEY)) {
          setShowOnboarding(true);
        } else {
          setOnboardingDone(true);
          setSaveStatus('saved');
        }
      } catch {
        addToast('Failed to load template', 'error');
        navigate('/templates');
      }
    };

    loadTemplate();

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
  }, [id, navigate, addToast, handleSave]);

  const handleGallerySelect = (html: string) => {
    if (editorRef.current && html) {
      editorRef.current.setComponents(html);
      makeEditorTextEditable(editorRef.current);
    }
    setShowGallery(false);
    // After gallery, show onboarding if first visit
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setTimeout(() => setShowOnboarding(true), 300);
    } else {
      setOnboardingDone(true);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setOnboardingDone(true);
  };

  const handleRestartTour = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setOnboardingDone(false);
    setShowOnboarding(true);
  };

  const handleInsertMedia = (asset: PickedMedia) => {
    setShowMedia(false);
    const editor = editorRef.current;
    if (!editor) return;
    const selected = editor.getSelected();
    if (asset.kind === 'image' && selected?.get('type') === 'image') {
      selected.set({ src: asset.url });
      return;
    }
    const wrapper = editor.getWrapper();
    if (!wrapper) return;
    // Insert next to the selection inside the same cell, so it stays within the email's content width
    let anchor: Component | undefined = selected;
    while (anchor) {
      const parent: Component | undefined = anchor.parent();
      const tag = String(parent?.get('tagName') || '').toLowerCase();
      if (!parent || parent === wrapper || tag === 'td' || tag === 'th') break;
      anchor = parent;
    }
    const target = anchor?.parent() ?? wrapper;
    const at = anchor ? target.components().indexOf(anchor) + 1 : target.components().length;
    const added = target.components().add(mediaSnippet(asset), { at });
    const first = Array.isArray(added) ? added[0] : added;
    if (first) editor.select(first);
  };

  const openAi = () => {
    const selected = editorRef.current?.getSelected();
    const text = selected?.get('type') === 'text' ? selected.getEl()?.innerText?.trim() : '';
    setAiSelectedText(text || null);
    setShowAi(true);
  };

  const handleAiInsert = async (html: string, mode: 'replace' | 'append', subject: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (mode === 'replace') editor.setComponents(html);
    else editor.getWrapper()?.append(html);
    makeEditorTextEditable(editor);
    setShowAi(false);
    setShowGallery(false);
    if (id && subject) {
      try { await api.patch(`/templates/${id}`, { subject }); } catch { /* the body is still inserted; subject is a convenience */ }
    }
    addToast('AI draft added. Click any text to edit it.', 'success');
  };

  const handleAiReplaceText = (text: string) => {
    const selected = editorRef.current?.getSelected();
    if (!selected) return;
    selected.components(escapeAttr(text).replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
    setShowAi(false);
  };

  const handleUndo = () => {
    editorRef.current?.UndoManager.undo();
  };

  const handleRedo = () => {
    editorRef.current?.UndoManager.redo();
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/templates')} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="font-semibold">{templateName || 'Template Editor'}</h1>
          <span className="hidden xl:inline text-xs text-gray-500">Drag blocks from the right panel. Double-click text to edit it, double-click an image to replace it.</span>

          {/* Save status indicator */}
          {saveStatus !== 'idle' && (
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saved' ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600">Saved</span>
                </>
              ) : (
                <>
                  <Circle className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-amber-600">Unsaved changes</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button
            onClick={handleUndo}
            disabled={!hasUndo}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!hasRedo}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <button
            onClick={openAi}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-rose-600 to-rose-600 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
            title="Write the whole email, or rewrite the selected text, with Rabbit AI"
          >
            <Sparkles className="h-4 w-4" /> Write with AI
          </button>

          <button
            onClick={() => setShowMedia(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            title="Upload images, videos or PDFs and add them to the email"
          >
            <ImagePlus className="h-4 w-4" /> Add media
          </button>

          <div className="h-6 w-px bg-gray-300" />

          {/* Save button */}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50">
            {saving ? <ButtonSpinner /> : <Save className="h-4 w-4" />}
            Save Template
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white z-10">
            <PageLoader />
          </div>
        )}
        <div ref={containerRef} className="h-full" />

        {/* Template Gallery overlay */}
        <AnimatePresence>
          {showGallery && (
            <TemplateGallery
              onSelect={handleGallerySelect}
              onClose={() => setShowGallery(false)}
            />
          )}
        </AnimatePresence>

        {/* Editor Onboarding tour */}
        {showOnboarding && (
          <EditorOnboarding onComplete={handleOnboardingComplete} />
        )}

        {/* Drag hint — shows after onboarding is complete */}
        {onboardingDone && <DragHint />}
      </div>

      {/* Floating help button */}
      {!loading && <EditorHelpButton onRestartTour={handleRestartTour} />}

      {/* Picker for image components (double-click an image, image blocks, background images) */}
      <MediaLibraryModal
        isOpen={!!assetPicker}
        kinds={['image']}
        title="Choose an image"
        onClose={() => editorRef.current?.AssetManager.close()}
        onSelect={(asset) => assetPicker?.select(asset.url, true)}
      />

      <MediaLibraryModal
        isOpen={showMedia}
        title="Add media to your email"
        onClose={() => setShowMedia(false)}
        onSelect={handleInsertMedia}
      />

      <AiEmailWriterModal
        isOpen={showAi}
        onClose={() => setShowAi(false)}
        selectedText={aiSelectedText}
        onInsert={handleAiInsert}
        onReplaceText={handleAiReplaceText}
      />

      {/* Save celebration */}
      <SaveCelebration show={showCelebration} onDone={() => setShowCelebration(false)} />
    </div>
  );
}
