import { cloneElement, useCallback, useId, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface TooltipProps {
  label: string;
  children: ReactElement;
  side?: 'top' | 'bottom';
}

type Handler = ((e: unknown) => void) | undefined;

/** Lightweight portal tooltip: shows on hover/focus, never clipped by overflow containers. */
export function Tooltip({ label, children, side = 'bottom' }: TooltipProps) {
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<number>(0);

  const show = useCallback(
    (el: HTMLElement) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: side === 'bottom' ? r.bottom + 8 : r.top - 8 });
      }, 350);
    },
    [side],
  );
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  const child = children as ReactElement<Record<string, unknown>>;
  const orig = child.props;
  const clone = cloneElement(child, {
    'aria-describedby': pos ? id : undefined,
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      (orig.onMouseEnter as Handler)?.(e);
      show(e.currentTarget);
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      (orig.onMouseLeave as Handler)?.(e);
      hide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      (orig.onFocus as Handler)?.(e);
      show(e.currentTarget);
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      (orig.onBlur as Handler)?.(e);
      hide();
    },
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      (orig.onPointerDown as Handler)?.(e);
      hide();
    },
  });

  return (
    <>
      {clone}
      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.div
              id={id}
              role="tooltip"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ left: Math.min(Math.max(pos.x, 90), window.innerWidth - 90), top: pos.y }}
              className={`pointer-events-none fixed z-[100] max-w-[240px] -translate-x-1/2 rounded-md border border-white/10 bg-ink-800 px-2 py-1 text-center text-[11px] font-medium leading-snug text-fg shadow-pop ${side === 'top' ? '-translate-y-full' : ''}`}
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
