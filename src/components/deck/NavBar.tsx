import { motion } from 'framer-motion';
import { cn } from '@/lib/ui/cn';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Icon, Tooltip } from '../ui';
import { canNavigate, navTarget } from './pageNav';

function NavButton({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const label = dir === 'prev' ? 'Página anterior' : 'Próxima página';
  return (
    <Tooltip label={`${label} (${dir === 'prev' ? '←' : '→'})`} side="top">
      <motion.button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        whileTap={{ scale: 0.93, y: 1 }}
        className={cn(
          'flex h-11 w-20 items-center justify-center rounded-xl text-fg-muted',
          'bg-gradient-to-b from-[#2a2d34] to-[#17181c] shadow-[0_1px_0_rgba(255,255,255,0.1)_inset,0_6px_10px_-4px_rgba(0,0,0,0.9)]',
          'hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:opacity-30',
        )}
      >
        <Icon name={dir === 'prev' ? 'chevron_left' : 'chevron_right'} size={28} />
      </motion.button>
    </Tooltip>
  );
}

/** Prev/next hardware buttons and page indicator dots. Folder pages are skipped by prev/next. */
export function NavBar() {
  const pages = useDeckStore((s) => s.config.pages);
  const currentId = useUiStore((s) => s.currentPageId);
  const setPage = useUiStore((s) => s.setCurrentPage);

  const current = pages.find((p) => p.id === currentId);
  const orderOf = (id: string) => pages.findIndex((p) => p.id === id);

  const go = (step: 1 | -1) => {
    const target = navTarget(pages, currentId, step);
    if (target) setPage(target.id, step);
  };
  const parent = current?.isFolder ? pages.find((p) => p.id === current.parentId) ?? pages[0] : null;
  const canNav = canNavigate(pages, currentId);

  return (
    <div className="flex items-center justify-center gap-5">
      <NavButton dir="prev" disabled={!canNav} onClick={() => go(-1)} />
      <div className="flex min-w-[190px] flex-col items-center gap-1.5">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Páginas">
          {pages.map((p) => {
            const active = p.id === currentId;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${p.isFolder ? 'Pasta' : 'Página'} ${p.name}`}
                title={p.name}
                onClick={() => setPage(p.id, orderOf(p.id) > orderOf(currentId) ? 1 : -1)}
                className="group flex h-4 items-center justify-center px-0.5 focus-visible:outline-none"
              >
                <motion.span
                  layout
                  className={cn(
                    'block transition-colors group-focus-visible:ring-2 group-focus-visible:ring-accent/70',
                    p.isFolder ? 'h-2 w-2 rotate-45 rounded-[2px]' : 'h-2 rounded-full',
                    active ? 'w-5 bg-accent shadow-led' : p.isFolder ? 'bg-fg-dim group-hover:bg-fg-muted' : 'w-2 bg-fg-dim group-hover:bg-fg-muted',
                  )}
                />
              </button>
            );
          })}
        </div>
        <p className="max-w-[260px] truncate text-xs font-medium text-fg-muted">
          {current?.isFolder && <Icon name="folder" size={13} className="mr-1 inline align-[-2px]" fill />}
          {current?.name}
        </p>
      </div>
      <NavButton dir="next" disabled={!canNav} onClick={() => go(1)} />
      {parent && (
        <button
          type="button"
          onClick={() => setPage(parent.id, -1)}
          className="ml-2 inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
        >
          <Icon name="arrow_back" size={14} /> {parent.name}
        </button>
      )}
    </div>
  );
}
