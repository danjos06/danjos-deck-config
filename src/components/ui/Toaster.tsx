import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from './Icon';
import { useToastStore, type ToastKind } from './toast';

const styles: Record<ToastKind, { icon: string; cls: string }> = {
  success: { icon: 'check_circle', cls: 'text-ok' },
  error: { icon: 'error', cls: 'text-danger' },
  info: { icon: 'info', cls: 'text-sky-300' },
};

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[120] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            role={t.kind === 'error' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-white/10 bg-ink-800/95 px-3.5 py-3 text-sm shadow-pop backdrop-blur"
          >
            <Icon name={styles[t.kind].icon} fill size={20} className={styles[t.kind].cls} />
            <p className="min-w-0 flex-1 break-words text-fg">{t.text}</p>
            <button type="button" aria-label="Fechar aviso" onClick={() => dismiss(t.id)} className="text-fg-dim hover:text-fg">
              <Icon name="close" size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
