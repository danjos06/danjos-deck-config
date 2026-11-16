import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/ui/cn';

/** Matches the p-1 / -m-1 pair that keeps focus rings from being clipped. */
const PAD = 8;

interface PanelSwitchProps {
  /** Identity of the visible panel; changing it fades the new content in. */
  panelKey: string;
  children: ReactNode;
  className?: string;
}

/**
 * Switches between tab panels without a layout jump: the outer box animates its height to the new
 * content (measured with a ResizeObserver) while the new content fades in. There is no exit phase
 * (nothing is rendered twice) and no animation on first mount.
 */
export function PanelSwitch({ panelKey, children, className }: PanelSwitchProps) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const firstKey = useRef(panelKey);
  const [switched, setSwitched] = useState(false);
  const animate = switched || panelKey !== firstKey.current;
  useEffect(() => {
    if (panelKey !== firstKey.current) setSwitched(true);
  }, [panelKey]);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    setHeight(el.offsetHeight + PAD);
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight + PAD));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height: height ?? 'auto' }}
      transition={{ duration: height === null ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn('-m-1 overflow-hidden p-1', className)}
    >
      <div ref={inner}>
        <div key={panelKey} className={animate ? 'panel-fade-in' : undefined}>
          {children}
        </div>
      </div>
    </motion.div>
  );
}
