import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand } from 'lucide-react';

const STORAGE_KEY = 'mailforge_drag_hint_shown';

export default function DragHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    const timer = setTimeout(() => {
      setVisible(true);
      sessionStorage.setItem(STORAGE_KEY, 'true');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            initial={{ x: -80, y: 0 }}
            animate={{ x: [- 80, 80], y: [0, -20, 0] }}
            transition={{ duration: 2, repeat: 1, ease: 'easeInOut' }}
            className="flex flex-col items-center"
          >
            <Hand className="h-8 w-8 text-primary-500 drop-shadow-lg" />
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-2 text-sm font-medium text-gray-600 bg-white/90 px-3 py-1 rounded-full shadow-sm"
            >
              Drag blocks to the canvas
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
