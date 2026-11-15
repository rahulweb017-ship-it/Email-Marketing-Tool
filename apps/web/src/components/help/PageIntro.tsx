import { AnimatePresence, motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { matchHelp, useHelpStore } from './helpData';

export default function PageIntro({ pathname }: { pathname: string }) {
  const { tipsOn, dismissed, dismiss } = useHelpStore();
  const match = matchHelp(pathname);
  const show = !!match && tipsOn && !dismissed.includes(match.key);

  return (
    <AnimatePresence initial={false}>
      {show && match && (
        <motion.div
          key={match.key}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="mb-6 flex gap-3 rounded-xl border border-primary-100 bg-gradient-to-r from-primary-50 to-white p-4 dark:border-primary-900/40 dark:from-primary-950/40 dark:to-gray-900">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">What is {match.help.title}?</p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{match.help.summary}</p>
              {match.help.steps && (
                <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {match.help.steps.map((s, i) => (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <button
              onClick={() => dismiss(match.key)}
              className="self-start rounded-md p-1 text-gray-400 hover:bg-white hover:text-gray-600 dark:hover:bg-gray-800"
              title="Got it, hide this tip"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
