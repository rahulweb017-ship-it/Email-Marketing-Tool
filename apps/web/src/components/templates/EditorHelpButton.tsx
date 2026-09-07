import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, RotateCcw, Keyboard, Lightbulb, X } from 'lucide-react';

interface EditorHelpButtonProps {
  onRestartTour: () => void;
}

export default function EditorHelpButton({ onRestartTour }: EditorHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-14 right-0 w-64 bg-white rounded-xl shadow-xl border p-4 mb-2"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Help</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { onRestartTour(); setOpen(false); }}
                className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-gray-50 text-left text-sm"
              >
                <RotateCcw className="h-4 w-4 text-primary-500" />
                <span>Restart Tour</span>
              </button>
              <div className="p-2">
                <div className="flex items-center gap-2.5 mb-2">
                  <Keyboard className="h-4 w-4 text-primary-500" />
                  <span className="text-sm font-medium">Shortcuts</span>
                </div>
                <div className="space-y-1 text-xs text-gray-500 pl-6">
                  <div className="flex justify-between"><span>Undo</span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Ctrl+Z</kbd></div>
                  <div className="flex justify-between"><span>Redo</span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Ctrl+Y</kbd></div>
                  <div className="flex justify-between"><span>Save</span><kbd className="bg-gray-100 px-1.5 py-0.5 rounded">Ctrl+S</kbd></div>
                </div>
              </div>
              <div className="p-2">
                <div className="flex items-center gap-2.5 mb-1">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Tips</span>
                </div>
                <p className="text-xs text-gray-500 pl-6">Drag blocks from the left panel onto the canvas. Click any element to edit it.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 1 }}
        onClick={() => setOpen(!open)}
        className="p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
      >
        <HelpCircle className="h-5 w-5" />
      </motion.button>
    </div>
  );
}
