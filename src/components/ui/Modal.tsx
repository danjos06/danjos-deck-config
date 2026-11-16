import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/ui/cn';
import { IconButton } from './IconButton';

type Variant = 'center' | 'right' | 'left' | 'top';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: Variant;
  /** Extra classes for the panel (set `--w` via style classes like `[--w:960px]`). */
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  /** No visible header (the content brings its own); the title stays as an sr-only label. */
  bare?: boolean;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface PanelMotion {
  initial: Record<string, string | number>;
  animate: Record<string, string | number>;
  exit: Record<string, string | number>;
}

const panelMotion: Record<Variant, PanelMotion> = {
  center: { initial: { opacity: 0, scale: 0.97, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, y: 8 } },
  right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
  left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
  top: { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } },
};

const panelPos: Record<Variant, string> = {
  center: 'm-auto max-h-[min(92dvh,900px)] w-[min(94vw,var(--w,720px))] rounded-2xl border',
  right: 'ml-auto h-full w-[min(100vw,var(--w,400px))] border-l',
  left: 'mr-auto h-full w-[min(100vw,var(--w,320px))] border-r',
  top: 'mx-auto max-h-[85dvh] w-full rounded-b-2xl border-b',
};

/** Accessible modal / drawer / sheet with focus trap, Esc to close and framer-motion transitions. */
export function Overlay({ open, onClose, title, subtitle, variant = 'center', className, children, footer, headerExtra, bare }: OverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = panelRef.current;
      if (!el || el.contains(document.activeElement)) return;
      (el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      // Only the top-most overlay reacts.
      const all = document.querySelectorAll('[data-overlay]');
      if (all.length && all[all.length - 1] !== panelRef.current?.parentElement) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panelRef.current) {
        const f = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open]);

  // Own mount/unmount timing (AnimatePresence can get stuck with layoutId children inside the panel).
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(t);
  }, [open]);

  const m = panelMotion[variant];
  return createPortal(
    <>
      {mounted && (
        <div className={cn("fixed inset-0 z-50 flex", !open && "pointer-events-none")} data-overlay>
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={m.initial}
            animate={open ? m.animate : m.exit}
            transition={variant === 'center' ? { type: 'spring', stiffness: 420, damping: 34 } : { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.28 }}
            className={cn('relative z-10 flex min-h-0 min-w-0 flex-col overflow-hidden border-white/10 bg-ink-900 shadow-pop outline-none', panelPos[variant], className)}
          >
            {bare ? (
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : (
            <header className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="truncate text-[15px] font-semibold text-fg">
                  {title}
                </h2>
                {subtitle && <p className="truncate text-xs text-fg-muted">{subtitle}</p>}
              </div>
              {headerExtra}
              <IconButton icon="close" label="Fechar" onClick={onClose} />
            </header>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
            {footer && <footer className="shrink-0 border-t border-white/[0.06] bg-ink-900 px-4 py-3 sm:px-5">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </>,
    document.body,
  );
}

export const Modal = (p: Omit<OverlayProps, 'variant'>) => <Overlay {...p} variant="center" />;
export const Drawer = (p: Omit<OverlayProps, 'variant'> & { side?: 'right' | 'left' | 'top' }) => <Overlay {...p} variant={p.side ?? 'right'} />;
