import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Undo2, Redo2, CheckCircle, Circle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import grapesjs, { type Editor } from 'grapesjs';
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
          plugins: [newsletterPreset],
          pluginsOpts: {
            [newsletterPreset as unknown as string]: {
              modalTitleImport: 'Import HTML',
              importPlaceholder: '<table>...</table>',
            },
          },
          storageManager: false,
          height: '100%',
          width: 'auto',
          deviceManager: {
            devices: [
              { name: 'Desktop', width: '' },
              { name: 'Mobile', width: '375px', widthMedia: '480px' },
            ],
          },
          blockManager: {
            appendTo: '.gjs-blocks-c',
            blocks: [
              {
                id: 'header-block',
                label: 'Header',
                category: 'Email Sections',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="2" y="4" width="20" height="6" rx="1" fill="#4f46e5" opacity="0.2"/><rect x="6" y="6" width="12" height="2" rx="0.5" fill="#4f46e5"/></svg>',
                attributes: { title: 'Email header with company name' },
                content: `<table width="100%" style="background-color: #4f46e5; padding: 20px;">
                  <tr><td style="text-align: center; color: white; font-size: 24px; font-weight: bold;">Your Company</td></tr>
                </table>`,
              },
              {
                id: 'hero-block',
                label: 'Hero',
                category: 'Email Sections',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="2" y="2" width="20" height="20" rx="2" fill="#4f46e5" opacity="0.1"/><rect x="5" y="6" width="14" height="2" rx="0.5" fill="#4f46e5"/><rect x="7" y="10" width="10" height="1.5" rx="0.5" fill="#4f46e5" opacity="0.4"/><rect x="8" y="14" width="8" height="3" rx="1.5" fill="#4f46e5"/></svg>',
                attributes: { title: 'Hero section with headline, text and CTA button' },
                content: `<table width="100%" style="padding: 40px 20px; text-align: center;">
                  <tr><td><h1 style="font-size: 28px; margin-bottom: 16px;">Main Headline</h1>
                  <p style="color: #6b7280; font-size: 16px; margin-bottom: 24px;">Supporting text for your email campaign</p>
                  <a href="#" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Call to Action</a></td></tr>
                </table>`,
              },
              {
                id: 'text-block',
                label: 'Text Block',
                category: 'Content',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="4" y="5" width="16" height="1.5" rx="0.5" fill="#6b7280"/><rect x="4" y="9" width="14" height="1.5" rx="0.5" fill="#6b7280" opacity="0.6"/><rect x="4" y="13" width="16" height="1.5" rx="0.5" fill="#6b7280" opacity="0.6"/><rect x="4" y="17" width="10" height="1.5" rx="0.5" fill="#6b7280" opacity="0.4"/></svg>',
                attributes: { title: 'Simple text paragraph' },
                content: `<table width="100%" style="padding: 20px;">
                  <tr><td style="color: #374151; font-size: 15px; line-height: 1.6;">Write your content here. Click to edit this text and replace it with your own message.</td></tr>
                </table>`,
              },
              {
                id: 'image-block',
                label: 'Image',
                category: 'Content',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="3" y="4" width="18" height="16" rx="2" fill="#e5e7eb"/><circle cx="8" cy="9" r="2" fill="#9ca3af"/><path d="M3 16l5-5 3 3 4-4 6 6v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2z" fill="#9ca3af" opacity="0.5"/></svg>',
                attributes: { title: 'Image placeholder' },
                content: `<table width="100%" style="padding: 20px; text-align: center;">
                  <tr><td><img src="https://placehold.co/560x200/e5e7eb/9ca3af?text=Your+Image" alt="Placeholder" style="max-width: 100%; border-radius: 8px;" /></td></tr>
                </table>`,
              },
              {
                id: 'two-column',
                label: '2 Columns',
                category: 'Layout',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="2" y="4" width="9" height="16" rx="1" fill="#4f46e5" opacity="0.2"/><rect x="13" y="4" width="9" height="16" rx="1" fill="#4f46e5" opacity="0.2"/></svg>',
                attributes: { title: 'Two-column layout' },
                content: `<table width="100%" style="padding: 20px;">
                  <tr>
                    <td width="50%" style="padding: 10px; vertical-align: top;"><h3>Column 1</h3><p style="color: #6b7280;">Content here</p></td>
                    <td width="50%" style="padding: 10px; vertical-align: top;"><h3>Column 2</h3><p style="color: #6b7280;">Content here</p></td>
                  </tr>
                </table>`,
              },
              {
                id: 'button-block',
                label: 'Button',
                category: 'Content',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="4" y="8" width="16" height="8" rx="4" fill="#4f46e5"/><rect x="8" y="11" width="8" height="2" rx="1" fill="white"/></svg>',
                attributes: { title: 'Call-to-action button' },
                content: `<table width="100%" style="padding: 20px; text-align: center;">
                  <tr><td><a href="#" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Click Here</a></td></tr>
                </table>`,
              },
              {
                id: 'divider-block',
                label: 'Divider',
                category: 'Layout',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="4" y="11" width="16" height="2" rx="1" fill="#e5e7eb"/></svg>',
                attributes: { title: 'Horizontal divider line' },
                content: `<table width="100%" style="padding: 10px 20px;">
                  <tr><td><hr style="border: none; border-top: 1px solid #e5e7eb;" /></td></tr>
                </table>`,
              },
              {
                id: 'social-block',
                label: 'Social Links',
                category: 'Social',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><circle cx="6" cy="12" r="3" fill="#4f46e5" opacity="0.3"/><circle cx="12" cy="12" r="3" fill="#4f46e5" opacity="0.5"/><circle cx="18" cy="12" r="3" fill="#4f46e5" opacity="0.7"/></svg>',
                attributes: { title: 'Social media links' },
                content: `<table width="100%" style="padding: 20px; text-align: center;">
                  <tr><td>
                    <a href="#" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">Facebook</a>
                    <a href="#" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">Twitter</a>
                    <a href="#" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">LinkedIn</a>
                    <a href="#" style="color: #4f46e5; text-decoration: none; margin: 0 8px;">Instagram</a>
                  </td></tr>
                </table>`,
              },
              {
                id: 'footer-block',
                label: 'Footer',
                category: 'Email Sections',
                media: '<svg viewBox="0 0 24 24" width="40" height="40"><rect x="2" y="14" width="20" height="6" rx="1" fill="#6b7280" opacity="0.2"/><rect x="6" y="16" width="12" height="1" rx="0.5" fill="#6b7280" opacity="0.4"/><rect x="8" y="18" width="8" height="1" rx="0.5" fill="#6b7280" opacity="0.3"/></svg>',
                attributes: { title: 'Email footer with unsubscribe link' },
                content: `<table width="100%" style="background-color: #f3f4f6; padding: 20px; text-align: center;">
                  <tr><td>
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">Your Company Name, 123 Street, City</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;"><a href="{{unsubscribe_url}}" style="color: #4f46e5;">Unsubscribe</a> | <a href="#" style="color: #4f46e5;">View in browser</a></p>
                  </td></tr>
                </table>`,
              },
            ],
          },
        });

        // Load existing content
        const hasDesign = data.body_design && Object.keys(data.body_design).length > 0;
        const hasHtml = data.body_html && data.body_html.trim().length > 0;

        if (hasDesign) {
          editor.loadProjectData(data.body_design);
        } else if (hasHtml) {
          editor.setComponents(data.body_html);
        }

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

      {/* Save celebration */}
      <SaveCelebration show={showCelebration} onDone={() => setShowCelebration(false)} />
    </div>
  );
}
