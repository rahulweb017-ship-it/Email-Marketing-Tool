import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';

const STORAGE_KEY = 'mailforge_editor_onboarding_done';

interface Step {
  title: string;
  description: string;
  targetSelector: string;
  position: 'right' | 'left' | 'bottom';
}

const steps: Step[] = [
  {
    title: 'Welcome to the Editor!',
    description: 'This is your drag-and-drop email builder. Let us show you around.',
    targetSelector: '.gjs-cv-canvas',
    position: 'right',
  },
  {
    title: 'Content Blocks',
    description: 'Drag these building blocks onto the canvas to create your email layout.',
    targetSelector: '.gjs-blocks-c',
    position: 'left',
  },
  {
    title: 'The Canvas',
    description: 'This is where your email comes to life. Click any element to edit it.',
    targetSelector: '.gjs-cv-canvas',
    position: 'right',
  },
  {
    title: 'Style & Settings',
    description: 'Select any element then use the panels here to change colors, fonts, and spacing.',
    targetSelector: '.gjs-pn-views-container',
    position: 'left',
  },
];

interface EditorOnboardingProps {
  onComplete: () => void;
}

export default function EditorOnboarding({ onComplete }: EditorOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      onComplete();
      return;
    }
    // Small delay to let editor render
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
    onComplete();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSkip();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  if (!visible) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="absolute z-50 bg-white rounded-xl shadow-2xl p-5 w-80"
          style={getTooltipPosition(step)}
        >
          <button onClick={handleSkip} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>

          <div className="mb-1 text-xs text-primary-600 font-medium">
            Step {currentStep + 1} of {steps.length}
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
          <p className="text-sm text-gray-500 mb-4">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-4 bg-primary-600' : 'w-1.5 bg-gray-200'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <button onClick={handlePrev} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
              >
                {currentStep < steps.length - 1 ? (
                  <>Next <ChevronRight className="h-3.5 w-3.5" /></>
                ) : 'Got it!'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function getTooltipPosition(step: Step): React.CSSProperties {
  const el = document.querySelector(step.targetSelector);
  if (!el) {
    // Fallback to center
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
  const rect = el.getBoundingClientRect();
  switch (step.position) {
    case 'right':
      return { top: rect.top + rect.height / 2 - 80, left: rect.right + 16 };
    case 'left':
      return { top: rect.top + rect.height / 2 - 80, left: rect.left - 336 };
    case 'bottom':
      return { top: rect.bottom + 16, left: rect.left + rect.width / 2 - 160 };
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
}
