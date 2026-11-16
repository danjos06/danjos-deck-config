import { useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { actionSummary } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { KeyCap } from './KeyCap';
import { handleKeyClick, isKeySelected } from './keySelection';

const variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 60 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -60 }),
};

/** 3x2 key grid for the current page, animated on page change. */
export function KeyGrid() {
  const pages = useDeckStore((s) => s.config.pages);
  const swapKeys = useDeckStore((s) => s.swapKeys);
  const currentId = useUiStore((s) => s.currentPageId);
  const dir = useUiStore((s) => s.navDirection);
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);

  const page = pages.find((p) => p.id === currentId);
  const onSwap = useCallback(
    (from: number, to: number) => {
      if (!page) return;
      swapKeys(page.id, from, to);
      select({ kind: 'key', index: to });
    },
    [page, swapKeys, select],
  );

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        {page && (
          <motion.div
            key={page.id}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-3 gap-x-5 gap-y-4"
          >
            {page.keys.map((k, i) => (
              <KeyCap
                key={k.id}
                index={i}
                bitmap={k.bitmap}
                name={k.name}
                summary={actionSummary(k.action, pages)}
                selected={isKeySelected(selection, i)}
                onSelect={handleKeyClick}
                onSwap={onSwap}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
